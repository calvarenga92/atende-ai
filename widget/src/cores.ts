/**
 * O widget veste a cor da empresa. A partir de uma cor só (#RRGGBB), monta o resto:
 * o gradiente do topo, o fundo claro da conversa e a cor de texto que dá contraste.
 */
export interface Paleta {
  base: string;
  clara: string;
  escura: string;
  fundo: string;
  borda: string;
  /** Texto sobre a cor base: branco ou quase preto, o que tiver mais contraste. */
  sobreBase: string;
}

const PADRAO = '#4f46e5';

function rgb(hex: string): [number, number, number] {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex : PADRAO;
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function hex([r, g, b]: number[]): string {
  return (
    '#' +
    [r, g, b]
      .map((v) =>
        Math.round(Math.min(255, Math.max(0, v)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** Mistura a cor com outra (0 = original, 1 = a outra). */
function misturar(cor: [number, number, number], com: number, peso: number) {
  return hex(cor.map((v) => v + (com - v) * peso));
}

/** Luminância relativa do WCAG 2. */
export function luminancia(cor: string): number {
  const [r, g, b] = rgb(cor).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const BRANCO = '#ffffff';
const ESCURO = '#1c1917';

export function montarPaleta(cor: string): Paleta {
  const c = rgb(cor);
  const base = hex(c);
  return {
    base,
    clara: misturar(c, 255, 0.25),
    escura: misturar(c, 0, 0.25),
    fundo: misturar(c, 255, 0.95),
    borda: misturar(c, 255, 0.8),
    sobreBase:
      contraste(base, BRANCO) >= contraste(base, ESCURO) ? BRANCO : ESCURO,
  };
}
