import { NavLink, Outlet } from 'react-router';
import { useLogado } from '../sessao';

const ITENS = [
  { para: '/leads', nome: 'Leads' },
  { para: '/bot', nome: 'Bot e base' },
  { para: '/instalar', nome: 'Instalar no site' },
];

export function Layout() {
  const { usuario, empresa, sair } = useLogado();
  return (
    <div className="painel">
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <aside className="lateral">
        <div className="marca">
          <i aria-hidden="true" />
          Atende AI
        </div>
        <div className="empresa-sel">
          <b>{empresa.nome}</b>
          assistente: {empresa.nomeBot}
        </div>
        <nav aria-label="Painel">
          {ITENS.map((i) => (
            <NavLink
              key={i.para}
              to={i.para}
              className={({ isActive }) => `item${isActive ? ' on' : ''}`}
            >
              {i.nome}
            </NavLink>
          ))}
        </nav>
        <div className="fim">
          <span title={usuario.email}>{usuario.nome}</span>
          <button type="button" className="sair" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </aside>
      <main className="conteudo" id="conteudo" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
