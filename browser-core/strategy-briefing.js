import { randomUUID } from "./crypto-browser.js";
import { createBrainStrategyContext } from "./brain-core.js";

export const STRATEGY_FORMATS = Object.freeze([
  "short_video",
  "standard_video",
  "long_video",
  "continuous_live"
]);

export class StrategyBriefingValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "StrategyBriefingValidationError";
  }
}

function normalizeRequiredText(value, message) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new StrategyBriefingValidationError(message);
  }
  return value.trim();
}

function assertPositiveInteger(value, message) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new StrategyBriefingValidationError(message);
  }
}

function createFunnelPlan(funnel) {
  if (!funnel || typeof funnel !== "object") {
    throw new StrategyBriefingValidationError(
      "Informe o planejamento local do funil."
    );
  }

  const {
    targetViews,
    plannedReach,
    expectedViewsMin,
    expectedViewsMax
  } = funnel;

  assertPositiveInteger(targetViews, "A meta de visualizações é inválida.");
  assertPositiveInteger(plannedReach, "O alcance planejado é inválido.");
  assertPositiveInteger(
    expectedViewsMin,
    "O limite mínimo esperado é inválido."
  );
  assertPositiveInteger(
    expectedViewsMax,
    "O limite máximo esperado é inválido."
  );

  if (plannedReach <= targetViews) {
    throw new StrategyBriefingValidationError(
      "O alcance planejado do funil deve ser maior que a meta desejada."
    );
  }
  if (expectedViewsMin > expectedViewsMax) {
    throw new StrategyBriefingValidationError(
      "A faixa esperada do funil está invertida."
    );
  }
  if (expectedViewsMax > targetViews) {
    throw new StrategyBriefingValidationError(
      "A faixa esperada deve permanecer conservadora e não superar a meta desejada."
    );
  }

  return Object.freeze({
    strategy: "over_target_reach",
    status: "planning_only",
    targetViews,
    plannedReach,
    reachMultiplier: Number((plannedReach / targetViews).toFixed(4)),
    expectedViewsRange: Object.freeze({
      min: expectedViewsMin,
      max: expectedViewsMax,
      classification: "unvalidated_hypothesis",
      status: "pending_validation",
      guaranteed: false
    })
  });
}

export function createStrategyBriefing({
  mission,
  theme,
  objective,
  audience,
  format,
  funnel,
  id = randomUUID(),
  now = new Date()
}) {
  if (
    !mission ||
    typeof mission !== "object" ||
    typeof mission.id !== "string" ||
    typeof mission.channel?.id !== "string"
  ) {
    throw new StrategyBriefingValidationError(
      "A missão informada para o briefing é inválida."
    );
  }

  const normalizedTheme = normalizeRequiredText(
    theme,
    "Informe o tema fornecido por Anderson."
  );
  const normalizedObjective = normalizeRequiredText(
    objective,
    "Informe o objetivo estratégico da missão."
  );
  const normalizedAudience = normalizeRequiredText(
    audience,
    "Informe o público da missão."
  );
  if (!STRATEGY_FORMATS.includes(format)) {
    throw new StrategyBriefingValidationError(
      "O formato estratégico da missão é inválido."
    );
  }

  const brainContext = createBrainStrategyContext({
    assignment: mission.brain,
    channelId: mission.channel.id
  });
  const funnelPlan = createFunnelPlan(funnel);

  return Object.freeze({
    schemaVersion: 1,
    id,
    missionId: mission.id,
    mode: "local_planning_only",
    externalConnections: false,
    createdAt: now.toISOString(),
    channel: Object.freeze({
      id: mission.channel.id,
      name: mission.channel.name
    }),
    brainContext,
    theme: Object.freeze({
      value: normalizedTheme,
      classification: "anderson_input"
    }),
    constraints: Object.freeze({
      objective: normalizedObjective,
      audience: normalizedAudience,
      format,
      classification: "planning_constraint",
      guaranteedOutcome: false
    }),
    funnel: funnelPlan,
    outcomePolicy: Object.freeze({
      promisesAllowed: false,
      guaranteeAllowed: false,
      realValidationStatus: "pending"
    })
  });
}
