import type { Repository } from 'typeorm';
import type { Conversa } from '../conversas/conversa.entity.js';
import type { Mensagem } from '../conversas/mensagem.entity.js';
import { EMPRESA_DEMO } from '../empresas/empresa-demo.js';
import type { Empresa } from '../empresas/empresa.entity.js';
import type { EmpresasService } from '../empresas/empresas.service.js';
import { ProvedorSimulado } from '../ia/provedor-simulado.js';
import type { Lead } from '../leads/lead.entity.js';
import { LeadsService } from '../leads/leads.service.js';
import { ChatService, type EventoChat } from './chat.service.js';

const empresa = { id: 'e1', ...EMPRESA_DEMO } as Empresa;

/** Repositório em memória com só o que o ChatService usa. */
function repoFalso<T extends object>() {
  const itens: T[] = [];
  return {
    itens,
    create: (d: Partial<T>) => ({ ...d }) as T,
    save: async <V>(v: V) => {
      const lista = (Array.isArray(v) ? v : [v]) as (T & { id?: unknown })[];
      for (const i of lista) {
        i.id ??= `id${itens.length + 1}`;
        itens.push(i);
      }
      return v;
    },
    find: async () => [] as T[],
    findOneBy: async () => null,
    upsert: async (d: T) => {
      itens.push(d);
    },
  };
}

function montar() {
  const leadsRepo = repoFalso<Lead>();
  const chat = new ChatService(
    { buscarPorSlug: async () => empresa } as unknown as EmpresasService,
    new LeadsService(leadsRepo as unknown as Repository<Lead>),
    new ProvedorSimulado(0),
    repoFalso<Conversa>() as unknown as Repository<Conversa>,
    repoFalso<Mensagem>() as unknown as Repository<Mensagem>,
  );
  return { chat, leads: leadsRepo.itens };
}

async function conversar(chat: ChatService, texto: string) {
  const eventos: EventoChat[] = [];
  await chat.responder(
    'padaria-demo',
    undefined,
    texto,
    (e) => eventos.push(e),
    new AbortController().signal,
  );
  return eventos.map((e) => e.tipo);
}

describe('ChatService', () => {
  it('avisa o widget com o evento lead quando o contato é salvo', async () => {
    const { chat, leads } = montar();
    const tipos = await conversar(chat, 'Me chamo Mariana, 11 97777-1234');

    expect(leads).toHaveLength(1);
    expect(tipos[0]).toBe('inicio');
    expect(tipos).toContain('lead');
    // A confirmação vem antes do texto final da IA e o stream termina normal.
    expect(tipos.indexOf('lead')).toBeLessThan(tipos.lastIndexOf('texto'));
    expect(tipos.at(-1)).toBe('fim');
  });

  it('não manda evento lead em conversa sem contato', async () => {
    const { chat, leads } = montar();
    const tipos = await conversar(chat, 'Vocês abrem domingo?');

    expect(leads).toHaveLength(0);
    expect(tipos).not.toContain('lead');
  });

  it('expõe as sugestões na configuração pública', async () => {
    const { chat } = montar();
    expect((await chat.configuracaoPublica('padaria-demo')).sugestoes).toEqual(
      EMPRESA_DEMO.sugestoes,
    );
  });
});
