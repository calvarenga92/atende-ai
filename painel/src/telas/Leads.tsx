import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { api, ErroApi } from '../api';
import { useLogado } from '../sessao';
import type { Lead } from '../tipos';
import {
  avatar,
  ehHoje,
  type FiltroLeads,
  filtrarLeads,
  formatarContato,
  leadsParaCsv,
  quando,
} from '../util';

type Carga =
  | { fase: 'carregando' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'pronto'; leads: Lead[] };

const FILTROS: { valor: FiltroLeads; nome: string }[] = [
  { valor: 'todos', nome: 'Todos' },
  { valor: 'telefone', nome: 'Telefone' },
  { valor: 'email', nome: 'E-mail' },
];

export function Leads() {
  const { token, empresa, expirou } = useLogado();
  const [carga, setCarga] = useState<Carga>({ fase: 'carregando' });
  const [filtro, setFiltro] = useState<FiltroLeads>('todos');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setCarga({ fase: 'carregando' });
    try {
      setCarga({ fase: 'pronto', leads: await api.leads(token) });
    } catch (e) {
      if (e instanceof ErroApi && e.status === 401) return expirou();
      setCarga({
        fase: 'erro',
        mensagem: e instanceof ErroApi ? e.message : 'Algo deu errado.',
      });
    }
  }, [token, expirou]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const leads = carga.fase === 'pronto' ? carga.leads : [];
  const visiveis = useMemo(
    () => filtrarLeads(leads, filtro, busca),
    [leads, filtro, busca],
  );
  const numeros = useMemo(() => {
    const semana = Date.now() - 7 * 86_400_000;
    return {
      hoje: leads.filter((l) => ehHoje(l.criadoEm)).length,
      semana: leads.filter((l) => new Date(l.criadoEm).getTime() >= semana)
        .length,
      total: leads.length,
      telefone: leads.filter((l) => l.tipoContato === 'telefone').length,
    };
  }, [leads]);

  function exportar() {
    const url = URL.createObjectURL(
      new Blob([leadsParaCsv(visiveis)], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${empresa.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <header className="cab">
        <div>
          <h1>Leads</h1>
          <p>
            Pessoas que pediram retorno no chat do site. {empresa.nomeBot} só
            pede contato quando há interesse.
          </p>
        </div>
        <button
          type="button"
          className="btn-pri"
          onClick={exportar}
          disabled={!visiveis.length}
        >
          Exportar CSV
        </button>
      </header>

      {carga.fase === 'carregando' && (
        <p className="aviso" role="status">
          Carregando os leads…
        </p>
      )}

      {carga.fase === 'erro' && (
        <div className="aviso erro" role="alert">
          <p>{carga.mensagem}</p>
          <button
            type="button"
            className="btn-sec"
            onClick={() => void carregar()}
          >
            Tentar de novo
          </button>
        </div>
      )}

      {carga.fase === 'pronto' && (
        <>
          <section className="kpis" aria-label="Resumo">
            <div className="kpi destaque">
              <span>Leads hoje</span>
              <b>{numeros.hoje}</b>
            </div>
            <div className="kpi">
              <span>Últimos 7 dias</span>
              <b>{numeros.semana}</b>
            </div>
            <div className="kpi">
              <span>Total</span>
              <b>{numeros.total}</b>
            </div>
            <div className="kpi">
              <span>Por telefone</span>
              <b>
                {numeros.total
                  ? `${Math.round((numeros.telefone / numeros.total) * 100)}%`
                  : '—'}
              </b>
            </div>
          </section>

          {leads.length === 0 ? (
            <div className="vazio">
              <h2>Nenhum lead ainda</h2>
              <p>
                Quando alguém deixar nome e contato no chat, aparece aqui.
                Confira se o widget já está no seu site.
              </p>
              <Link className="btn-sec" to="/instalar">
                Instalar no site
              </Link>
            </div>
          ) : (
            <>
              <div className="filtros">
                <div role="group" aria-label="Filtrar por tipo de contato">
                  {FILTROS.map((f) => (
                    <button
                      key={f.valor}
                      type="button"
                      className={`filtro${filtro === f.valor ? ' on' : ''}`}
                      aria-pressed={filtro === f.valor}
                      onClick={() => setFiltro(f.valor)}
                    >
                      {f.nome}
                    </button>
                  ))}
                </div>
                <input
                  className="busca"
                  type="search"
                  placeholder="Buscar por nome, contato ou interesse"
                  aria-label="Buscar leads"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>

              {visiveis.length === 0 ? (
                <p className="aviso" role="status">
                  Nenhum lead com esse filtro.
                </p>
              ) : (
                <table className="tabela">
                  <thead>
                    <tr>
                      <th scope="col">Nome</th>
                      <th scope="col">Contato</th>
                      <th scope="col">Interesse</th>
                      <th scope="col">Quando</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map((l) => (
                      <LinhaLead key={l.id} lead={l} />
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function LinhaLead({ lead }: { lead: Lead }) {
  const a = avatar(lead.nome);
  const telefone = lead.tipoContato === 'telefone';
  const href = telefone
    ? `tel:+55${lead.contato.replace(/\D/g, '')}`
    : `mailto:${lead.contato}`;
  return (
    <tr>
      <td className="c-nome">
        <span className="av" style={{ background: a.cor }} aria-hidden="true">
          {a.letra}
        </span>
        {ehHoje(lead.criadoEm) && <i className="novo" title="Chegou hoje" />}
        {lead.nome}
      </td>
      <td className="c-contato">
        <a href={href}>{formatarContato(lead)}</a>
        <span className={`tipo ${telefone ? 'tel' : 'mail'}`}>
          {telefone ? 'telefone' : 'e-mail'}
        </span>
      </td>
      <td className="c-interesse">{lead.interesse || '—'}</td>
      <td className="c-quando">
        <time dateTime={lead.criadoEm}>{quando(lead.criadoEm)}</time>
      </td>
    </tr>
  );
}
