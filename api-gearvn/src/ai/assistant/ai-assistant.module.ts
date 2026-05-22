import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Product, ProductSchema } from '../../product/product.schema';
import { Event, EventSchema } from '../../event/event.schema';
import { Order, OrderSchema } from '../../order/order.schema';
import { Voucher, VoucherSchema } from '../../voucher/voucher.schema';
import { SupportTicketModule } from '../../support-ticket/support-ticket.module';
import { OpenRouterBgeM3Client } from '../embeddings/openrouter-bge-m3.client';
import { DeepSeekQueryRewriteClient } from '../retrieval/deepseek-query-rewrite.client';
import { ProductComboRetrievalService } from '../retrieval/product-combo-retrieval.service';
import { ProductLexicalSearchService } from '../retrieval/product-lexical-search.service';
import { ProductQueryRewriteService } from '../retrieval/product-query-rewrite.service';
import { ProductRetriever } from '../retrieval/product-retriever';
import { QdrantProductsClient } from '../vector/qdrant-products.client';
import {
  AssistantSession,
  AssistantSessionSchema,
} from './assistant-session.schema';
import { AssistantSessionService } from './assistant-session.service';
import { AssistantTraceService } from './assistant-trace.service';
import {
  AssistantService,
  SHOPPING_ASSISTANT_GRAPH_INVOKER,
} from './assistant.service';
import { shoppingAssistantGraph } from './shopping-assistant.graph';
import { ProductCatalogAdapter } from './adapters/product-catalog.adapter';
import { ReviewSearchClient } from './adapters/review-search.client';
import { AssistantActionAdapter } from './adapters/assistant-action.adapter';
import { VoucherAdapter } from './adapters/voucher.adapter';
import { OrderLookupAdapter } from './adapters/order.adapter';
import { SupportHandoffAdapter } from './adapters/support-handoff.adapter';
import { StaffHandoffSummaryService } from './staff-handoff-summary.service';
import { AssistantResponseComposer } from './assistant-response-composer.service';
import {
  CustomerAssistantProfile,
  CustomerAssistantProfileSchema,
} from './memory/customer-assistant-profile.schema';
import { CustomerAssistantProfileService } from './memory/customer-assistant-profile.service';
import { MemoryExtractorService } from './memory/memory-extractor.service';
import { GuardrailService } from './tools/guardrail.service';
import { OrderToolsService } from './tools/order-tools.service';
import { ResponseMergerService } from './response/response-merger.service';
import { ProductContextResolver } from './resolvers/product-context.resolver';
@Module({
  imports: [
    SupportTicketModule,
    MongooseModule.forFeature([
      { name: AssistantSession.name, schema: AssistantSessionSchema },
      {
        name: CustomerAssistantProfile.name,
        schema: CustomerAssistantProfileSchema,
      },
      { name: Product.name, schema: ProductSchema },
      { name: Event.name, schema: EventSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Voucher.name, schema: VoucherSchema },
    ]),
  ],
  providers: [
    AssistantSessionService,
    AssistantTraceService,
    CustomerAssistantProfileService,
    MemoryExtractorService,
    AssistantService,
    OpenRouterBgeM3Client,
    QdrantProductsClient,
    ProductLexicalSearchService,
    DeepSeekQueryRewriteClient,
    ProductQueryRewriteService,
    ProductComboRetrievalService,
    {
      provide: ProductRetriever,
      useFactory: (
        embedder: OpenRouterBgeM3Client,
        vector: QdrantProductsClient,
        lexical: ProductLexicalSearchService,
        queryRewrite: ProductQueryRewriteService,
        comboRetrieval: ProductComboRetrievalService,
      ) =>
        new ProductRetriever(
          embedder,
          vector,
          lexical,
          queryRewrite,
          comboRetrieval,
        ),
      inject: [
        OpenRouterBgeM3Client,
        QdrantProductsClient,
        ProductLexicalSearchService,
        ProductQueryRewriteService,
        ProductComboRetrievalService,
      ],
    },
    {
      provide: SHOPPING_ASSISTANT_GRAPH_INVOKER,
      useValue: shoppingAssistantGraph.invoke.bind(shoppingAssistantGraph),
    },
    ProductCatalogAdapter,
    ProductContextResolver,
    ReviewSearchClient,
    AssistantActionAdapter,
    VoucherAdapter,
    OrderLookupAdapter,
    SupportHandoffAdapter,
    StaffHandoffSummaryService,
    AssistantResponseComposer,
    ResponseMergerService,
    GuardrailService,
    OrderToolsService,
  ],
  exports: [
    AssistantSessionService,
    AssistantTraceService,
    CustomerAssistantProfileService,
    MemoryExtractorService,
    AssistantService,
    ProductCatalogAdapter,
    ProductContextResolver,
    ReviewSearchClient,
    AssistantActionAdapter,
    VoucherAdapter,
    OrderLookupAdapter,
    SupportHandoffAdapter,
    StaffHandoffSummaryService,
    AssistantResponseComposer,
    ResponseMergerService,
    GuardrailService,
    OrderToolsService,
  ],
})
export class AiAssistantModule {}
