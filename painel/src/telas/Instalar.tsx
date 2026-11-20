import { useState } from 'react';
import { API_URL } from '../api';
import { useLogado } from '../sessao';

export function Instalar() {
  const { empresa } = useLogado();
  const [copiado, setCopiado] = useState(false);
  const tag = `<script src="${API_URL}/widget.js" data-empresa="${empresa.slug}" async></script>`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(tag);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência: o texto fica selecionável.
    }
  }

  return (
    <>
      <header className="cab">
        <div>
          <h1>Instalar no site</h1>
          <p>
            Uma linha, colada antes do <code>&lt;/body&gt;</code> de cada página
            onde {empresa.nomeBot} deve aparecer.
          </p>
        </div>
      </header>

      <section className="instalar">
        <pre className="codigo" tabIndex={0} aria-label="Tag do widget">
          {tag}
        </pre>
        <div className="acoes">
          <button
            type="button"
            className="btn-pri"
            onClick={() => void copiar()}
          >
            Copiar
          </button>
          <span role="status" aria-live="polite" className="status">
            {copiado ? 'Copiado.' : ''}
          </span>
        </div>

        <ol className="passos">
          <li>
            <b>Cole a tag no site.</b> Em WordPress, Wix ou similar, use o campo
            de "código no rodapé" ou "scripts personalizados".
          </li>
          <li>
            <b>Abra o site.</b> A bolha do chat aparece no canto, com a cor que
            você escolheu em "Bot e base".
          </li>
          <li>
            <b>Mudou algo no painel?</b> Não precisa trocar a tag: vale na
            próxima mensagem.
          </li>
        </ol>

        <p className="nota">
          O widget fica isolado do resto da página: o CSS do site não muda o
          chat, e o do chat não muda o site. Se a API estiver fora do ar, ele
          simplesmente não aparece.
        </p>
      </section>
    </>
  );
}
