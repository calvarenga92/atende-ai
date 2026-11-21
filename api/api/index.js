// Função da Vercel: toda rota /api/* cai aqui (rewrite no vercel.json)
// e vai para o Nest já compilado em dist/ pelo `npm run build`.
import { obterApp } from '../dist/vercel.js';

export default async function handler(req, res) {
  const app = await obterApp();
  app(req, res);
}
