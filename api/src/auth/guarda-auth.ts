import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { naoAutenticado } from '../comum/erro-aplicacao.js';
import { AuthService, type UsuarioLogado } from './auth.service.js';

type RequisicaoLogada = Request & { usuario?: UsuarioLogado };

/** Exige `Authorization: Bearer <token>`. Sem cookie, então sem CSRF para tratar. */
@Injectable()
export class GuardaAuth implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest<RequisicaoLogada>();
    const token = extrairToken(req.headers.authorization);
    if (!token) throw naoAutenticado();
    req.usuario = await this.auth.autenticar(token);
    return true;
  }
}

export function extrairToken(cabecalho: string | undefined): string | null {
  const [tipo, token, ...resto] = (cabecalho ?? '').trim().split(/\s+/);
  if (tipo?.toLowerCase() !== 'bearer' || !token || resto.length) return null;
  // base64url de 32 bytes = 43 caracteres; recusa lixo antes de ir ao banco.
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

/** Quem está logado, já conferido pela GuardaAuth. */
export const UsuarioAtual = createParamDecorator(
  (_: unknown, contexto: ExecutionContext): UsuarioLogado => {
    const req = contexto.switchToHttp().getRequest<RequisicaoLogada>();
    if (!req.usuario) throw naoAutenticado();
    return req.usuario;
  },
);
