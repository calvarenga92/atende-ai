import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversa } from '../conversas/conversa.entity.js';
import { Mensagem } from '../conversas/mensagem.entity.js';
import { EmpresasModule } from '../empresas/empresas.module.js';
import { IaModule } from '../ia/ia.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';

@Module({
  imports: [
    IaModule,
    EmpresasModule,
    TypeOrmModule.forFeature([Conversa, Mensagem]),
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
