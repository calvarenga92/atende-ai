/** `**algo**` aberto e fechado na mesma linha. */
const NEGRITO = /\*\*([^*\n]+?)\*\*/g;

/**
 * Texto da resposta do bot → nós do DOM. Entende só **negrito**, que é o que a IA
 * insiste em mandar; todo o resto sai como texto puro.
 *
 * Nunca vira HTML (nada de innerHTML): a resposta da IA pode ser manipulada por
 * quem conversa ou pela base de conhecimento, então tag nenhuma pode ser interpretada.
 *
 * Um `**` sem par fica literal: no streaming o fechamento ainda pode não ter chegado.
 */
export function formatarMensagem(texto: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  let ultimo = 0;
  for (const m of texto.matchAll(NEGRITO)) {
    frag.append(texto.slice(ultimo, m.index));
    const forte = document.createElement('strong');
    forte.textContent = m[1];
    frag.append(forte);
    ultimo = m.index + m[0].length;
  }
  frag.append(texto.slice(ultimo));
  return frag;
}
