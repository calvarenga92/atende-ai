import type { Api, ConfigBot } from './api.js';
import { criarMemoria } from './memoria.js';
import type { EventoChat } from './sse.js';
import { montarWidget, type Widget } from './widget.js';

const CONFIG: ConfigBot = {
  nome: 'Padaria Pão de Ouro',
  nomeBot: 'Lia',
  mensagemBoasVindas: 'Oi! Eu sou a Lia.',
  corPrimaria: '#b45309',
  sugestoes: ['Horários', 'Encomendar bolo'],
};

type Roteiro = (mensagem: string, emitir: (e: EventoChat) => void) => Promise<void>;

/** API falsa: cada chamada a enviar segue o próximo roteiro da fila. */
function apiFalsa(...roteiros: Roteiro[]) {
  const enviadas: { mensagem: string; conversaId?: string }[] = [];
  const api = {
    config: async () => CONFIG,
    enviar: async (mensagem: string, conversaId: string | undefined, aoEvento: (e: EventoChat) => void) => {
      enviadas.push({ mensagem, conversaId });
      const roteiro = roteiros.shift();
      if (!roteiro) throw new Error('sem roteiro');
      await roteiro(mensagem, aoEvento);
    },
  } as unknown as Api;
  return { api, enviadas };
}

const respondeTexto =
  (...pedacos: string[]): Roteiro =>
  async (_m, emitir) => {
    emitir({ tipo: 'inicio', conversaId: 'c1' });
    for (const texto of pedacos) emitir({ tipo: 'texto', texto });
    emitir({ tipo: 'fim' });
  };

let widget: Widget | undefined;

function montar(api: Api) {
  widget = montarWidget({ config: CONFIG, api, memoria: criarMemoria('padaria-demo') });
  const $ = <T extends Element = HTMLElement>(sel: string) => widget!.sombra.querySelector<T>(sel)!;
  const $$ = (sel: string) => [...widget!.sombra.querySelectorAll<HTMLElement>(sel)];
  return { w: widget, $, $$ };
}

async function escrever($: ReturnType<typeof montar>['$'], texto: string) {
  const campo = $<HTMLInputElement>('input');
  campo.value = texto;
  campo.dispatchEvent(new Event('input'));
  $<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => widget?.destruir());

