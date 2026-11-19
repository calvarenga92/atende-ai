/**
 * CSS do widget. Vive dentro de um Shadow DOM: o site do cliente não quebra o
 * widget, e o widget não vaza estilo para o site. As cores vêm de variáveis
 * definidas a partir da cor da empresa (ver cores.ts).
 */
export const ESTILOS = /* css */ `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; }
.raiz {
  --sombra: 0 24px 48px -24px rgba(28, 25, 23, .45);
  font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: #1c1917;
  position: fixed; right: 24px; bottom: 24px; z-index: 2147483000;
  display: flex; flex-direction: column; align-items: flex-end; gap: 16px;
}
button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
button:focus-visible { outline: 3px solid var(--base); outline-offset: 2px; }
.entrada input:focus { outline: none; border-color: var(--base); background: #fff; }

/* ---------- bolha ---------- */
.canto { display: flex; align-items: flex-end; gap: 14px; }
.bolha {
  width: 64px; height: 64px; border-radius: 50%;
  background: linear-gradient(135deg, var(--clara), var(--escura));
  color: var(--sobre-base); display: grid; place-items: center;
  box-shadow: 0 14px 28px -10px var(--escura);
  transition: transform .15s ease;
}
.bolha:hover { transform: scale(1.05); }
.bolha svg { width: 30px; height: 30px; }
.dica {
  position: relative; max-width: 240px; padding: 14px 34px 14px 18px;
  border-radius: 18px 18px 4px 18px; background: #fff; box-shadow: var(--sombra);
  font-size: 14px; color: #292524;
}
.dica b { display: block; }
.dica .x-dica { position: absolute; top: 6px; right: 8px; width: 24px; height: 24px; border-radius: 50%; color: #78716c; }

/* ---------- janela ---------- */
.janela {
  width: 380px; height: min(640px, calc(100vh - 120px));
  border-radius: 24px; overflow: hidden; background: #fff; box-shadow: var(--sombra);
  display: flex; flex-direction: column;
}
.janela[hidden] { display: none; }
.topo {
  display: flex; align-items: center; gap: 12px; padding: 18px 16px 18px 20px;
  background: linear-gradient(135deg, var(--base), var(--escura)); color: var(--sobre-base);
}
.av {
  width: 42px; height: 42px; border-radius: 50%; background: #fff; color: var(--escura);
  display: grid; place-items: center; font-weight: 800; font-size: 18px; flex: none;
}
.nome { flex: 1; min-width: 0; }
.nome b { display: block; font-size: 16px; }
.nome span { font-size: 12.5px; opacity: .92; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.on { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #bbf7d0; margin-right: 6px; }
.fechar { width: 36px; height: 36px; border-radius: 50%; font-size: 24px; line-height: 1; }
.fechar:hover { background: rgba(255, 255, 255, .18); }

.corpo {
  flex: 1; overflow-y: auto; padding: 18px 16px; background: var(--fundo);
  display: flex; flex-direction: column; gap: 10px;
}
.msg { max-width: 82%; padding: 10px 14px; white-space: pre-wrap; overflow-wrap: anywhere; }
.msg.bot { align-self: flex-start; background: #fff; border: 1px solid var(--borda); border-radius: 4px 18px 18px 18px; }
.msg.eu { align-self: flex-end; background: var(--base); color: var(--sobre-base); border-radius: 18px 4px 18px 18px; }
.cursor::after {
  content: ""; display: inline-block; width: 7px; height: 15px; margin-left: 3px; vertical-align: -2px;
  border-radius: 2px; background: var(--base); animation: piscar 1s steps(2) infinite;
}
.sugestoes { display: flex; flex-wrap: wrap; gap: 8px; }
.sugestao {
  padding: 8px 13px; border-radius: 999px; border: 1.5px solid var(--clara);
  background: #fff; color: var(--escura); font-size: 14px; font-weight: 600;
}
.sugestao:hover { background: var(--fundo); }
.lead {
  align-self: center; display: flex; align-items: center; gap: 7px; padding: 7px 13px;
  border-radius: 999px; background: #dcfce7; color: #166534; font-size: 13px; font-weight: 700;
}
.lead svg { width: 14px; height: 14px; }
.digitando {
  align-self: flex-start; display: flex; gap: 5px; padding: 14px 16px;
  background: #fff; border: 1px solid var(--borda); border-radius: 4px 18px 18px 18px;
}
.digitando i { width: 8px; height: 8px; border-radius: 50%; background: var(--clara); animation: pular 1.2s infinite ease-in-out; }
.digitando i:nth-child(2) { animation-delay: .15s; }
.digitando i:nth-child(3) { animation-delay: .3s; }
.falha {
  display: flex; flex-direction: column; gap: 10px; padding: 13px 15px; border-radius: 16px;
  background: #ffe4e6; border: 1px solid #fecdd3; color: #9f1239; font-size: 14px;
}
.falha b { font-size: 15px; }
.falha button { align-self: flex-start; padding: 7px 14px; border-radius: 999px; background: #be123c; color: #fff; font-weight: 700; font-size: 13px; }

.entrada { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-top: 1px solid var(--borda); background: #fff; }
.entrada input {
  flex: 1; min-width: 0; padding: 12px 16px; border-radius: 999px; border: 1px solid transparent;
  background: var(--fundo); font: inherit; color: #1c1917;
}
.entrada input::placeholder { color: #78716c; }
.enviar {
  width: 42px; height: 42px; border-radius: 50%; flex: none; background: var(--base); color: var(--sobre-base);
  display: grid; place-items: center;
}
.enviar:disabled { opacity: .4; cursor: default; }
.enviar svg { width: 20px; height: 20px; }
.rodape { text-align: center; font-size: 11px; color: #78716c; padding: 0 12px 9px; background: #fff; }

@keyframes piscar { to { visibility: hidden; } }
@keyframes pular { 0%, 60%, 100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-4px); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .bolha, .digitando i, .cursor::after { animation: none; transition: none; }
}

/* Celular: a janela ocupa a tela toda, a bolha some enquanto ela está aberta. */
@media (max-width: 480px) {
  .raiz { right: 16px; bottom: 16px; }
  .raiz.aberta { inset: 0; }
  .raiz.aberta .canto { display: none; }
  .janela { position: fixed; inset: 0; width: 100%; height: 100%; border-radius: 0; }
}
`;
