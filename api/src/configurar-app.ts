import type { INestApplication } from '@nestjs/common';
import express from 'express';
import { FiltroErros } from './comum/filtro-erros.js';

/**
 * Tudo que a aplicação precisa além dos módulos. Separado do main.ts
 * para os testes subirem a API exatamente como em produção.
 */
export function configurarApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new FiltroErros());
  // O chat é chamado pelo widget nos sites dos clientes, de qualquer origem.
  // Quando o painel admin tiver login (etapa 5), as rotas dele passam a usar CORS_ORIGENS.
  app.enableCors({
    origin: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  // Página de teste do chat: http://localhost:3100/teste.html
  app.use(express.static('publico'));
  app.enableShutdownHooks();
}