describe('widget', () => {
  it('começa fechado, com a bolha e a dica; abrir esconde a dica de vez', () => {
    const { $ } = montar(apiFalsa().api);
    expect($('.janela').hidden).toBe(true);
    expect($('.dica').textContent).toContain('Fale com Lia');

    $('.bolha').click();
    expect($('.janela').hidden).toBe(false);
    expect($('.bolha').getAttribute('aria-expanded')).toBe('true');
    expect($('.dica')).toBeNull();

    widget!.destruir();
    const outro = montar(apiFalsa().api);
    expect(outro.$('.dica')).toBeNull();
  });

  it('mostra boas-vindas e sugestões; a sugestão vira pergunta', async () => {
    const { api, enviadas } = apiFalsa(respondeTexto('Das 6h ', 'às 20h.'));
    const { $, $$ } = montar(api);
    expect($('.msg.bot').textContent).toBe('Oi! Eu sou a Lia.');
    expect($$('.sugestao').map((b) => b.textContent)).toEqual(['Horários', 'Encomendar bolo']);

    $$('.sugestao')[0].click();
    await new Promise((r) => setTimeout(r, 0));

    expect(enviadas[0].mensagem).toBe('Horários');
    expect($$('.msg').map((m) => m.textContent)).toEqual(['Oi! Eu sou a Lia.', 'Horários', 'Das 6h às 20h.']);
    expect($$('.sugestao')).toHaveLength(0); // somem depois da primeira pergunta
  });

  it('mostra "digitando" até o primeiro texto e bloqueia o envio no meio', async () => {
    let liberar!: () => void;
    const { api } = apiFalsa(async (_m, emitir) => {
      emitir({ tipo: 'inicio', conversaId: 'c1' });
      await new Promise<void>((r) => (liberar = r));
      emitir({ tipo: 'texto', texto: 'Abrimos sim!' });
      emitir({ tipo: 'fim' });
    });
    const { $ } = montar(api);
    await escrever($, 'Abrem domingo?');

    expect($('.digitando')).not.toBeNull();
    expect($<HTMLButtonElement>('.enviar').disabled).toBe(true);

    liberar();
    await new Promise((r) => setTimeout(r, 0));
    expect($('.digitando')).toBeNull();
    expect($('.msg.bot.cursor')).toBeNull();
  });

  it('confirma o lead entre o texto de antes e o de depois', async () => {
    const { api } = apiFalsa(async (_m, emitir) => {
      emitir({ tipo: 'inicio', conversaId: 'c1' });
      emitir({ tipo: 'lead' });
      emitir({ tipo: 'texto', texto: 'Prontinho, Mariana!' });
      emitir({ tipo: 'fim' });
    });
    const { $, $$ } = montar(api);
    await escrever($, 'Mariana, 11 97777-1234');

    const ordem = [...$('.corpo').children].map((n) => n.className);
    expect(ordem).toEqual(['msg bot', 'msg eu', 'lead', 'msg bot']);
    expect($('.lead').textContent).toBe('Contato enviado para a equipe');
    expect($$('.msg.bot').at(-1)!.textContent).toBe('Prontinho, Mariana!');
  });

  it('na falha, oferece tentar de novo sem duplicar a pergunta', async () => {
    const { api, enviadas } = apiFalsa(
      async (_m, emitir) => {
        emitir({ tipo: 'inicio', conversaId: 'c1' });
        emitir({ tipo: 'erro', mensagem: 'x' });
      },
      respondeTexto('Aceitamos Alelo e Sodexo.'),
    );
    const { $, $$ } = montar(api);
    await escrever($, 'Aceitam vale-refeição?');

    expect($('.falha').getAttribute('role')).toBe('alert');
    $('.falha button').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(enviadas.map((e) => e.mensagem)).toEqual(['Aceitam vale-refeição?', 'Aceitam vale-refeição?']);
    expect(enviadas[1].conversaId).toBe('c1');
    expect($$('.msg.eu')).toHaveLength(1);
    expect($('.falha')).toBeNull();
    expect($$('.msg.bot').at(-1)!.textContent).toBe('Aceitamos Alelo e Sodexo.');
  });

  it('lembra a conversa ao trocar de página no mesmo site', async () => {
    const { api } = apiFalsa(respondeTexto('Das 6h às 20h.'));
    const primeiro = montar(api);
    primeiro.$('.bolha').click();
    await escrever(primeiro.$, 'Horário?');
    widget!.destruir();

    const { api: api2, enviadas } = apiFalsa(respondeTexto('Sim.'));
    const segundo = montar(api2);
    expect(segundo.$('.janela').hidden).toBe(false); // continua aberto
    expect(segundo.$$('.msg').map((m) => m.textContent)).toEqual(['Oi! Eu sou a Lia.', 'Horário?', 'Das 6h às 20h.']);

    await escrever(segundo.$, 'Domingo também?');
    expect(enviadas[0].conversaId).toBe('c1');
  });

  it('mostra o texto da IA como texto, nunca como HTML', async () => {
    const { api } = apiFalsa(respondeTexto('<img src=x onerror=alert(1)>'));
    const { $ } = montar(api);
    await escrever($, 'oi');
    expect($('.corpo img')).toBeNull();
  });

  it('Esc fecha e devolve o foco para a bolha', () => {
    const { $ } = montar(apiFalsa().api);
    $('.bolha').click();
    $('.janela').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect($('.janela').hidden).toBe(true);
    expect(widget!.sombra.activeElement).toBe($('.bolha'));
  });
});
