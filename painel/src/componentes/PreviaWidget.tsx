import type { CSSProperties } from 'react';
import { montarPaleta } from '../../../widget/src/cores';
import type { DadosBot } from '../tipos';

interface Props {
  bot: DadosBot;
  nomeEmpresa: string;
}

/**
 * Prévia estática do widget com o que está no formulário (antes de salvar).
 * A paleta vem do próprio widget, então a cor e o contraste saem iguais aos do site.
 */
export function PreviaWidget({ bot, nomeEmpresa }: Props) {
  const p = montarPaleta(bot.corPrimaria);
  const vars = {
    '--w-base': p.base,
    '--w-clara': p.clara,
    '--w-escura': p.escura,
    '--w-fundo': p.fundo,
    '--w-borda': p.borda,
    '--w-sobre': p.sobreBase,
  } as CSSProperties;
  const sugestoes = bot.sugestoes.map((s) => s.trim()).filter(Boolean);

  return (
    <figure className="previa" aria-label="Prévia do widget">
      <figcaption>Prévia ao vivo</figcaption>
      <div className="w" style={vars}>
        <div className="w-topo">
          <span className="w-av" aria-hidden="true">
            {(bot.nomeBot.trim()[0] ?? '?').toUpperCase()}
          </span>
          <div>
            <b>{bot.nomeBot.trim() || 'Assistente'}</b>
            <small>{nomeEmpresa} · online</small>
          </div>
        </div>
        <div className="w-corpo">
          <p className="w-msg bot">
            {bot.mensagemBoasVindas.trim() || 'Olá! Como posso ajudar?'}
          </p>
          {sugestoes.length > 0 && (
            <div className="w-sugestoes">
              {sugestoes.map((s) => (
                <span key={s} className="w-chip">
                  {s}
                </span>
              ))}
            </div>
          )}
          <p className="w-msg eu">{sugestoes[0] ?? 'Vocês abrem domingo?'}</p>
          <p className="w-msg bot digitando" aria-label="digitando">
            <i />
            <i />
            <i />
          </p>
        </div>
        <div className="w-campo">
          <span>Escreva sua mensagem…</span>
          <span className="w-env" aria-hidden="true">
            →
          </span>
        </div>
      </div>
    </figure>
  );
}
