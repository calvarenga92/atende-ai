/**
 * Freio contra chute de senha: depois de MAX falhas na mesma chave (IP + e-mail)
 * dentro da janela, recusa até a janela passar. Em memória: basta com uma instância
 * da API; com várias, passa para o banco ou Redis.
 */
export class LimiteTentativas {
  private readonly falhas = new Map<string, { total: number; desde: number }>();

  constructor(
    private readonly max = 5,
    private readonly janelaMs = 15 * 60_000,
    private readonly agora: () => number = Date.now,
  ) {}

  /** Minutos que faltam para liberar, ou 0 se pode tentar. */
  bloqueado(chave: string): number {
    const f = this.falhas.get(chave);
    if (!f) return 0;
    const resta = f.desde + this.janelaMs - this.agora();
    if (resta <= 0) {
      this.falhas.delete(chave);
      return 0;
    }
    return f.total >= this.max ? Math.ceil(resta / 60_000) : 0;
  }

  falhou(chave: string): void {
    this.bloqueado(chave); // limpa janela vencida
    const f = this.falhas.get(chave);
    if (f) f.total++;
    else this.falhas.set(chave, { total: 1, desde: this.agora() });
    if (this.falhas.size > 10_000) this.limpar();
  }

  acertou(chave: string): void {
    this.falhas.delete(chave);
  }

  private limpar() {
    for (const chave of this.falhas.keys()) this.bloqueado(chave);
  }
}
