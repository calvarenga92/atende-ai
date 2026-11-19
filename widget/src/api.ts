import { criarLeitorSse, type EventoChat } from './sse.js';

/** Dados públicos do bot (GET /api/chat/:slug/config). */
export interface ConfigBot {
  nome: string;
  nomeBot: string;
  mensagemBoasVindas: string;
  corPrimaria: string;
  sugestoes: string[];
}

export class ErroApi extends Error {}

export function criarApi(base: string, slug: string) {
  const url = `${base}/api/chat/${encodeURIComponent(slug)}`;

  return {
    async config(): Promise<ConfigBot> {
      const r = await fetch(`${url}/config`);
      if (!r.ok) throw new ErroApi(`Empresa "${slug}" não encontrada.`);
      const c = (await r.json()) as ConfigBot;
      return { ...c, sugestoes: c.sugestoes ?? [] };
    },

    /** Manda a mensagem e entrega os eventos do streaming conforme chegam. */
    async enviar(
      mensagem: string,
      conversaId: string | undefined,
      aoEvento: (e: EventoChat) => void,
      sinal?: AbortSignal,
    ): Promise<void> {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem, conversaId }),
        signal: sinal,
      });
      if (!r.ok || !r.body) {
        const corpo = (await r.json().catch(() => null)) as {
          mensagem?: string;
        } | null;
        throw new ErroApi(corpo?.mensagem ?? 'Falha de conexão.');
      }
      const ler = criarLeitorSse();
      const leitor = r.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        for (const evento of ler(value)) aoEvento(evento);
      }
    },
  };
}

export type Api = ReturnType<typeof criarApi>;
