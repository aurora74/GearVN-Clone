import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import jwtConfig from '../auth/config/jwt.config';
import { Chat, ChatSchema } from './chat.schema';

import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatAuthService } from './chat-auth.service';
import { ChatController } from './chat.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { SupportTicketModule } from '../support-ticket/support-ticket.module';
import { AiAssistantModule } from '../ai/assistant/ai-assistant.module';

@Module({
  imports: [
    CloudinaryModule,
    SupportTicketModule,
    AiAssistantModule,
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    MongooseModule.forFeature([{ name: Chat.name, schema: ChatSchema }]),
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, ChatAuthService],
})
export class ChatModule {}
