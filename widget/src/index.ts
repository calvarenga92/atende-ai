/**
 * Ponto de entrada do widget. A empresa cola no site:
 *
 *   <script src="https://<api>/widget.js" data-empresa="padaria-demo" async></script>
 *
 * O endereço da API sai do próprio `src` do script (ou de `data-api`, se a API morar
 * em outro lugar). Se a empresa não existir ou a API estiver fora, o widget não aparece:
 * o site do cliente nunca fica com um chat quebrado.
 */
import { criarApi } from './api.js';
import { criarMemoria } from './memoria.js';
import { montarWidget } from './widget.js';

function acharScript(): HTMLScriptElement | null {
  const atual = document.currentScript;
  if (atual instanceof HTMLScriptElement && atual.dataset.empresa) return atual;
  return document.querySelector<HTMLScriptElement>('script[data-empresa][src*="widget"]');
}

async function iniciar(script: HTMLScriptElement) {
  if (document.getElementById('atende-ai-widget')) return; // script colado duas vezes
  const slug = script.dataset.empresa ?? '';
  const base = (script.dataset.api ?? new URL(script.src, location.href).origin).replace(/\/$/, '');
  const api = criarApi(base, slug);
  try {
    const config = await api.config();
    montarWidget({ config, api, memoria: criarMemoria(slug) });
  } catch (erro) {
    console.warn('[Atende AI] widget desligado:', erro instanceof Error ? erro.message : erro);
  }
}

const script = acharScript();
if (!script) {
  console.warn('[Atende AI] faltou o atributo data-empresa na tag <script> do widget.');
} else if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void iniciar(script), { once: true });
} else {
  void iniciar(script);
}
