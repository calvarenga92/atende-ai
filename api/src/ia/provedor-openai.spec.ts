import type { FerramentaIa } from './provedor-ia.js';
import { paraOpenAi, ProvedorOpenAi } from './provedor-openai.js';

function streamSse(eventos: unknown[]): Response {
  const corpo =
    eventos.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') +
    'data: [DONE]\n\n';
  return new Response(corpo, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const executar = vi.fn(async () => ({ texto: 'Salvo.' }));
const ferramenta: FerramentaIa = {
  nome: 'salvar_lead',
  descricao: 'salva',
  parametros: { type: 'object', properties: {}, required: [] },
  executar,
};

describe('ProvedorOpenAi', () => {
  afterEach(() => vi.restoreAllMocks());

  it('faz streaming do texto e manda chave, modelo e contexto do dia', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        streamSse([
          { choices: [{ delta: { content: 'Abrimos ' } }] },
          { choices: [{ delta: { content: 'às 6h.' } }] },
          { choices: [], usage: { prompt_tokens: 50, completion_tokens: 4 } },
        ]),
      );
    const pedacos: string[] = [];
    const p = new ProvedorOpenAi('https://api.groq.com/openai/v1', 'k', 'm');

    const r = await p.responder({
      sistema: 'SIS',
      contexto: 'Data de hoje: X.',
      mensagens: [{ papel: 'user', conteudo: [{ type: 'text', text: 'oi' }] }],
      aoTexto: (t) => pedacos.push(t),
      sinal: new AbortController().signal,
    });

    expect(pedacos.join('')).toBe('Abrimos às 6h.');
    expect(r.mensagens).toEqual([
      {
        papel: 'assistant',
        conteudo: [{ type: 'text', text: 'Abrimos às 6h.' }],
      },
    ]);
    expect(r.consumo).toContain('entrada 50');
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer k',
    );
    const corpo = JSON.parse(init.body as string) as {
      model: string;
      messages: unknown[];
    };
    expect(corpo.model).toBe('m');
    expect(corpo.messages[0]).toEqual({
      role: 'system',
      content: 'SIS\n\nData de hoje: X.',
    });
  });

  it('junta a chamada de ferramenta em pedaços, executa e faz a 2ª rodada', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        streamSse([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'c1',
                      function: { name: 'salvar_lead', arguments: '{"nome":' },
                    },
                  ],
                },
              },
            ],
          },
          {
            choices: [
              {
                delta: {
                  tool_calls: [{ index: 0, function: { arguments: '"Ana"}' } }],
                },
              },
            ],
          },
        ]),
      )
      .mockResolvedValueOnce(
        streamSse([{ choices: [{ delta: { content: 'Pronto!' } }] }]),
      );

    const p = new ProvedorOpenAi('http://127.0.0.1:11434/v1', '', 'm');
    const r = await p.responder({
      sistema: 'S',
      mensagens: [{ papel: 'user', conteudo: [{ type: 'text', text: 'Ana' }] }],
      ferramentas: [ferramenta],
      aoTexto: () => {},
      sinal: new AbortController().signal,
    });

    expect(executar).toHaveBeenCalledWith({ nome: 'Ana' });
    expect(r.mensagens).toHaveLength(3);
    expect(r.mensagens[0].conteudo).toEqual([
      {
        type: 'tool_use',
        id: 'c1',
        name: 'salvar_lead',
        input: { nome: 'Ana' },
      },
    ]);
    expect(r.mensagens[2].conteudo).toEqual([
      { type: 'text', text: 'Pronto!' },
    ]);
  });

  it('avisa quando o plano grátis estoura (429)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('Please try again in 1ms', { status: 429 }),
    );
    const p = new ProvedorOpenAi('https://x.test/v1', 'k', 'm');
    await expect(
      p.responder({
        sistema: 'S',
        mensagens: [],
        aoTexto: () => {},
        sinal: new AbortController().signal,
      }),
    ).rejects.toThrow('limite de uso');
  });
});

describe('ProvedorOpenAi no limite de uso', () => {
  afterEach(() => vi.restoreAllMocks());

  it('espera e tenta de novo, depois passa para o modelo de reserva', async () => {
    const modelos: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const { model } = JSON.parse(init?.body as string) as { model: string };
      modelos.push(model);
      return model === 'reserva'
        ? streamSse([{ choices: [{ delta: { content: 'Oi!' } }] }])
        : new Response('try again in 5ms', { status: 429 });
    });
    const p = new ProvedorOpenAi('https://x.test/v1', 'k', 'principal', [
      'reserva',
    ]);
    const pedacos: string[] = [];
    await p.responder({
      sistema: 'S',
      mensagens: [],
      aoTexto: (t) => pedacos.push(t),
      sinal: new AbortController().signal,
    });
    expect(modelos).toEqual(['principal', 'principal', 'reserva']);
    expect(pedacos.join('')).toBe('Oi!');
  });
});

describe('paraOpenAi', () => {
  it('converte pedido e resultado de ferramenta', () => {
    expect(
      paraOpenAi([
        {
          papel: 'assistant',
          conteudo: [
            { type: 'text', text: 'Vou anotar.' },
            {
              type: 'tool_use',
              id: 'c1',
              name: 'salvar_lead',
              input: { a: 1 },
            },
          ],
        },
        {
          papel: 'user',
          conteudo: [{ type: 'tool_result', tool_use_id: 'c1', content: 'ok' }],
        },
      ]),
    ).toEqual([
      {
        role: 'assistant',
        content: 'Vou anotar.',
        tool_calls: [
          {
            id: 'c1',
            type: 'function',
            function: { name: 'salvar_lead', arguments: '{"a":1}' },
          },
        ],
      },
      { role: 'tool', content: 'ok', tool_call_id: 'c1' },
    ]);
  });
});
