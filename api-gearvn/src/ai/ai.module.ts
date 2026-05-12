import { Module } from '@nestjs/common';
import { AiAssistantModule } from './assistant/ai-assistant.module';
import { OpenRouterBgeM3Client } from './embeddings/openrouter-bge-m3.client';
import { QdrantProductsClient } from './vector/qdrant-products.client';

@Module({
  imports: [AiAssistantModule],
  providers: [OpenRouterBgeM3Client, QdrantProductsClient],
  exports: [AiAssistantModule, OpenRouterBgeM3Client, QdrantProductsClient],
})
export class AiModule {}
