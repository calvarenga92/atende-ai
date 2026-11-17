import { paraOllama } from './provedor-ollama.js';

describe('paraOllama', () => {
  it('converte texto, pedido de ferramenta e resultado para o formato do Ollama', () => {
    const r = paraOllama([
      {
        papel: 'user',
        conteudo: [{ type: 'text', text: 'Sou Ana, 11 98888-7777' }],
      },
      {
        papel: 'assistant',
        conteudo: [
          { type: 'thinking', thinking: 'ignorado' },
          { type: 'text', text: 'Vou anotar.' },
          {
            type: 'tool_use',
            id: 'c1',
            name: 'salvar_lead',
            input: { nome: 'Ana' },
          },
        ],
      },
      {
        papel: 'user',
        conteudo: [{ type: 'tool_result', tool_use_id: 'c1', content: 'ok' }],
      },
      { papel: 'assistant', conteudo: [{ type: 'text', text: 'Pronto!' }] },
    ]);

    expect(r).toEqual([
      { role: 'user', content: 'Sou Ana, 11 98888-7777' },
      {
        role: 'assistant',
        content: 'Vou anotar.',
        tool_calls: [
          {
            id: 'c1',
            function: { name: 'salvar_lead', arguments: { nome: 'Ana' } },
          },
        ],
      },
      { role: 'tool', content: 'ok', tool_name: 'salvar_lead' },
      { role: 'assistant', content: 'Pronto!' },
    ]);
  });

  it('pula mensagem do assistente sem texto nem ferramenta (ex.: só thinking)', () => {
    expect(
      paraOllama([
        { papel: 'assistant', conteudo: [{ type: 'thinking', thinking: 'x' }] },
      ]),
    ).toEqual([]);
  });
});
