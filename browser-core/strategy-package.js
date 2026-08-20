import { randomUUID } from "./crypto-browser.js";

const DAYS_OF_WEEK = Object.freeze([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
]);

const STOP_WORDS = new Set([
  "para", "com", "sem", "uma", "uns", "das", "dos", "que", "quem",
  "por", "em", "de", "da", "do", "e", "a", "o"
]);

const GUARANTEE_PATTERNS = Object.freeze([
  /\b100\s*%\b/iu,
  /\bgarantid[oa]s?\b/iu,
  /\bresultado certo\b/iu,
  /\bcliques? garantidos?\b/iu,
  /\bviral(?:izar|iza[cç][aã]o)? garantid[oa]\b/iu
]);

export class StrategyPackageValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "StrategyPackageValidationError";
  }
}

function normalizeRequiredText(value, message, { min = 1, max = 2_000 } = {}) {
  if (typeof value !== "string") {
    throw new StrategyPackageValidationError(message);
  }
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length < min || normalized.length > max) {
    throw new StrategyPackageValidationError(message);
  }
  return normalized;
}

function normalizedTokens(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("pt-BR")
    .match(/[a-z0-9]+/gu) ?? [];
}

function themeKeywords(theme) {
  const tokens = normalizedTokens(theme);
  const significant = tokens.filter(
    (token) => token.length >= 4 && !STOP_WORDS.has(token)
  );
  return significant.length > 0 ? significant : tokens.filter((token) => token.length >= 2);
}

function assertThemeAlignment(candidate, theme, field) {
  const candidateTokens = new Set(normalizedTokens(candidate));
  const aligned = themeKeywords(theme).some((token) => candidateTokens.has(token));
  if (!aligned) {
    throw new StrategyPackageValidationError(
      `${field} não corresponde ao tema real planejado.`
    );
  }
}

function assertNoGuaranteedOutcome(value, field) {
  if (GUARANTEE_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new StrategyPackageValidationError(
      `${field} não pode prometer clique, alcance ou resultado.`
    );
  }
}

function assertMissionFoundation(mission) {
  if (!mission || typeof mission.id !== "string") {
    throw new StrategyPackageValidationError("A missão estratégica é inválida.");
  }
  if (!mission.strategyBriefing || !mission.retentionPlan) {
    throw new StrategyPackageValidationError(
      "Conclua o briefing e o plano de retenção antes da estratégia de clique."
    );
  }
  if (
    mission.retentionPlan.missionId !== mission.id ||
    mission.retentionPlan.briefingId !== mission.strategyBriefing.id
  ) {
    throw new StrategyPackageValidationError(
      "O briefing e o plano de retenção não pertencem à mesma missão."
    );
  }
}

export function createClickStrategy({
  mission,
  title,
  id = randomUUID(),
  now = new Date()
}) {
  assertMissionFoundation(mission);
  const plannedTitle = normalizeRequiredText(
    title,
    "Informe um título verdadeiro entre 10 e 100 caracteres.",
    { min: 10, max: 100 }
  );
  const theme = mission.strategyBriefing.theme.value;
  assertThemeAlignment(plannedTitle, theme, "O título");
  assertNoGuaranteedOutcome(plannedTitle, "O título");

  return Object.freeze({
    schemaVersion: 1,
    id,
    missionId: mission.id,
    briefingId: mission.strategyBriefing.id,
    retentionPlanId: mission.retentionPlan.id,
    mode: "local_planning_only",
    externalConnections: false,
    createdAt: now.toISOString(),
    title: plannedTitle,
    alignment: Object.freeze({
      theme,
      status: "validated_theme_overlap",
      deceptive: false
    }),
    clickMeasurement: Object.freeze({
      metric: "click_through_rate",
      status: "awaiting_real_channel_data",
      classification: "unvalidated_hypothesis",
      guaranteed: false
    })
  });
}

