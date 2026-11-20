import type { ReactNode } from 'react';
import {
  createBrowserRouter,
  createMemoryRouter,
  Navigate,
  type RouteObject,
  useLocation,
} from 'react-router';
import { useSessao } from './sessao';
import { Acesso } from './telas/Acesso';
import { Bot } from './telas/Bot';
import { Instalar } from './telas/Instalar';
import { Layout } from './telas/Layout';
import { Leads } from './telas/Leads';

function Carregando() {
  return (
    <div className="carregando" role="status">
      Abrindo o painel…
    </div>
  );
}

/** Só entra logado; senão vai para /entrar e volta para onde estava depois. */
function SoLogado({ children }: { children: ReactNode }) {
  const { estado } = useSessao();
  const local = useLocation();
  if (estado.fase === 'carregando') return <Carregando />;
  if (estado.fase === 'fora') {
    return <Navigate to="/entrar" replace state={{ voltar: local.pathname }} />;
  }
  return children;
}

/** Logado não vê login nem cadastro. */
function SoFora({ children }: { children: ReactNode }) {
  const { estado } = useSessao();
  const local = useLocation();
  if (estado.fase === 'carregando') return <Carregando />;
  if (estado.fase === 'dentro') {
    const voltar = (local.state as { voltar?: string } | null)?.voltar;
    return <Navigate to={voltar ?? '/leads'} replace />;
  }
  return children;
}

export const ROTAS: RouteObject[] = [
  {
    path: '/entrar',
    element: (
      <SoFora>
        <Acesso modo="entrar" />
      </SoFora>
    ),
  },
  {
    path: '/criar-conta',
    element: (
      <SoFora>
        <Acesso modo="cadastro" />
      </SoFora>
    ),
  },
  {
    path: '/',
    element: (
      <SoLogado>
        <Layout />
      </SoLogado>
    ),
    children: [
      { index: true, element: <Navigate to="/leads" replace /> },
      { path: 'leads', element: <Leads /> },
      { path: 'bot', element: <Bot /> },
      { path: 'instalar', element: <Instalar /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];

export const criarRotas = () => createBrowserRouter(ROTAS);

/** Para os testes: começa numa rota sem precisar de navegador. */
export const criarRotasTeste = (inicio: string) =>
  createMemoryRouter(ROTAS, { initialEntries: [inicio] });
