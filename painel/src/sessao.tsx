import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, type DadosCadastro, ErroApi } from './api';
import type { Empresa, Login, Usuario } from './tipos';

const CHAVE = 'atende-ai.token';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'fora' }
  | { fase: 'dentro'; token: string; usuario: Usuario; empresa: Empresa };

interface Sessao {
  estado: Estado;
  entrar(email: string, senha: string): Promise<void>;
  cadastrar(dados: DadosCadastro): Promise<void>;
  sair(): Promise<void>;
  /** Depois de salvar no painel, a lateral e a prévia passam a usar a empresa nova. */
  trocarEmpresa(empresa: Empresa): void;
  /** Chamar quando a API responder 401: a sessão venceu ou foi encerrada. */
  expirou(): void;
}

const Contexto = createContext<Sessao | null>(null);

/**
 * Guarda o token no localStorage (sobrevive a recarregar a página). O painel não usa
 * HTML vindo de fora (React escapa tudo), o que mantém baixo o risco de um script ler o token.
 */
export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(() =>
    localStorage.getItem(CHAVE) ? { fase: 'carregando' } : { fase: 'fora' },
  );

  // Ao abrir com token salvo, confere se ele ainda vale.
  useEffect(() => {
    const token = localStorage.getItem(CHAVE);
    if (!token) return;
    let vivo = true;
    api.eu(token).then(
      ({ usuario, empresa }) => {
        if (vivo) setEstado({ fase: 'dentro', token, usuario, empresa });
      },
      (e: unknown) => {
        if (!vivo) return;
        // Servidor fora não derruba a sessão: só um 401 diz que o token não vale.
        if (e instanceof ErroApi && e.status === 401) {
          localStorage.removeItem(CHAVE);
        }
        setEstado({ fase: 'fora' });
      },
    );
    return () => {
      vivo = false;
    };
  }, []);

  const abrir = useCallback((login: Login) => {
    localStorage.setItem(CHAVE, login.token);
    setEstado({
      fase: 'dentro',
      token: login.token,
      usuario: login.usuario,
      empresa: login.empresa,
    });
  }, []);

  const expirou = useCallback(() => {
    localStorage.removeItem(CHAVE);
    setEstado({ fase: 'fora' });
  }, []);

  const valor = useMemo<Sessao>(
    () => ({
      estado,
      entrar: async (email, senha) => abrir(await api.entrar(email, senha)),
      cadastrar: async (dados) => abrir(await api.cadastrar(dados)),
      sair: async () => {
        if (estado.fase === 'dentro') {
          // Se a API não responder, sai do mesmo jeito: o token vence sozinho.
          await api.sair(estado.token).catch(() => undefined);
        }
        expirou();
      },
      trocarEmpresa: (empresa) =>
        setEstado((e) => (e.fase === 'dentro' ? { ...e, empresa } : e)),
      expirou,
    }),
    [estado, abrir, expirou],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): Sessao {
  const s = useContext(Contexto);
  if (!s) throw new Error('useSessao fora do ProvedorSessao.');
  return s;
}

/** Para as telas de dentro: a sessão já está garantida pela rota protegida. */
export function useLogado() {
  const s = useSessao();
  if (s.estado.fase !== 'dentro') throw new Error('Tela do painel sem login.');
  return { ...s.estado, ...s };
}
