import { useId } from 'react';

interface Props {
  rotulo: string;
  valor: string;
  mudar(v: string): void;
  erro?: string;
  dica?: string;
  tipo?: string;
  autoComplete?: string;
  /** Vira textarea com essa altura em linhas. */
  linhas?: number;
  maximo?: number;
  classe?: string;
}

/** Rótulo + campo + nota (erro em vermelho ou dica), ligados por aria. */
export function Campo({
  rotulo,
  valor,
  mudar,
  erro,
  dica,
  tipo = 'text',
  autoComplete,
  linhas,
  maximo,
  classe,
}: Props) {
  const id = useId();
  const nota = erro ?? dica;
  const comum = {
    id,
    value: valor,
    maxLength: maximo,
    'aria-invalid': erro ? true : undefined,
    'aria-describedby': nota ? `${id}-nota` : undefined,
  };
  return (
    <div className={`campo${classe ? ` ${classe}` : ''}`}>
      <label htmlFor={id}>{rotulo}</label>
      {linhas ? (
        <textarea
          {...comum}
          className="inp"
          rows={linhas}
          onChange={(e) => mudar(e.target.value)}
        />
      ) : (
        <input
          {...comum}
          className="inp"
          type={tipo}
          autoComplete={autoComplete}
          onChange={(e) => mudar(e.target.value)}
        />
      )}
      {nota && (
        <small id={`${id}-nota`} className={erro ? 'erro' : undefined}>
          {nota}
        </small>
      )}
    </div>
  );
}
