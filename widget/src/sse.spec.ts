import { criarLeitorSse } from './sse.js';

describe('criarLeitorSse', () => {
  it('junta um evento cortado no meio pela rede', () => {
    const ler = criarLeitorSse();
    expect(ler('data: {"tipo":"tex')).toEqual([]);
    expect(ler('to","texto":"Oi"}\n\n')).toEqual([{ tipo: 'texto', texto: 'Oi' }]);
  });

  it('separa vários eventos que chegam juntos', () => {
    const ler = criarLeitorSse();
    expect(
      ler('data: {"tipo":"inicio","conversaId":"c1"}\n\ndata: {"tipo":"lead"}\n\ndata: {"tipo":"fim"}\n\n'),
    ).toEqual([{ tipo: 'inicio', conversaId: 'c1' }, { tipo: 'lead' }, { tipo: 'fim' }]);
  });

  it('aceita quebra de linha do Windows e ignora bloco corrompido', () => {
    const ler = criarLeitorSse();
    expect(ler('data: {quebrado\r\n\r\ndata: {"tipo":"fim"}\r\n\r\n')).toEqual([{ tipo: 'fim' }]);
  });
});
