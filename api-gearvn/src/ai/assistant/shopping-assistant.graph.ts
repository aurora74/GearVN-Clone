import { END, START, StateGraph } from '@langchain/langgraph';

import {
  AssistantGuardrailDecision,
  AssistantIntent,
  AssistantMode,
  AssistantSubgraphName,
  SupervisorDecision,
} from './assistant.types';
import {
  ShoppingAssistantState,
  ShoppingAssistantStateType,
  ShoppingAssistantStateUpdate,
} from './shopping-assistant.state';
import { responseMergerNode } from './nodes/response-merger.node';
import { SplitIntentsResult, splitIntentsNode } from './nodes/split-intents.node';
import { supervisorNode } from './supervisor/supervisor.node';
import { GuardrailService } from './tools/guardrail.service';
import { salesSubgraph } from './subgraphs/sales.graph';
import { orderSubgraph } from './subgraphs/order.graph';
import { generalSubgraph } from './subgraphs/general.graph';

export { responseMergerNode } from './nodes/response-merger.node';

type RouteNodeName =
  | 'split_intents'
  | 'product_advice'
  | 'review_summary'
  | 'cart_action'
  | 'checkout_prep'
  | 'order_lookup'
  | 'staff_handoff'
  | 'unsupported';

type RouteAfterClassificationInput = {
  primaryIntent?: AssistantIntent;
  intents?: AssistantIntent[];
  status?: string;
};

