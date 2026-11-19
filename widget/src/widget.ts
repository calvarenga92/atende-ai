import type { Api, ConfigBot } from './api.js';
import { montarPaleta } from './cores.js';
import { ESTILOS } from './estilos.js';
import type { ItemConversa, Memoria } from './memoria.js';
import type { EventoChat } from './sse.js';

const MSG_FALHA = 'Tive um problema para responder agora.';
const MAX_CARACTERES = 2000;

const ICONE_BALAO =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
const ICONE_ENVIAR =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ICONE_FECHAR =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICONE_OK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

export interface OpcoesWidget {
  config: ConfigBot;
  api: Api;
  memoria: Memoria;
  /** Onde pendurar o widget. Padrão: document.body. */
  alvo?: HTMLElement;
}

/** Cria um elemento com classe e, opcionalmente, texto (sempre como texto, nunca HTML). */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classe = '',
  texto?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

/**
 * Monta o widget (telas 1 a 7 do Figma "Atende AI — Telas"): bolha com dica, chat com
 * boas-vindas e sugestões, "digitando" até o primeiro texto, resposta em streaming,
 * confirmação de lead e falha com "Tentar de novo".
 */
export function montarWidget({ config, api, memoria, alvo = document.body }: OpcoesWidget) {
  const host = el('div');
  host.id = 'atende-ai-widget';
  const sombra = host.attachShadow({ mode: 'open' });
  const p = montarPaleta(config.corPrimaria);

  const estilo = el('style');
  estilo.textContent = ESTILOS;
  const raiz = el('div', 'raiz');
  for (const [nome, valor] of Object.entries({
    '--base': p.base,
    '--clara': p.clara,
    '--escura': p.escura,
    '--fundo': p.fundo,
    '--borda': p.borda,
    '--sobre-base': p.sobreBase,
  })) {
    raiz.style.setProperty(nome, valor);
  }

  // ---------- janela ----------
  const janela = el('div', 'janela');
  janela.id = 'atende-ai-janela';
  janela.hidden = true;
  janela.setAttribute('role', 'dialog');
  janela.setAttribute('aria-label', `Chat com ${config.nomeBot}, de ${config.nome}`);

  const topo = el('div', 'topo');
  const av = el('div', 'av', config.nomeBot.charAt(0).toUpperCase());
  av.setAttribute('aria-hidden', 'true');
  const nome = el('div', 'nome');
  const sub = el('span');
  sub.append(el('i', 'on'), `${config.nome} · responde na hora`);
  nome.append(el('b', '', config.nomeBot), sub);
  const fechar = el('button', 'fechar', '×');
  fechar.type = 'button';
  fechar.setAttribute('aria-label', 'Fechar o chat');
  topo.append(av, nome, fechar);

  const corpo = el('div', 'corpo');
  corpo.setAttribute('role', 'log');
  corpo.setAttribute('aria-live', 'polite');

  const form = el('form', 'entrada');
  const campo = el('input');
  campo.type = 'text';
  campo.placeholder = 'Escreva sua mensagem…';
  campo.maxLength = MAX_CARACTERES;
  campo.autocomplete = 'off';
  campo.setAttribute('aria-label', `Mensagem para ${config.nomeBot}`);
  const enviar = el('button', 'enviar');
  enviar.type = 'submit';
  enviar.innerHTML = ICONE_ENVIAR;
  enviar.setAttribute('aria-label', 'Enviar');
  form.append(campo, enviar);

  janela.append(
    topo,
    corpo,
    form,
    el('div', 'rodape', 'Assistente virtual · pode errar; confirme com a equipe'),
  );

  // ---------- bolha ----------
  const canto = el('div', 'canto');
  const bolha = el('button', 'bolha');
  bolha.type = 'button';
  bolha.innerHTML = ICONE_BALAO;
  bolha.setAttribute('aria-label', `Abrir o chat com ${config.nomeBot}`);
  bolha.setAttribute('aria-controls', janela.id);
  bolha.setAttribute('aria-expanded', 'false');
  let dica: HTMLElement | null = null;
  if (!memoria.dicaVista()) {
    dica = el('div', 'dica');
    const xDica = el('button', 'x-dica', '×');
    xDica.type = 'button';
    xDica.setAttribute('aria-label', 'Dispensar o aviso');
    xDica.addEventListener('click', esconderDica);
    dica.append(
      el('b', '', `Fale com ${config.nomeBot} 👋`),
      'Tire suas dúvidas ou peça um orçamento por aqui.',
      xDica,
    );
    canto.append(dica);
  }
  canto.append(bolha);

  raiz.append(janela, canto);
  sombra.append(estilo, raiz);
  alvo.append(host);

  // ---------- estado ----------
  const salvo = memoria.carregar();
  let conversaId = salvo.conversaId;
  const itens: ItemConversa[] = salvo.itens;
  let ocupado = false;
  let controle: AbortController | null = null;

  function persistir() {
    memoria.salvar({ conversaId, itens, aberto: !janela.hidden });
  }

  function rolar() {
    corpo.scrollTop = corpo.scrollHeight;
  }

  function noItem(item: ItemConversa): HTMLElement {
    if (item.autor === 'lead') {
      const aviso = el('div', 'lead');
      aviso.innerHTML = ICONE_OK;
      aviso.append(item.texto);
      return aviso;
    }
    return el('div', `msg ${item.autor}`, item.texto);
  }

  function desenhar() {
    corpo.replaceChildren(el('div', 'msg bot', config.mensagemBoasVindas));
    if (!itens.some((i) => i.autor === 'eu') && config.sugestoes.length) {
      const lista = el('div', 'sugestoes');
      for (const s of config.sugestoes) {
        const b = el('button', 'sugestao', s);
        b.type = 'button';
        b.addEventListener('click', () => void perguntar(s));
        lista.append(b);
      }
      corpo.append(lista);
    }
    for (const item of itens) corpo.append(noItem(item));
    rolar();
  }

  function atualizarEnvio() {
    enviar.disabled = ocupado || !campo.value.trim();
  }

  function marcarBolha(aberto: boolean) {
    bolha.innerHTML = aberto ? ICONE_FECHAR : ICONE_BALAO;
    bolha.setAttribute('aria-expanded', String(aberto));
    bolha.setAttribute(
      'aria-label',
      `${aberto ? 'Fechar' : 'Abrir'} o chat com ${config.nomeBot}`,
    );
  }

  function esconderDica() {
    if (!dica) return;
    dica.remove();
    dica = null;
    memoria.marcarDicaVista();
  }

  function abrir() {
    esconderDica();
    janela.hidden = false;
    raiz.classList.add('aberta');
    marcarBolha(true);
    persistir();
    rolar();
    campo.focus();
  }

  function fecharJanela() {
    janela.hidden = true;
    raiz.classList.remove('aberta');
    marcarBolha(false);
    persistir();
    bolha.focus();
  }

  /** Manda a pergunta. `repetir` = tentar de novo a última, sem duplicar o balão. */
  async function perguntar(texto: string, repetir = false) {
    if (ocupado || !texto.trim()) return;
    ocupado = true;
    atualizarEnvio();
    if (!repetir) {
      itens.push({ autor: 'eu', texto });
      persistir();
    }
    desenhar();

    const digitando = el('div', 'digitando');
    digitando.setAttribute('aria-label', `${config.nomeBot} está digitando`);
    digitando.append(el('i'), el('i'), el('i'));
    corpo.append(digitando);
    rolar();

    let balao: HTMLElement | null = null;
    let atual = '';
    const fecharBalao = () => {
      if (balao) {
        balao.classList.remove('cursor');
        itens.push({ autor: 'bot', texto: atual });
      }
      balao = null;
      atual = '';
    };
    let falhou = false;

    const aoEvento = (e: EventoChat) => {
      if (e.tipo === 'inicio') {
        conversaId = e.conversaId;
      } else if (e.tipo === 'texto') {
        digitando.remove();
        if (!balao) {
          balao = el('div', 'msg bot cursor');
          corpo.append(balao);
        }
        atual += e.texto;
        balao.textContent = atual;
        rolar();
      } else if (e.tipo === 'lead') {
        fecharBalao();
        const item: ItemConversa = { autor: 'lead', texto: 'Contato enviado para a equipe' };
        itens.push(item);
        corpo.append(noItem(item));
        rolar();
      } else if (e.tipo === 'erro') {
        falhou = true;
      }
    };

    controle = new AbortController();
    try {
      await api.enviar(texto, conversaId, aoEvento, controle.signal);
    } catch {
      if (controle?.signal.aborted) return;
      falhou = true;
    } finally {
      digitando.remove();
      fecharBalao();
      ocupado = false;
      controle = null;
      persistir();
      atualizarEnvio();
    }

    if (falhou) {
      const caixa = el('div', 'falha');
      caixa.setAttribute('role', 'alert');
      const tentar = el('button', '', 'Tentar de novo');
      tentar.type = 'button';
      tentar.addEventListener('click', () => void perguntar(texto, true));
      caixa.append(el('b', '', MSG_FALHA), 'Pode tentar de novo em instantes?', tentar);
      corpo.append(caixa);
      rolar();
    }
  }

  // ---------- eventos ----------
  bolha.addEventListener('click', () => (janela.hidden ? abrir() : fecharJanela()));
  fechar.addEventListener('click', fecharJanela);
  janela.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') fecharJanela();
  });
  campo.addEventListener('input', atualizarEnvio);
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const texto = campo.value.trim();
    if (!texto || ocupado) return;
    campo.value = '';
    void perguntar(texto);
  });

  desenhar();
  atualizarEnvio();
  if (salvo.aberto) {
    janela.hidden = false;
    raiz.classList.add('aberta');
    marcarBolha(true);
  }

  return {
    abrir,
    fechar: fecharJanela,
    destruir() {
      controle?.abort();
      host.remove();
    },
    /** Só para testes: a árvore dentro do Shadow DOM. */
    sombra,
  };
}

export type Widget = ReturnType<typeof montarWidget>;
