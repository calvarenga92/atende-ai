import { type FormEvent, useMemo, useState } from 'react';
import { useBeforeUnload } from 'react-router';
import { API_URL, api, ErroApi } from '../api';
import { Campo } from '../componentes/Campo';
import { PreviaWidget } from '../componentes/PreviaWidget';
import { useLogado } from '../sessao';
import { type DadosBot, type Empresa, LIMITES } from '../tipos';

const CORES = [
  '#b45309',
  '#e11d48',
  '#7c3aed',
  '#0891b2',
  '#059669',
  '#1a1033',
];
const CAMPOS: (keyof DadosBot)[] = [
  'nomeBot',
  'tom',
  'instrucoes',
  'conhecimento',
  'mensagemBoasVindas',
  'corPrimaria',
  'sugestoes',
];

function rascunhoDe(e: Empresa): DadosBot {
  return {
    nomeBot: e.nomeBot,
    tom: e.tom,
    instrucoes: e.instrucoes,
    conhecimento: e.conhecimento,
    mensagemBoasVindas: e.mensagemBoasVindas,
    corPrimaria: e.corPrimaria,
    // Sempre 4 caixas no formulário; vazias não vão para a API.
    sugestoes: [...e.sugestoes, '', '', '', ''].slice(0, LIMITES.sugestoes),
  };
}

/** Só o que mudou, para o PATCH. */
export function diferencas(
  salvo: Empresa,
  rascunho: DadosBot,
): Partial<DadosBot> {
  const saida: Partial<DadosBot> = {};
  for (const campo of CAMPOS) {
    if (campo === 'sugestoes') {
      const novas = rascunho.sugestoes.map((s) => s.trim()).filter(Boolean);
      if (novas.join('\n') !== salvo.sugestoes.join('\n'))
        saida.sugestoes = novas;
    } else if (rascunho[campo].trim() !== salvo[campo].trim()) {
      saida[campo] = rascunho[campo];
    }
  }
  return saida;
}

type Status =
  | { tipo: 'ocioso' }
  | { tipo: 'salvando' }
  | { tipo: 'salvo' }
  | { tipo: 'erro'; mensagem: string };

