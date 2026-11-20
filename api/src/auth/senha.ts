import {
  createHash,
  randomBytes,
  scrypt,
  type ScryptOptions,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Senhas com scrypt, do próprio Node (sem dependência nativa).
 * Formato guardado: `scrypt$N$r$p$sal$hash`, para dar para subir o custo
 * depois sem invalidar as senhas antigas.
 */
const CUSTO = { N: 16384, r: 8, p: 1 };
const TAMANHO = 64;

function derivar(senha: string, sal: Buffer, opcoes: ScryptOptions) {
  return new Promise<Buffer>((ok, falha) =>
    scrypt(senha, sal, TAMANHO, opcoes, (erro, chave) =>
      erro ? falha(erro) : ok(chave),
    ),
  );
}

export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const chave = await derivar(senha, sal, CUSTO);
  return [
    'scrypt',
    CUSTO.N,
    CUSTO.r,
    CUSTO.p,
    sal.toString('base64'),
    chave.toString('base64'),
  ].join('$');
}

export async function conferirSenha(
  senha: string,
  guardado: string,
): Promise<boolean> {
  const partes = guardado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [N, r, p] = partes.slice(1, 4).map(Number);
  const sal = Buffer.from(partes[4], 'base64');
  const esperado = Buffer.from(partes[5], 'base64');
  if (!N || !r || !p || esperado.length !== TAMANHO) return false;
  const chave = await derivar(senha, sal, { N, r, p });
  return timingSafeEqual(chave, esperado);
}

/** Hash de uma senha qualquer, para gastar o mesmo tempo quando o e-mail não existe. */
export const HASH_FALSO = gerarHashSenha(randomBytes(12).toString('hex'));

/** Token opaco de sessão: 256 bits aleatórios, em base64url. */
export function gerarToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
