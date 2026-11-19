/** Eventos que a API manda no POST /api/chat/:slug (ver EventoChat na API). */
export type EventoChat =
  | { tipo: 'inicio'; conversaId: string }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'lead' }
  | { tipo: 'fim' }
  | { tipo: 'erro'; mensagem: string };

/**
 * Leitor incremental de Server-Sent Events. A rede corta os pedaços onde quiser
 * (no meio de um evento, ou vários juntos), então guarda o resto até fechar o bloco.
 * Cada bloco é `data: {json}` seguido de linha em branco.
 */
export function criarLeitorSse() {
  let resto = '';
  return (pedaco: string): EventoChat[] => {
    resto += pedaco.replace(/\r\n/g, '\n');
    const blocos = resto.split('\n\n');
    resto = blocos.pop() ?? '';
    const eventos: EventoChat[] = [];
    for (const bloco of blocos) {
      const dados = bloco
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (!dados) continue;
      try {
        eventos.push(JSON.parse(dados) as EventoChat);
      } catch {
        // Bloco corrompido: ignora em vez de derrubar a conversa.
      }
    }
    return eventos;
  };
}
