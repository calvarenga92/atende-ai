import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CriarEsquema1763380000000 } from './banco/migracoes/1763380000000-criar-esquema.js';
import { CriarLeads1763400000000 } from './banco/migracoes/1763400000000-criar-leads.js';
import { SugestoesEmpresa1763500000000 } from './banco/migracoes/1763500000000-sugestoes-empresa.js';
import { ChatModule } from './chat/chat.module.js';
import { lerAmbiente } from './config/ambiente.js';
import { EmpresasModule } from './empresas/empresas.module.js';
import { SaudeController } from './saude/saude.controller.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: lerAmbiente().urlBanco,
        autoLoadEntities: true,
        // Esquema muda só por migração; synchronize apagaria dado em produção.
        synchronize: false,
        migrations: [
          CriarEsquema1763380000000,
          CriarLeads1763400000000,
          SugestoesEmpresa1763500000000,
        ],
        migrationsRun: true,
        retryAttempts: 3,
      }),
    }),
    EmpresasModule,
    ChatModule,
  ],
  controllers: [SaudeController],
})
export class AppModule {}