export function Bot() {
  const { token, empresa, trocarEmpresa, expirou } = useLogado();
  const [rascunho, setRascunho] = useState(() => rascunhoDe(empresa));
  const [erros, setErros] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ tipo: 'ocioso' });

  const mudancas = useMemo(
    () => diferencas(empresa, rascunho),
    [empresa, rascunho],
  );
  const sujo = Object.keys(mudancas).length > 0;

  useBeforeUnload((e) => {
    if (sujo) e.preventDefault();
  });

  function mudar<K extends keyof DadosBot>(campo: K, valor: DadosBot[K]) {
    setRascunho((r) => ({ ...r, [campo]: valor }));
    setStatus({ tipo: 'ocioso' });
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!sujo) return;
    setErros({});
    setStatus({ tipo: 'salvando' });
    try {
      const nova = await api.salvarBot(token, mudancas);
      trocarEmpresa(nova);
      setRascunho(rascunhoDe(nova));
      setStatus({ tipo: 'salvo' });
    } catch (err) {
      if (err instanceof ErroApi && err.status === 401) return expirou();
      if (err instanceof ErroApi) setErros(err.campos);
      setStatus({
        tipo: 'erro',
        mensagem:
          err instanceof ErroApi
            ? err.message
            : 'Algo deu errado. Tente de novo.',
      });
    }
  }

  const corPersonalizada = !CORES.includes(rascunho.corPrimaria.toLowerCase());
  const caracteres = rascunho.conhecimento.length;

  return (
    <form className="tela-bot" onSubmit={(e) => void salvar(e)} noValidate>
      <header className="cab">
        <div>
          <h1>Bot e base de conhecimento</h1>
          <p>
            O que a assistente sabe e como ela fala. Salvou aqui, vale na
            próxima mensagem.
          </p>
        </div>
        <div className="acoes">
          <a
            className="btn-sec"
            href={`${API_URL}/teste.html?empresa=${encodeURIComponent(empresa.slug)}`}
            target="_blank"
            rel="noreferrer"
            title="Abre o chat com o que já está salvo"
          >
            Testar conversa
          </a>
          {sujo && (
            <button
              type="button"
              className="btn-sec"
              onClick={() => {
                setRascunho(rascunhoDe(empresa));
                setErros({});
                setStatus({ tipo: 'ocioso' });
              }}
            >
              Desfazer
            </button>
          )}
          <button
            type="submit"
            className="btn-pri"
            disabled={!sujo || status.tipo === 'salvando'}
          >
            {status.tipo === 'salvando' ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </header>

      <p className="status" role="status" aria-live="polite">
        {status.tipo === 'salvo' && 'Alterações salvas.'}
        {status.tipo === 'ocioso' && sujo && 'Há alterações não salvas.'}
      </p>
      {status.tipo === 'erro' && (
        <p className="erro-geral" role="alert">
          {status.mensagem}
        </p>
      )}

      <div className="cfg">
        <div className="form">
          <div className="duas">
            <Campo
              rotulo="Nome da assistente"
              valor={rascunho.nomeBot}
              mudar={(v) => mudar('nomeBot', v)}
              erro={erros.nomeBot}
              maximo={LIMITES.nomeBot}
            />
            <fieldset className="campo">
              <legend>Cor do widget</legend>
              <div className="cores">
                {CORES.map((c) => (
                  <label
                    key={c}
                    className="cor"
                    style={{ background: c }}
                    title={c}
                  >
                    <input
                      type="radio"
                      name="cor"
                      value={c}
                      checked={rascunho.corPrimaria.toLowerCase() === c}
                      onChange={() => mudar('corPrimaria', c)}
                      aria-label={`Cor ${c}`}
                    />
                  </label>
                ))}
                <label
                  className={`cor outra${corPersonalizada ? ' marcada' : ''}`}
                  title="Outra cor"
                >
                  <input
                    type="color"
                    value={rascunho.corPrimaria}
                    onChange={(e) => mudar('corPrimaria', e.target.value)}
                    aria-label="Outra cor"
                  />
                </label>
              </div>
              {erros.corPrimaria && (
                <small className="erro">{erros.corPrimaria}</small>
              )}
            </fieldset>
          </div>

          <Campo
            rotulo="Tom de voz"
            valor={rascunho.tom}
            mudar={(v) => mudar('tom', v)}
            erro={erros.tom}
            maximo={LIMITES.tom}
            dica='Ex.: "simpático e informal" ou "formal e objetivo".'
          />
          <Campo
            rotulo="Mensagem de boas-vindas"
            valor={rascunho.mensagemBoasVindas}
            mudar={(v) => mudar('mensagemBoasVindas', v)}
            erro={erros.mensagemBoasVindas}
            maximo={LIMITES.mensagemBoasVindas}
            linhas={2}
          />

          <fieldset className="campo">
            <legend>Sugestões de pergunta</legend>
            <div className="sugestoes">
              {rascunho.sugestoes.map((s, i) => (
                <input
                  key={i}
                  className="inp"
                  value={s}
                  maxLength={LIMITES.caracteresSugestao}
                  placeholder={i === 0 ? 'Ex.: Horários' : ''}
                  aria-label={`Sugestão ${i + 1}`}
                  onChange={(e) =>
                    mudar(
                      'sugestoes',
                      rascunho.sugestoes.map((x, j) =>
                        j === i ? e.target.value : x,
                      ),
                    )
                  }
                />
              ))}
            </div>
            <small className={erros.sugestoes ? 'erro' : undefined}>
              {erros.sugestoes ??
                `Atalhos embaixo das boas-vindas. Até ${LIMITES.sugestoes}, com ${LIMITES.caracteresSugestao} caracteres cada.`}
            </small>
          </fieldset>

          <Campo
            rotulo="Instruções extras"
            valor={rascunho.instrucoes}
            mudar={(v) => mudar('instrucoes', v)}
            erro={erros.instrucoes}
            maximo={LIMITES.instrucoes}
            linhas={3}
            dica="O que oferecer, o que evitar, para onde mandar pedidos."
          />
          <Campo
            rotulo="Base de conhecimento"
            classe="base"
            valor={rascunho.conhecimento}
            mudar={(v) => mudar('conhecimento', v)}
            erro={erros.conhecimento}
            maximo={LIMITES.conhecimento}
            linhas={12}
            dica={`${rascunho.nomeBot || 'A assistente'} responde só com o que está aqui. Fora disso, diz que não sabe e indica a equipe · ${caracteres.toLocaleString('pt-BR')} de ${LIMITES.conhecimento.toLocaleString('pt-BR')} caracteres`}
          />
        </div>

        <PreviaWidget bot={rascunho} nomeEmpresa={empresa.nome} />
      </div>
    </form>
  );
}
