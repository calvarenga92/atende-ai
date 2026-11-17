export type CodigoErro =
  | 'NAO_ENCONTRADO'
  | 'DADOS_INVALIDOS'
  | 'CONFLITO'
  | 'FALHA_TRANSITORIA'
  | 'ERRO_DESCONHECIDO';

/**
 * Erro de regra de negócio. Quem consome decide pelo `codigo`, nunca pelo texto,
 * então o código é o contrato e a mensagem é só para a pessoa ler.
 */
export class ErroAplicacao extends Error {
  constructor(
    readonly status: number,
    readonly codigo: CodigoErro,
    mensagem: string,
    readonly campos?: Record<string, string>,
  ) {
    super(mensagem);
    this.name = 'ErroAplicacao';
  }
}

/** Mensagem completa, para concordar em gênero: "Empresa não encontrada." */
export const naoEncontrado = (mensagem: string) =>
  new ErroAplicacao(404, 'NAO_ENCONTRADO', mensagem);

export const dadosInvalidos = (campos: Record<string, string>) =>
  new ErroAplicacao(
    422,
    'DADOS_INVALIDOS',
    'Confira os campos destacados.',
    campos,
  );

export const conflito = (mensagem: string) =>
  new ErroAplicacao(409, 'CONFLITO', mensagem);
