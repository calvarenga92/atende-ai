import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Express } from 'express';
import { AppModule } from './app.module.js';
import { lerAmbiente } from './config/ambiente.js';
import { configurarApp } from './configurar-app.js';

let pronto: Promise<Express> | undefined;

/**
 * A API como função da Vercel (api/index.js): sobe o Nest uma vez por instância,
 * sem `listen`, e reaproveita nas chamadas seguintes enquanto a instância vive.
 */
export function obterApp(): Promise<Express> {
  pronto ??= (async () => {
    const servidor = express();
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(servidor),
    );
    configurarApp(app, lerAmbiente().origensCors);
    await app.init();
    return servidor;
  })().catch((erro: unknown) => {
    pronto = undefined; // a próxima chamada tenta de novo
    throw erro;
  });
  return pronto;
}