export function createDescriptionStrategy({
  mission,
  description,
  id = randomUUID(),
  now = new Date()
}) {
  assertMissionFoundation(mission);
  if (!mission.clickStrategy) {
    throw new StrategyPackageValidationError(
      "Crie a estratégia de título antes da descrição."
    );
  }
  const plannedDescription = normalizeRequiredText(
    description,
    "Informe uma descrição correspondente entre 40 e 2000 caracteres.",
    { min: 40, max: 2_000 }
  );
  const theme = mission.strategyBriefing.theme.value;
  assertThemeAlignment(plannedDescription, theme, "A descrição");
  assertNoGuaranteedOutcome(plannedDescription, "A descrição");

  return Object.freeze({
    schemaVersion: 1,
    id,
    missionId: mission.id,
    briefingId: mission.strategyBriefing.id,
    clickStrategyId: mission.clickStrategy.id,
    mode: "local_planning_only",
    externalConnections: false,
    createdAt: now.toISOString(),
    description: plannedDescription,
    contentAlignment: Object.freeze({
      theme,
      status: "validated_theme_overlap",
      unsupportedClaimsAllowed: false
    }),
    outcomePolicy: Object.freeze({
      promisesAllowed: false,
      guaranteeAllowed: false
    })
  });
}

function assertTime(value, field) {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value)) {
    throw new StrategyPackageValidationError(`${field} é inválido.`);
  }
}

function assertTimeZone(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new StrategyPackageValidationError("O fuso horário é inválido.");
  }
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: value }).format();
  } catch {
    throw new StrategyPackageValidationError("O fuso horário é inválido.");
  }
}

export function createPublishingWindowStrategy({
  mission,
  timeZone,
  daysOfWeek,
  startLocalTime,
  endLocalTime,
  rationale,
  id = randomUUID(),
  now = new Date()
}) {
  assertMissionFoundation(mission);
  if (!mission.descriptionStrategy) {
    throw new StrategyPackageValidationError(
      "Crie a descrição estratégica antes da janela de publicação."
    );
  }
  assertTimeZone(timeZone);
  if (
    !Array.isArray(daysOfWeek) ||
    daysOfWeek.length === 0 ||
    new Set(daysOfWeek).size !== daysOfWeek.length ||
    daysOfWeek.some((day) => !DAYS_OF_WEEK.includes(day))
  ) {
    throw new StrategyPackageValidationError("Os dias da janela são inválidos.");
  }
  assertTime(startLocalTime, "O início da janela");
  assertTime(endLocalTime, "O fim da janela");
  if (startLocalTime >= endLocalTime) {
    throw new StrategyPackageValidationError(
      "O fim da janela deve ser posterior ao início."
    );
  }
  const normalizedRationale = normalizeRequiredText(
    rationale,
    "Informe o motivo da hipótese de publicação.",
    { min: 10, max: 500 }
  );

  return Object.freeze({
    schemaVersion: 1,
    id,
    missionId: mission.id,
    briefingId: mission.strategyBriefing.id,
    descriptionStrategyId: mission.descriptionStrategy.id,
    mode: "local_planning_only",
    externalConnections: false,
    createdAt: now.toISOString(),
    timeZone,
    daysOfWeek: Object.freeze([...daysOfWeek]),
    startLocalTime,
    endLocalTime,
    rationale: normalizedRationale,
    hypothesis: Object.freeze({
      classification: "unvalidated_hypothesis",
      status: "pending_real_channel_data",
      guaranteed: false
    }),
    execution: Object.freeze({
      publishesContent: false,
      connectsAccount: false
    })
  });
}

