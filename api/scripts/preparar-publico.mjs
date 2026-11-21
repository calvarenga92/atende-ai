// Monta api/public/ para a Vercel, que serve arquivos estáticos só dessa pasta
// (o express.static do configurar-app.ts vale apenas local).
// Leva as páginas de publico/ e o widget já gerado em ../widget/dist.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';

const widget = '../widget/dist/widget.js';
if (!existsSync(widget)) {
  console.error('Falta o widget: rode `npm run build` em ../widget antes.');
  process.exit(1);
}

rmSync('public', { recursive: true, force: true });
mkdirSync('public');
cpSync('publico', 'public', { recursive: true });
cpSync(widget, 'public/widget.js');
console.log('public/ pronto: páginas + widget.js');
