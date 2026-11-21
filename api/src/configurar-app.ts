import type { INestApplication } from '@nestjs/common';
import type { CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import { join } from 'node:path';
import express from 'express';
import { FiltroErros } from './comum/filtro-erros.js';

/**
 * Tudo que a aplicação precisa além dos módulos. Separado do main.ts
 * para os testes subirem a API exatamente como em produção.
 */
export function configurarApp(
  app: INestApplication,
  origensPainel: string[],
): void {
  app.setGlobalPrefix('api');
  // Atrás do proxy da Vercel o IP do visitante vem no X-Forwarded-For (limites por IP).
  if (process.env.VERCEL) {
    (app as unknown as { set(k: string, v: unknown): void }).set(
      'trust proxy',
      true,
    );
  }
  app.useGlobalFilters(new FiltroErros());
  // O chat é chamado pelo widget nos sites dos clientes, de qualquer origem.
  // Login e painel só respondem às origens do painel (CORS_ORIGENS).
  const cors: CorsOptionsDelegate<{ url?: string }> = (req, pronto) =>
    pronto(null, {
      origin: rotaPublica(req.url ?? '') ? true : origensPainel,
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  app.enableCors(cors);
  // Páginas de teste e demo: http://localhost:3100/teste.html e /demo.html
  app.use(express.static('publico'));
  // O widget (gerado em ../widget com `npm run build`): /widget.js.
  // Cache curto: a empresa não precisa trocar a tag para receber a versão nova.
  app.use(
    express.static(join(process.cwd(), '..', 'widget', 'dist'), {
      maxAge: '5m',
      setHeaders: (res) =>
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
    }),
  );
  app.enableShutdownHooks();
}

/** Rotas que o widget chama de qualquer site. */
export function rotaPublica(url: string): boolean {
  return /^\/api\/(chat|saude)(\/|\?|$)/.test(url);
}