function collectCompleteStrategyIssues(mission) {
  const issues = [];
  const briefing = mission?.strategyBriefing;
  const retention = mission?.retentionPlan;
  const click = mission?.clickStrategy;
  const description = mission?.descriptionStrategy;
  const window = mission?.publishingWindowStrategy;

  if (!briefing) issues.push("strategy_briefing_missing");
  if (!retention) issues.push("retention_plan_missing");
  if (!click) issues.push("click_strategy_missing");
  if (!description) issues.push("description_strategy_missing");
  if (!window) issues.push("publishing_window_missing");
  if (issues.length > 0) return issues;

  if (
    briefing.missionId !== mission.id ||
    retention.missionId !== mission.id ||
    click.missionId !== mission.id ||
    description.missionId !== mission.id ||
    window.missionId !== mission.id
  ) issues.push("mission_link_mismatch");
  if (
    retention.briefingId !== briefing.id ||
    click.briefingId !== briefing.id ||
    description.briefingId !== briefing.id ||
    window.briefingId !== briefing.id
  ) issues.push("briefing_link_mismatch");
  if (
    click.retentionPlanId !== retention.id ||
    description.clickStrategyId !== click.id ||
    window.descriptionStrategyId !== description.id
  ) issues.push("strategy_sequence_mismatch");
  if (
    briefing.externalConnections !== false ||
    retention.externalConnections !== false ||
    click.externalConnections !== false ||
    description.externalConnections !== false ||
    window.externalConnections !== false
  ) issues.push("external_connections_enabled");
  if (
    briefing.outcomePolicy?.guaranteeAllowed !== false ||
    retention.measurement?.guaranteed !== false ||
    click.clickMeasurement?.guaranteed !== false ||
    description.outcomePolicy?.guaranteeAllowed !== false ||
    window.hypothesis?.guaranteed !== false
  ) issues.push("result_guarantee_enabled");
  if (
    window.hypothesis?.classification !== "unvalidated_hypothesis" ||
    window.hypothesis?.status !== "pending_real_channel_data"
  ) issues.push("publishing_window_not_hypothesis");
  if (
    window.execution?.publishesContent !== false ||
    window.execution?.connectsAccount !== false
  ) issues.push("publishing_execution_enabled");
  return issues;
}

export function validateCompleteStrategy({
  mission,
  id = randomUUID(),
  now = new Date()
}) {
  const issues = collectCompleteStrategyIssues(mission);
  if (issues.length > 0) {
    throw new StrategyPackageValidationError(
      `O briefing estratégico completo é inválido: ${issues.join(", ")}.`
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    id,
    missionId: mission.id,
    mode: "local_validation_only",
    externalConnections: false,
    validatedAt: now.toISOString(),
    status: "valid",
    valid: true,
    issues: Object.freeze([]),
    checkedComponents: Object.freeze([
      "strategyBriefing",
      "retentionPlan",
      "clickStrategy",
      "descriptionStrategy",
      "publishingWindowStrategy"
    ])
  });
}

export function createStrategyPackage({
  mission,
  id = randomUUID(),
  now = new Date()
}) {
  const validation = mission?.strategyValidation;
  if (
    !validation ||
    validation.missionId !== mission?.id ||
    validation.valid !== true ||
    validation.status !== "valid"
  ) {
    throw new StrategyPackageValidationError(
      "Valide o briefing estratégico completo antes de fechar o pacote."
    );
  }
  const issues = collectCompleteStrategyIssues(mission);
  if (issues.length > 0) {
    throw new StrategyPackageValidationError(
      "O pacote estratégico não corresponde à validação preservada."
    );
  }

  return Object.freeze({
    schemaVersion: 1,
    id,
    missionId: mission.id,
    mode: "local_planning_only",
    externalConnections: false,
    closedAt: now.toISOString(),
    status: "strategic_package_closed",
    componentIds: Object.freeze({
      briefingId: mission.strategyBriefing.id,
      retentionPlanId: mission.retentionPlan.id,
      clickStrategyId: mission.clickStrategy.id,
      descriptionStrategyId: mission.descriptionStrategy.id,
      publishingWindowStrategyId: mission.publishingWindowStrategy.id,
      validationId: validation.id
    }),
    safety: Object.freeze({
      deceptiveTitleAllowed: false,
      guaranteedClicks: false,
      guaranteedOutcome: false,
      publishesContent: false,
      connectsAccount: false,
      requestsCredentials: false,
      createsCharge: false
    }),
    nextStage: "text_package"
  });
}
