import { ProvedorSimulado } from './provedor-simulado.js';
import { textoDosBlocos } from './provedor-ia.js';

describe('ProvedorSimulado', () => {
  it('responde em pedaços que, juntos, formam o conteúdo guardado', async () => {
    const pedacos: string[] = [];
    const r = await new ProvedorSimulado(0).responder({
      sistema: '',
      mensagens: [
        {
          papel: 'user',
          conteudo: [{ type: 'text', text: 'que horas abre?' }],
        },
      ],
      aoTexto: (p) => pedacos.push(p),
      sinal: new AbortController().signal,
    });
    expect(pedacos.length).toBeGreaterThan(1);
    expect(pedacos.join('')).toBe(textoDosBlocos(r.conteudo));
    expect(textoDosBlocos(r.conteudo)).toContain('que horas abre?');
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
        { type: 'text', text: '!' },
      ]),
    ).toBe('Olá!');
  });
});
