import { ProvedorSimulado } from './provedor-simulado.js';
import {
  type FerramentaIa,
  type MensagemIa,
  separadorDeRodadas,
  textoDosBlocos,
} from './provedor-ia.js';

const sinal = () => new AbortController().signal;
const usuario = (text: string): MensagemIa => ({
  papel: 'user',
  conteudo: [{ type: 'text', text }],
});

function ferramentaFalsa(erro = false) {
  const chamadas: unknown[] = [];
  const f: FerramentaIa = {
    nome: 'salvar_lead',
    descricao: '',
    parametros: { type: 'object', properties: {}, required: [] },
    executar: async (entrada) => {
      chamadas.push(entrada);
      return { texto: erro ? 'faltou nome' : 'ok', erro };
    },
  };
  return { f, chamadas };
}

describe('ProvedorSimulado', () => {
  it('responde em pedaços que, juntos, formam a mensagem guardada', async () => {
    const pedacos: string[] = [];
    const r = await new ProvedorSimulado(0).responder({
      sistema: '',
      mensagens: [usuario('que horas abre?')],
      aoTexto: (p) => pedacos.push(p),
      sinal: sinal(),
    });
    expect(r.mensagens).toHaveLength(1);
    expect(pedacos.length).toBeGreaterThan(1);
    expect(pedacos.join('')).toBe(textoDosBlocos(r.mensagens[0].conteudo));
  });

  it('com telefone na mensagem, chama salvar_lead e guarda pedido, resultado e resposta', async () => {
    const { f, chamadas } = ferramentaFalsa();
    const r = await new ProvedorSimulado(0).responder({
      sistema: '',
      mensagens: [usuario('Me chamo Ana Souza, meu zap é (11) 98888-7777')],
      ferramentas: [f],
      aoTexto: () => {},
      sinal: sinal(),
    });
    expect(chamadas).toEqual([
      expect.objectContaining({
        nome: 'Ana Souza',
        contato: '(11) 98888-7777',
      }),
    ]);
    expect(r.mensagens.map((m) => m.papel)).toEqual([
      'assistant',
      'user',
      'assistant',
    ]);
    expect(r.mensagens[1].conteudo[0]).toMatchObject({ type: 'tool_result' });
    expect(textoDosBlocos(r.mensagens[2].conteudo)).toMatch(/Anotei/);
  });

  it('se a ferramenta recusar, pede o contato de novo', async () => {
    const { f } = ferramentaFalsa(true);
    const r = await new ProvedorSimulado(0).responder({
      sistema: '',
      mensagens: [usuario('meu email é ana@exemplo.com')],
      ferramentas: [f],
      aoTexto: () => {},
      sinal: sinal(),
    });
    expect(textoDosBlocos(r.mensagens.at(-1)!.conteudo)).toMatch(
      /Não consegui anotar/,
    );
  });

  it('para quando o visitante fecha a página', async () => {
    const cancelar = new AbortController();
    cancelar.abort();
    await expect(
      new ProvedorSimulado(0).responder({
        sistema: '',
        mensagens: [],
        aoTexto: () => {},
        sinal: cancelar.signal,
      }),
    ).rejects.toThrow();
  });
});

describe('textoDosBlocos', () => {
  it('junta só os blocos de texto', () => {
    expect(
      textoDosBlocos([
        { type: 'thinking', thinking: 'x' },
        { type: 'text', text: 'Olá' },
        { type: 'tool_use', id: '1', name: 'f', input: {} },
        { type: 'text', text: '!' },
      ]),
    ).toBe('Olá!');
  });
});

describe('separadorDeRodadas', () => {
  it('põe quebra de linha só entre rodadas que tiveram texto', () => {
    const saida: string[] = [];
    const s = separadorDeRodadas((p) => saida.push(p));
    s.novaRodada();
    s.aoTexto('Vou anotar.');
    s.novaRodada(); // rodada só com ferramenta, sem texto
    s.novaRodada();
    s.aoTexto('Pronto!');
    expect(saida.join('')).toBe('Vou anotar.\n\nPronto!');
  });
});
