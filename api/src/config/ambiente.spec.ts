import { lerAmbiente } from './ambiente.js';

const base = { DATABASE_URL: 'postgres://x' };

describe('lerAmbiente', () => {
  it('usa os padrões: IA simulada, que não gasta nada', () => {
    const a = lerAmbiente(base);
    expect(a.porta).toBe(3100);
    expect(a.ia.provedor).toBe('simulado');
    expect(a.ia.ollama).toEqual({
      url: 'http://localhost:11434',
      modelo: 'qwen3:8b',
    });
    expect(a.ia.anthropic).toEqual({
      modelo: 'claude-opus-5-5',
      esforco: 'low',
    });
  });

  it('exige DATABASE_URL', () => {
    expect(() => lerAmbiente({})).toThrow(/DATABASE_URL/);
  });

  it('recusa provedor e esforço desconhecidos', () => {
    expect(() => lerAmbiente({ ...base, IA_PROVEDOR: 'gpt' })).toThrow(
      /IA_PROVEDOR/,
    );
    expect(() => lerAmbiente({ ...base, ANTHROPIC_ESFORCO: 'turbo' })).toThrow(
      /ANTHROPIC_ESFORCO/,
    );
  });

  it('tira a barra final da URL do Ollama', () => {
    expect(
      lerAmbiente({ ...base, OLLAMA_URL: 'http://pc:11434/' }).ia.ollama.url,
    ).toBe('http://pc:11434');
  });
});
