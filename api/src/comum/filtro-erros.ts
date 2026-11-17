import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { CodigoErro, ErroAplicacao } from './erro-aplicacao.js';

const CODIGO_POR_STATUS: Partial<Record<number, CodigoErro>> = {
  [HttpStatus.BAD_REQUEST]: 'DADOS_INVALIDOS',
  [HttpStatus.NOT_FOUND]: 'NAO_ENCONTRADO',
  [HttpStatus.CONFLICT]: 'CONFLITO',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'DADOS_INVALIDOS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'FALHA_TRANSITORIA',
};

/** Toda resposta de erro sai como `{ codigo, mensagem, campos? }`. Nada de stack trace para fora. */
@Catch()
export class FiltroErros implements ExceptionFilter {
  private readonly log = new Logger(FiltroErros.name);

  catch(excecao: unknown, host: ArgumentsHost): void {
    const resposta = host.switchToHttp().getResponse<Response>();
    const { status, corpo } = this.traduzir(excecao);

    if (status >= 500) {
      this.log.error(
        excecao instanceof Error ? excecao.stack : String(excecao),
      );
    }
    // Chat em streaming: se os cabeçalhos já saíram, só resta encerrar.
    if (resposta.headersSent) {
      resposta.end();
      return;
    }
    resposta.status(status).json(corpo);
  }

  traduzir(excecao: unknown): {
    status: number;
    corpo: {
      codigo: CodigoErro;
      mensagem: string;
      campos?: Record<string, string>;
    };
  } {
    if (excecao instanceof ErroAplicacao) {
      return {
        status: excecao.status,
        corpo: {
          codigo: excecao.codigo,
          mensagem: excecao.message,
          campos: excecao.campos,
        },
      };
    }
    if (excecao instanceof HttpException) {
      const status = excecao.getStatus();
      const codigo =
        CODIGO_POR_STATUS[status] ??
        (status >= 500 ? 'FALHA_TRANSITORIA' : 'ERRO_DESCONHECIDO');
      return { status, corpo: { codigo, mensagem: excecao.message } };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      corpo: {
        codigo: 'ERRO_DESCONHECIDO',
        mensagem: 'Algo deu errado. Tente de novo.',
      },
    };
  }
}
