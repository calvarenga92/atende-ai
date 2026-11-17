import { Logger, Module } from '@nestjs/common';
import { lerAmbiente } from '../config/ambiente.js';
import { ProvedorAnthropic } from './provedor-anthropic.js';
import { PROVEDOR_IA, type ProvedorIa } from './provedor-ia.js';
import { ProvedorOllama } from './provedor-ollama.js';
import { ProvedorSimulado } from './provedor-simulado.js';

/** Escolhe a IA pela variável IA_PROVEDOR. O resto do código só conhece a interface. */
@Module({
  providers: [
    {
      provide: PROVEDOR_IA,
      useFactory: (): ProvedorIa => {
        const { ia } = lerAmbiente();
        const provedor =
          ia.provedor === 'ollama'
            ? new ProvedorOllama(ia.ollama.url, ia.ollama.modelo)
            : ia.provedor === 'anthropic'
              ? new ProvedorAnthropic(ia.anthropic.modelo, ia.anthropic.esforco)
              : new ProvedorSimulado();
        new Logger('IaModule').log(`IA: ${provedor.nome}`);
        return provedor;
      },
    },
  ],
  exports: [PROVEDOR_IA],
})
export class IaModule {}
