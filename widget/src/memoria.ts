/**
 * O que o widget lembra entre páginas do mesmo site. A conversa fica na sessão
 * da aba (some ao fechar); a dica da bolha, uma vez dispensada, não volta.
 */
export interface ItemConversa {
  autor: 'bot' | 'eu' | 'lead';
  texto: string;
}

export interface EstadoSalvo {
  conversaId?: string;
  itens: ItemConversa[];
  aberto: boolean;
}

const MAX_ITENS = 100;

function ler<T>(armazem: Storage | undefined, chave: string): T | undefined {
  try {
    const bruto = armazem?.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : undefined;
  } catch {
    return undefined; // modo anônimo, cota cheia ou JSON corrompido
  }
}

function gravar(armazem: Storage | undefined, chave: string, valor: unknown) {
  try {
    armazem?.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento o chat funciona igual, só não lembra.
  }
}

export function criarMemoria(slug: string) {
  const chave = `atende-ai:${slug}`;
  const sessao = typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  const local = typeof localStorage === 'undefined' ? undefined : localStorage;

  return {
    carregar(): EstadoSalvo {
      const e = ler<EstadoSalvo>(sessao, `${chave}:conversa`);
      return {
        conversaId: e?.conversaId,
        itens: Array.isArray(e?.itens) ? e.itens : [],
        aberto: e?.aberto === true,
      };
    },
    salvar(estado: EstadoSalvo) {
      gravar(sessao, `${chave}:conversa`, {
        ...estado,
        itens: estado.itens.slice(-MAX_ITENS),
      });
    },
    dicaVista: () => ler<boolean>(local, `${chave}:dica`) === true,
    marcarDicaVista: () => gravar(local, `${chave}:dica`, true),
  };
}

export type Memoria = ReturnType<typeof criarMemoria>;
