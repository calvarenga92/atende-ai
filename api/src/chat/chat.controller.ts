import { Body, Controller, Get, Ip, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LimiteTentativas } from '../auth/limite-tentativas.js';
import { dadosInvalidos, muitasTentativas } from '../comum/erro-aplicacao.js';
import { ChatService, type EventoChat } from './chat.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CARACTERES = 2000;
/** Freio por visitante: protege a cota da IA (plano grátis) de quem dispara mensagens. */
const MAX_MENSAGENS_POR_IP = Number(process.env.CHAT_MAX_POR_IP ?? 30);
const JANELA_IP_MS = 10 * 60_000;

/** Rotas públicas, chamadas pelo widget no site da empresa. */
@Controller('chat/:slug')
export class ChatController {
  private readonly limite = new LimiteTentativas(
    MAX_MENSAGENS_POR_IP,
    JANELA_IP_MS,
  );

  constructor(private readonly chat: ChatService) {}

  @Get('config')
  config(@Param('slug') slug: string) {
    return this.chat.configuracaoPublica(slug);
  }

  /**
   * Corpo: `{ mensagem, conversaId? }`. Resposta em Server-Sent Events,
   * um `data: {json}` por EventoChat.
   */
  @Post()
  async enviar(
    @Param('slug') slug: string,
    @Body() corpo: unknown,
    @Ip() ip: string,
    @Res() res: Response,
  ) {
    const { mensagem, conversaId } = validar(corpo);
    const espera = this.limite.bloqueado(ip);
    if (espera) {
      throw muitasTentativas(
        `Muitas mensagens seguidas. Tente de novo em ${espera} min.`,
      );
    }
    this.limite.falhou(ip); // aqui "falhou" só conta a mensagem

    const cancelar = new AbortController();
    res.on('close', () => cancelar.abort());

    let abriu = false;
    const emitir = (evento: EventoChat) => {
      if (!abriu) {
        res.status(200).set({
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.flushHeaders();
        abriu = true;
      }
      res.write(`data: ${JSON.stringify(evento)}\n\n`);
    };

    await this.chat.responder(
      slug,
      conversaId,
      mensagem,
      emitir,
      cancelar.signal,
    );
    res.end();
  }
}

function validar(corpo: unknown): { mensagem: string; conversaId?: string } {
  const c = (
    typeof corpo === 'object' && corpo !== null ? corpo : {}
  ) as Record<string, unknown>;
  const erros: Record<string, string> = {};

  const mensagem = typeof c.mensagem === 'string' ? c.mensagem.trim() : '';
  if (!mensagem) erros.mensagem = 'Escreva uma mensagem.';
  else if (mensagem.length > MAX_CARACTERES)
    erros.mensagem = `Máximo de ${MAX_CARACTERES} caracteres.`;

  const conversaId = c.conversaId;
  if (
    conversaId !== undefined &&
    conversaId !== null &&
    (typeof conversaId !== 'string' || !UUID.test(conversaId))
  ) {
    erros.conversaId = 'Identificador de conversa inválido.';
  }

  if (Object.keys(erros).length) throw dadosInvalidos(erros);
  return {
    mensagem,
    conversaId: typeof conversaId === 'string' ? conversaId : undefined,
  };
}