type GraphConfig = {
  configurable?: {
    guardrailService?: GuardrailService;
    classifier?: { classify(text: string): Promise<unknown> };
    supervisorModel?: {
      invoke(messages: Array<{ role: string; content: string }>): Promise<unknown>;
    };
    promptContext?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

export function routeAfterClassification(state: RouteAfterClassificationInput):
  | RouteNodeName
  | typeof END
  | {
      nodeName: 'split_intents';
      executionMode: SplitIntentsResult['executionMode'];
      orderedIntents: AssistantIntent[];
    } {
  if (state.status === 'staff_mode_paused') return END;
  const intents = state.intents?.length
    ? state.intents
    : state.primaryIntent
      ? [state.primaryIntent]
      : [AssistantIntent.UNSUPPORTED];

  if (intents.length > 1) {
    const split = splitIntentsNode({
      primaryIntent: state.primaryIntent,
      intents,
    });
    return {
      nodeName: 'split_intents',
      executionMode: split.executionMode,
      orderedIntents: split.orderedIntents,
    };
  }

  return nodeForIntent(intents[0]);
}

async function supervisorGraphNode(
  state: ShoppingAssistantStateType,
  config?: GraphConfig,
): Promise<ShoppingAssistantStateUpdate> {
  return supervisorNode(state, config);
}

function guardrailGraphNode(
  state: ShoppingAssistantStateType,
  config?: GraphConfig,
): ShoppingAssistantStateUpdate {
  if (state.status === 'staff_mode_paused') return {};
  const decision =
    state.supervisorDecision ??
    ({
      route: 'general',
      confidence: 0,
      intents: [AssistantIntent.UNSUPPORTED],
      fallbackReason: 'supervisor_model_failed',
    } satisfies SupervisorDecision);
  const service =
    config?.configurable?.guardrailService instanceof GuardrailService
      ? config.configurable.guardrailService
      : new GuardrailService();
  const validated = service.validateSupervisorDecision(state, decision);
  const split = splitIntentsNode({
    primaryIntent: validated.decision.intents[0],
    intents: validated.decision.intents,
  });
  const normalizedDecision = {
    ...validated.decision,
    intents: split.orderedIntents,
  };
  const metadata = guardrailMetadata(
    state,
    normalizedDecision,
    validated.guardrailDecision,
  );
  return {
    supervisorDecision: normalizedDecision,
    activeSubgraph: normalizedDecision.route,
    primaryIntent: split.orderedIntents[0] ?? AssistantIntent.UNSUPPORTED,
    intents: split.orderedIntents,
    orderedIntents: split.orderedIntents,
    executionMode: split.executionMode,
    metadata,
    traceEvents: [
      {
        roomId: state.roomId,
        node: 'guardrail',
        active_subgraph: normalizedDecision.route,
        guardrail_decision: validated.guardrailDecision,
        fallback_reason: normalizedDecision.fallbackReason ?? undefined,
      },
    ],
  };
}

async function salesGraphNode(
  state: ShoppingAssistantStateType,
  config?: GraphConfig,
): Promise<ShoppingAssistantStateUpdate> {
  const result = await salesSubgraph.invoke(state, config);
  return subgraphUpdate('sales', state, result);
}

async function orderGraphNode(
  state: ShoppingAssistantStateType,
  config?: GraphConfig,
): Promise<ShoppingAssistantStateUpdate> {
  const result = await orderSubgraph.invoke(state, config);
  return subgraphUpdate('order', state, result);
}

async function generalGraphNode(
  state: ShoppingAssistantStateType,
  config?: GraphConfig,
): Promise<ShoppingAssistantStateUpdate> {
  const result = await generalSubgraph.invoke(state, config);
  return subgraphUpdate('general', state, result);
}

async function multiRouteGraphNode(
  state: ShoppingAssistantStateType,
  config?: GraphConfig,
): Promise<ShoppingAssistantStateUpdate> {
  const split = splitIntentsNode({
    primaryIntent: state.primaryIntent,
    intents: state.orderedIntents?.length ? state.orderedIntents : state.intents,
  });
  const orderedIntents = split.orderedIntents;
  const responses: ShoppingAssistantStateType['responses'] = [];
  const actionDrafts: ShoppingAssistantStateType['actionDrafts'] = [];
  const toolResults: ShoppingAssistantStateType['toolResults'] = [];
  const traceEvents: ShoppingAssistantStateType['traceEvents'] = [];
  const routeTrace: ShoppingAssistantStateType['routeTrace'] = ['multi_route'];
  let current = state;

  for (const intent of orderedIntents) {
    const route =
      routesForIntents([intent])[0] ??
      state.activeSubgraph ??
      state.supervisorDecision?.route ??
      'general';
    const invocationState = {
      ...current,
      intents: [intent],
      primaryIntent: intent,
      activeSubgraph: route,
      orderedIntents: [intent],
    };
    const result = await invokeSubgraph(route, invocationState, config);
    const update = subgraphUpdate(route, invocationState, result);
    const nextResponses = (update.responses ?? []) as ShoppingAssistantStateType['responses'];
    const nextActionDrafts = (update.actionDrafts ?? []) as ShoppingAssistantStateType['actionDrafts'];
    const nextToolResults = (update.toolResults ?? []) as ShoppingAssistantStateType['toolResults'];
    const nextTraceEvents = (update.traceEvents ?? []) as ShoppingAssistantStateType['traceEvents'];
    const nextRouteTrace = (update.routeTrace ?? []) as ShoppingAssistantStateType['routeTrace'];

    responses.push(...nextResponses);
    actionDrafts.push(...nextActionDrafts);
    toolResults.push(...nextToolResults);
    traceEvents.push(...nextTraceEvents);
    routeTrace.push(...nextRouteTrace);
    current = {
      ...current,
      responses: [...current.responses, ...nextResponses],
      actionDrafts: [...current.actionDrafts, ...nextActionDrafts],
      toolResults: [...current.toolResults, ...nextToolResults],
      traceEvents: [...current.traceEvents, ...nextTraceEvents],
      routeTrace: [...current.routeTrace, ...nextRouteTrace],
      metadata: { ...(current.metadata ?? {}), ...(update.metadata ?? {}) },
    };
  }

  return { responses, actionDrafts, toolResults, traceEvents, routeTrace };
}

async function invokeSubgraph(
  route: AssistantSubgraphName,
  state: ShoppingAssistantStateType,
  config?: GraphConfig,
): Promise<ShoppingAssistantStateType> {
  if (route === 'sales') return salesSubgraph.invoke(state, config);
  if (route === 'order') return orderSubgraph.invoke(state, config);
  return generalSubgraph.invoke(state, config);
}

function subgraphUpdate(
  name: AssistantSubgraphName,
  previous: ShoppingAssistantStateType,
  result: ShoppingAssistantStateType,
): ShoppingAssistantStateUpdate {
  const responses = result.responses
    .slice(previous.responses.length)
    .map((response) => ({
      ...response,
      metadata: {
        ...(response.metadata ?? {}),
        active_subgraph: name,
      },
    }));
  return {
    responses,
    actionDrafts: result.actionDrafts.slice(previous.actionDrafts.length),
    toolResults: result.toolResults.slice(previous.toolResults.length),
    text: result.text,
    metadata: {
      ...(result.metadata ?? {}),
      active_subgraph: name,
      supervisor_decision: result.metadata?.supervisor_decision,
    },
    traceEvents: result.traceEvents.slice(previous.traceEvents.length),
    routeTrace: [name, ...result.routeTrace.slice(previous.routeTrace.length)],
  };
}

async function mergeResponseGraphNode(
  state: ShoppingAssistantStateType,
  config?: GraphConfig,
): Promise<ShoppingAssistantStateUpdate> {
  return responseMergerNode(state, config);
}

function routeAfterGuardrail(
  state: ShoppingAssistantStateType,
): AssistantSubgraphName | 'multi_route' | typeof END {
  if (state.status === 'staff_mode_paused') return END;
  const split = splitIntentsNode({
    primaryIntent: state.primaryIntent,
    intents: state.orderedIntents?.length ? state.orderedIntents : state.intents,
  });
  const intents = split.orderedIntents;
  if (intents.length > 1) return 'multi_route';
  const routes = routesForIntents(intents);
  if (routes.length === 1) return routes[0];
  return state.activeSubgraph ?? state.supervisorDecision?.route ?? 'general';
}

function guardrailMetadata(
  state: ShoppingAssistantStateType,
  decision: SupervisorDecision,
  guardrailDecision: AssistantGuardrailDecision,
) {
  const supervisorDecision = {
    ...(state.metadata?.supervisor_decision as Record<string, unknown> | undefined),
    ...decision,
  };
  return {
    ...(state.metadata ?? {}),
    supervisor_decision: supervisorDecision,
    active_subgraph: decision.route,
    guardrail_decision: guardrailDecision,
    ...(decision.fallbackReason ? { fallback_reason: decision.fallbackReason } : {}),
  };
}

function routesForIntents(intents: AssistantIntent[]): AssistantSubgraphName[] {
  const routes: AssistantSubgraphName[] = [];
  const hasIntent = (allowed: AssistantIntent[]) =>
    intents.some((intent) => allowed.includes(intent));
  if (
    hasIntent([AssistantIntent.PRODUCT_ADVICE, AssistantIntent.REVIEW_SUMMARY])
  ) {
    routes.push('sales');
  }
  if (
    hasIntent([
      AssistantIntent.CART_ACTION,
      AssistantIntent.CHECKOUT_PREP,
      AssistantIntent.ORDER_LOOKUP,
    ])
  ) {
    routes.push('order');
  }
  if (hasIntent([AssistantIntent.STAFF_HANDOFF, AssistantIntent.UNSUPPORTED])) {
    routes.push('general');
  }
  return routes;
}

function nodeForIntent(intent: AssistantIntent): RouteNodeName {
  switch (intent) {
    case AssistantIntent.PRODUCT_ADVICE:
      return 'product_advice';
    case AssistantIntent.REVIEW_SUMMARY:
      return 'review_summary';
    case AssistantIntent.CART_ACTION:
      return 'cart_action';
    case AssistantIntent.CHECKOUT_PREP:
      return 'checkout_prep';
    case AssistantIntent.ORDER_LOOKUP:
      return 'order_lookup';
    case AssistantIntent.STAFF_HANDOFF:
      return 'staff_handoff';
    default:
      return 'unsupported';
  }
}

export const shoppingAssistantGraph = new StateGraph(ShoppingAssistantState)
  .addNode('supervisor', supervisorGraphNode)
  .addNode('guardrail', guardrailGraphNode)
  .addNode('sales', salesGraphNode)
  .addNode('multi_route', multiRouteGraphNode)
  .addNode('order', orderGraphNode)
  .addNode('general', generalGraphNode)
  .addNode('merge_response', mergeResponseGraphNode)
  .addEdge(START, 'supervisor')
  .addEdge('supervisor', 'guardrail')
  .addConditionalEdges('guardrail', routeAfterGuardrail)
  .addEdge('sales', 'merge_response')
  .addEdge('order', 'merge_response')
  .addEdge('general', 'merge_response')
  .addEdge('multi_route', 'merge_response')
  .addEdge('merge_response', END)
  .compile();
