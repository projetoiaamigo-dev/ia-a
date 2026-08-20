import { createHash, randomUUID } from "./crypto-browser.js";

const SCRIPT_STAGE_IDS = Object.freeze([
  "opening",
  "progression",
  "reengagement",
  "closing"
]);

const TEXT_FRAGMENT_ROLES = Object.freeze([
  "title",
  "description",
  ...SCRIPT_STAGE_IDS
]);

const SCRIPT_TRANSITIONS = Object.freeze([
  Object.freeze(["opening", "progression"]),
  Object.freeze(["progression", "reengagement"]),
  Object.freeze(["reengagement", "closing"])
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

const DECEPTIVE_PATTERNS = Object.freeze([
  /\bvoc[eê] n[aã]o vai acreditar\b/iu,
  /\bo segredo que ningu[eé]m (?:conta|revela)\b/iu
]);

const UNSUPPORTED_CONTENT_PATTERNS = Object.freeze([
  /\bdepoimento (?:real|verdadeiro|comprovado)\b/iu,
  /\b(?:estudos?|pesquisas?) comprovam?\b/iu,
  /\b(?:eu|ela|ele|n[oó]s) (?:fui|foi|fomos) curad[oa]s?\b/iu,
  /\b\d+(?:[.,]\d+)?\s*% (?:das pessoas|dos casos|de sucesso)\b/iu
]);

const OPENING_MAX_CHARACTERS = Object.freeze({
  short_video: 280,
  standard_video: 600,
  long_video: 900,
  continuous_live: 1_200
});

const SCRIPT_STAGE_MAX_CHARACTERS = Object.freeze({
  progression: Object.freeze({
    short_video: 600,
    standard_video: 4_000,
    long_video: 8_000,
    continuous_live: 12_000
  }),
  reengagement: Object.freeze({
    short_video: 280,
    standard_video: 900,
    long_video: 1_500,
    continuous_live: 2_500
  }),
  closing: Object.freeze({
    short_video: 280,
    standard_video: 900,
    long_video: 1_500,
    continuous_live: 2_500
  })
});

const SCRIPT_STAGE_CONFIG = Object.freeze({
  progression: Object.freeze({
    assetProperty: "progressionAsset",
    kind: "script_progression",
    requiredStatus: "opening_validated",
    completedStatus: "progression_validated"
  }),
  reengagement: Object.freeze({
    assetProperty: "reengagementAsset",
    kind: "script_reengagement",
    requiredStatus: "progression_validated",
    completedStatus: "reengagement_validated"
  }),
  closing: Object.freeze({
    assetProperty: "closingAsset",
    kind: "script_closing",
    requiredStatus: "reengagement_validated",
    completedStatus: "closing_validated"
  })
});

export class TextPackageValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TextPackageValidationError";
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeText(value, message, { min = 1, max = 2_000 } = {}) {
  if (typeof value !== "string") {
    throw new TextPackageValidationError(message);
  }
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length < min || normalized.length > max) {
    throw new TextPackageValidationError(message);
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
  return significant.length > 0
    ? significant
    : tokens.filter((token) => token.length >= 2);
}

function assertThemeAlignment(text, theme, field) {
  const textTokens = new Set(normalizedTokens(text));
  if (!themeKeywords(theme).some((token) => textTokens.has(token))) {
    throw new TextPackageValidationError(
      `${field} não corresponde ao tema fornecido por Anderson.`
    );
  }
}

function assertSafeAuthoredText(text, field) {
  if (GUARANTEE_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new TextPackageValidationError(
      `${field} não pode prometer clique, alcance ou resultado.`
    );
  }
  if (DECEPTIVE_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new TextPackageValidationError(`${field} não pode ser enganosa.`);
  }
  if (UNSUPPORTED_CONTENT_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new TextPackageValidationError(
      `${field} contém fato ou depoimento sem fonte preservada.`
    );
  }
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function contentDigest(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function scriptStageAssets(textPackage) {
  return [
    textPackage.openingAsset,
    textPackage.progressionAsset,
    textPackage.reengagementAsset,
    textPackage.closingAsset
  ];
}

function textFragments(textPackage) {
  return [
    Object.freeze({
      role: "title",
      assetId: textPackage.titleAsset?.id,
      text: textPackage.titleAsset?.text
    }),
    Object.freeze({
      role: "description",
      assetId: textPackage.descriptionAsset?.id,
      text: textPackage.descriptionAsset?.text
    }),
    ...scriptStageAssets(textPackage).map((asset, index) =>
      Object.freeze({
        role: SCRIPT_STAGE_IDS[index],
        assetId: asset?.id,
        text: asset?.text
      })
    )
  ];
}

function strategyFoundationIssues(mission) {
  const issues = [];
  const briefing = mission?.strategyBriefing;
  const retention = mission?.retentionPlan;
  const click = mission?.clickStrategy;
  const description = mission?.descriptionStrategy;
  const window = mission?.publishingWindowStrategy;
  const validation = mission?.strategyValidation;
  const strategyPackage = mission?.strategyPackage;
  const componentIds = strategyPackage?.componentIds;

  if (!mission || !isNonEmptyString(mission.id)) issues.push("mission_invalid");
  if (!briefing) issues.push("strategy_briefing_missing");
  if (!retention) issues.push("retention_plan_missing");
  if (!click) issues.push("click_strategy_missing");
  if (!description) issues.push("description_strategy_missing");
  if (!window) issues.push("publishing_window_missing");
  if (!validation) issues.push("strategy_validation_missing");
  if (!strategyPackage) issues.push("strategy_package_missing");
  if (issues.length > 0) return issues;

  if (
    strategyPackage.missionId !== mission.id ||
    strategyPackage.status !== "strategic_package_closed" ||
    strategyPackage.nextStage !== "text_package" ||
    strategyPackage.mode !== "local_planning_only" ||
    strategyPackage.externalConnections !== false
  ) issues.push("strategy_package_not_ready");
  if (
    componentIds?.briefingId !== briefing.id ||
    componentIds?.retentionPlanId !== retention.id ||
    componentIds?.clickStrategyId !== click.id ||
    componentIds?.descriptionStrategyId !== description.id ||
    componentIds?.publishingWindowStrategyId !== window.id ||
    componentIds?.validationId !== validation.id
  ) issues.push("strategy_component_link_mismatch");
  if (
    briefing.missionId !== mission.id ||
    retention.missionId !== mission.id ||
    click.missionId !== mission.id ||
    description.missionId !== mission.id ||
    window.missionId !== mission.id ||
    validation.missionId !== mission.id
  ) issues.push("strategy_mission_link_mismatch");
  if (
    briefing.theme?.classification !== "anderson_input" ||
    !isNonEmptyString(briefing.theme?.value)
  ) issues.push("anderson_theme_invalid");
  if (
    briefing.channel?.id !== mission.channel?.id ||
    briefing.brainContext?.brainId !== mission.brain?.id ||
    briefing.brainContext?.profileVersion !== mission.brain?.profileVersion ||
    retention.brain?.id !== mission.brain?.id ||
    retention.brain?.profileVersion !== mission.brain?.profileVersion
  ) issues.push("mission_identity_mismatch");
  if (
    validation.valid !== true ||
    validation.status !== "valid" ||
    !Array.isArray(validation.issues) ||
    validation.issues.length !== 0
  ) issues.push("strategy_validation_invalid");

  const safety = strategyPackage.safety;
  if (
    safety?.deceptiveTitleAllowed !== false ||
    safety?.guaranteedClicks !== false ||
    safety?.guaranteedOutcome !== false ||
    safety?.publishesContent !== false ||
    safety?.connectsAccount !== false ||
    safety?.requestsCredentials !== false ||
    safety?.createsCharge !== false
  ) issues.push("strategy_safety_invalid");

  return issues;
}

function expectedSourceContext(mission) {
  const briefing = mission.strategyBriefing;
  return {
    theme: briefing.theme.value,
    themeClassification: briefing.theme.classification,
    objective: briefing.constraints.objective,
    audience: briefing.constraints.audience,
    format: briefing.constraints.format
  };
}

function expectedTraceability(mission) {
  return {
    strategyPackageId: mission.strategyPackage.id,
    componentIds: mission.strategyPackage.componentIds,
    channelId: mission.channel.id,
    brainId: mission.brain.id,
    brainProfileVersion: mission.brain.profileVersion
  };
}

function collectTextPackageIssues(mission) {
  const textPackage = mission?.textPackage;
  if (!textPackage) return [];

  const issues = strategyFoundationIssues(mission);
  if (issues.length > 0) return issues;

  const source = expectedSourceContext(mission);
  const traceability = expectedTraceability(mission);
  const safety = textPackage.safety;

  if (
    textPackage.missionId !== mission.id ||
    textPackage.mode !== "local_text_authoring_only" ||
    textPackage.externalConnections !== false ||
    textPackage.classification !== "implementation_new_reconstruction"
  ) issues.push("text_package_identity_invalid");
  if (
    textPackage.sourceContext?.theme !== source.theme ||
    textPackage.sourceContext?.themeClassification !== source.themeClassification ||
    textPackage.sourceContext?.objective !== source.objective ||
    textPackage.sourceContext?.audience !== source.audience ||
    textPackage.sourceContext?.format !== source.format
  ) issues.push("text_package_source_changed");
  if (
    textPackage.traceability?.strategyPackageId !== traceability.strategyPackageId ||
    textPackage.traceability?.channelId !== traceability.channelId ||
    textPackage.traceability?.brainId !== traceability.brainId ||
    textPackage.traceability?.brainProfileVersion !== traceability.brainProfileVersion ||
    Object.entries(traceability.componentIds).some(
      ([key, value]) => textPackage.traceability?.componentIds?.[key] !== value
    )
  ) issues.push("text_package_traceability_invalid");
  if (
    safety?.deceptiveTitleAllowed !== false ||
    safety?.guaranteedClicks !== false ||
    safety?.guaranteedOutcome !== false ||
    safety?.unsupportedFactsAllowed !== false ||
    safety?.inventedTestimonialsAllowed !== false ||
    safety?.publishesContent !== false ||
    safety?.connectsAccount !== false ||
    safety?.requestsCredentials !== false ||
    safety?.createsCharge !== false ||
    safety?.webRadioLouvarMonetization !== "permanently_disabled"
  ) issues.push("text_package_safety_invalid");

  const title = textPackage.titleAsset;
  const description = textPackage.descriptionAsset;
  const script = textPackage.script;
  const opening = textPackage.openingAsset;
  const progression = textPackage.progressionAsset;
  const reengagement = textPackage.reengagementAsset;
  const closing = textPackage.closingAsset;

  if (
    title &&
    (title.kind !== "final_title" ||
      title.text !== mission.clickStrategy.title ||
      title.source?.clickStrategyId !== mission.clickStrategy.id ||
      title.source?.theme !== source.theme ||
      title.safety?.deceptive !== false ||
      title.safety?.guaranteedOutcome !== false)
  ) issues.push("text_title_invalid");
  if (description && !title) issues.push("text_description_before_title");
  if (
    description &&
    (description.kind !== "final_description" ||
      description.text !== mission.descriptionStrategy.description ||
      description.source?.descriptionStrategyId !== mission.descriptionStrategy.id ||
      description.source?.theme !== source.theme ||
      description.safety?.unsupportedClaimsAllowed !== false ||
      description.safety?.guaranteedOutcome !== false)
  ) issues.push("text_description_invalid");
  if (script && !description) issues.push("text_script_before_description");
  if (
    script &&
    (!['structured', 'complete_validated'].includes(script.status) ||
      script.retentionPlanId !== mission.retentionPlan.id ||
      script.format !== source.format ||
      !Array.isArray(script.stages) ||
      script.stages.length !== SCRIPT_STAGE_IDS.length ||
      SCRIPT_STAGE_IDS.some((id, index) => {
        const stage = script.stages[index];
        const retentionStage = mission.retentionPlan.stages[index];
        return (
          stage?.id !== id ||
          stage?.retentionStageId !== retentionStage?.id ||
          stage?.objective !== retentionStage?.objective
        );
      }))
  ) issues.push("text_script_invalid");
  if (opening && !script) issues.push("text_opening_before_script");
  if (
    opening &&
    (opening.kind !== "script_opening" ||
      opening.stageId !== "opening" ||
      opening.scriptId !== script?.id ||
      opening.validation?.status !== "valid" ||
      opening.validation?.themeAlignment !== "validated_theme_overlap" ||
      opening.validation?.guaranteedOutcome !== false ||
      opening.validation?.unsupportedFactsAllowed !== false ||
      opening.validation?.inventedTestimonialsAllowed !== false ||
      opening.traceability?.theme !== source.theme ||
      opening.traceability?.objective !== source.objective ||
      opening.traceability?.audience !== source.audience ||
      opening.traceability?.format !== source.format ||
      opening.traceability?.retentionPlanId !== mission.retentionPlan.id ||
      script?.stages?.[0]?.textAssetId !== opening.id)
  ) issues.push("text_opening_invalid");

  const authoredStages = [
    ["progression", progression],
    ["reengagement", reengagement],
    ["closing", closing]
  ];
  for (const [stageId, asset] of authoredStages) {
    if (!asset) continue;
    const config = SCRIPT_STAGE_CONFIG[stageId];
    const stageIndex = SCRIPT_STAGE_IDS.indexOf(stageId);
    const retentionStage = mission.retentionPlan.stages[stageIndex];
    const scriptStage = script?.stages?.[stageIndex];
    if (
      asset.kind !== config.kind ||
      asset.stageId !== stageId ||
      asset.scriptId !== script?.id ||
      asset.validation?.status !== "valid" ||
      asset.validation?.themeAlignment !== "validated_theme_overlap" ||
      asset.validation?.guaranteedOutcome !== false ||
      asset.validation?.unsupportedFactsAllowed !== false ||
      asset.validation?.inventedTestimonialsAllowed !== false ||
      asset.traceability?.textPackageId !== textPackage.id ||
      asset.traceability?.strategyPackageId !== mission.strategyPackage.id ||
      asset.traceability?.theme !== source.theme ||
      asset.traceability?.objective !== source.objective ||
      asset.traceability?.audience !== source.audience ||
      asset.traceability?.format !== source.format ||
      asset.traceability?.retentionPlanId !== mission.retentionPlan.id ||
      asset.traceability?.retentionStageId !== stageId ||
      asset.traceability?.retentionStageObjective !== retentionStage?.objective ||
      !arraysEqual(
        asset.traceability?.sourceCriteriaIds,
        retentionStage?.sourceCriteriaIds
      ) ||
      scriptStage?.status !== "validated" ||
      scriptStage?.textAssetId !== asset.id
    ) {
      issues.push(`text_${stageId}_invalid`);
    }
  }
  if (progression && !opening) issues.push("text_progression_before_opening");
  if (reengagement && !progression) {
    issues.push("text_reengagement_before_progression");
  }
  if (closing && !reengagement) issues.push("text_closing_before_reengagement");

  const completeValidation = script?.validation;
  const finalScript = textPackage.finalScriptAsset;
  const transitionMap = textPackage.transitionMapAsset;
  const safetyOrigins = textPackage.safetyOriginRegistry;
  const packageValidation = textPackage.packageValidation;
  const closure = textPackage.closure;
  const expectedContinuation = closure
    ? { status: "closed", nextStage: "scene_package" }
    : { status: "open", nextStage: "text_package_continuation" };
  if (
    completeValidation &&
    (script.status !== "complete_validated" ||
      completeValidation.status !== "valid" ||
      !arraysEqual(completeValidation.requiredOrder, SCRIPT_STAGE_IDS) ||
      !arraysEqual(
        completeValidation.assetIds,
        [opening?.id, progression?.id, reengagement?.id, closing?.id]
      ) ||
      completeValidation.orderValid !== true ||
      completeValidation.complete !== true ||
      completeValidation.traceabilityValid !== true ||
      completeValidation.safety?.unsupportedFactsAllowed !== false ||
      completeValidation.safety?.inventedTestimonialsAllowed !== false ||
      completeValidation.safety?.guaranteedOutcome !== false ||
      textPackage.continuation?.status !== expectedContinuation.status ||
      textPackage.continuation?.nextStage !== expectedContinuation.nextStage ||
      textPackage.continuation?.externalConnections !== false)
  ) {
    issues.push("text_script_complete_validation_invalid");
  }

  const stageAssets = scriptStageAssets(textPackage);
  const expectedStageAssetIds = stageAssets.map((asset) => asset?.id);
  const expectedFragments = textFragments(textPackage);
  if (finalScript && !completeValidation) {
    issues.push("text_final_script_before_complete_validation");
  }
  if (
    finalScript &&
    (finalScript.kind !== "final_text_script" ||
      finalScript.status !== "consolidated" ||
      finalScript.missionId !== mission.id ||
      finalScript.textPackageId !== textPackage.id ||
      finalScript.source?.titleAssetId !== title?.id ||
      finalScript.source?.descriptionAssetId !== description?.id ||
      finalScript.source?.scriptId !== script?.id ||
      !arraysEqual(finalScript.source?.stageAssetIds, expectedStageAssetIds) ||
      finalScript.content?.title !== title?.text ||
      finalScript.content?.description !== description?.text ||
      !Array.isArray(finalScript.content?.stages) ||
      finalScript.content.stages.length !== SCRIPT_STAGE_IDS.length ||
      SCRIPT_STAGE_IDS.some((stageId, index) => {
        const consolidatedStage = finalScript.content.stages[index];
        const asset = stageAssets[index];
        return (
          consolidatedStage?.stageId !== stageId ||
          consolidatedStage?.textAssetId !== asset?.id ||
          consolidatedStage?.text !== asset?.text
        );
      }) ||
      finalScript.traceability?.strategyPackageId !== mission.strategyPackage.id ||
      finalScript.traceability?.retentionPlanId !== mission.retentionPlan.id ||
      finalScript.traceability?.theme !== source.theme ||
      finalScript.traceability?.channelId !== mission.channel.id ||
      finalScript.traceability?.brainId !== mission.brain.id ||
      finalScript.traceability?.brainProfileVersion !== mission.brain.profileVersion ||
      finalScript.safety?.verbatimExistingAssets !== true ||
      finalScript.safety?.addsClaims !== false ||
      finalScript.safety?.guaranteedOutcome !== false)
  ) {
    issues.push("text_final_script_invalid");
  }

  if (transitionMap && !finalScript) {
    issues.push("text_transition_map_before_final_script");
  }
  if (
    transitionMap &&
    (transitionMap.kind !== "text_transition_map" ||
      transitionMap.status !== "materialized" ||
      transitionMap.finalScriptAssetId !== finalScript?.id ||
      transitionMap.scriptId !== script?.id ||
      !arraysEqual(transitionMap.order, SCRIPT_STAGE_IDS) ||
      !Array.isArray(transitionMap.transitions) ||
      transitionMap.transitions.length !== SCRIPT_TRANSITIONS.length ||
      SCRIPT_TRANSITIONS.some(([from, to], index) => {
        const transition = transitionMap.transitions[index];
        const fromIndex = SCRIPT_STAGE_IDS.indexOf(from);
        const toIndex = SCRIPT_STAGE_IDS.indexOf(to);
        return (
          transition?.fromStageId !== from ||
          transition?.toStageId !== to ||
          transition?.fromTextAssetId !== stageAssets[fromIndex]?.id ||
          transition?.toTextAssetId !== stageAssets[toIndex]?.id ||
          transition?.label !== `Transição estrutural: ${from} -> ${to}` ||
          transition?.source !== "structural_link_only" ||
          transition?.addsClaims !== false
        );
      }) ||
      transitionMap.safety?.addsClaims !== false ||
      transitionMap.safety?.altersText !== false ||
      transitionMap.externalConnections !== false)
  ) {
    issues.push("text_transition_map_invalid");
  }

  if (safetyOrigins && !transitionMap) {
    issues.push("text_safety_origins_before_transition_map");
  }
  if (
    safetyOrigins &&
    (safetyOrigins.kind !== "text_safety_origin_registry" ||
      safetyOrigins.status !== "registered" ||
      safetyOrigins.finalScriptAssetId !== finalScript?.id ||
      safetyOrigins.transitionMapAssetId !== transitionMap?.id ||
      !Array.isArray(safetyOrigins.records) ||
      safetyOrigins.records.length !== TEXT_FRAGMENT_ROLES.length ||
      expectedFragments.some((fragment, index) => {
        const record = safetyOrigins.records[index];
        return (
          record?.role !== fragment.role ||
          record?.assetId !== fragment.assetId ||
          record?.contentHash !== contentDigest(fragment.text ?? "") ||
          record?.origin?.classification !== "validated_local_source" ||
          record?.safety?.unsupportedFactsAllowed !== false ||
          record?.safety?.inventedTestimonialsAllowed !== false ||
          record?.safety?.guaranteedOutcome !== false
        );
      }) ||
      safetyOrigins.policy?.unverifiedClaimsAllowed !== false ||
      safetyOrigins.policy?.inventedTestimonialsAllowed !== false ||
      safetyOrigins.policy?.guaranteedOutcome !== false ||
      safetyOrigins.externalConnections !== false)
  ) {
    issues.push("text_safety_origin_registry_invalid");
  }

  const expectedFragmentIds = expectedFragments.map((fragment) => fragment.assetId);
  const expectedHashes = expectedFragments.map((fragment) =>
    contentDigest(fragment.text ?? "")
  );
  if (packageValidation && !safetyOrigins) {
    issues.push("text_package_validation_before_safety_origins");
  }
  if (
    packageValidation &&
    (packageValidation.kind !== "complete_text_package_validation" ||
      packageValidation.status !== "valid" ||
      packageValidation.finalScriptAssetId !== finalScript?.id ||
      packageValidation.transitionMapAssetId !== transitionMap?.id ||
      packageValidation.safetyOriginRegistryId !== safetyOrigins?.id ||
      !arraysEqual(packageValidation.requiredOrder, SCRIPT_STAGE_IDS) ||
      !arraysEqual(packageValidation.fragmentAssetIds, expectedFragmentIds) ||
      !arraysEqual(packageValidation.contentHashes, expectedHashes) ||
      Object.values(packageValidation.checks ?? {}).some((value) => value !== true) ||
      Object.keys(packageValidation.checks ?? {}).length !== 8 ||
      packageValidation.externalConnections !== false)
  ) {
    issues.push("text_package_complete_validation_invalid");
  }

  if (closure && !packageValidation) {
    issues.push("text_package_closure_before_validation");
  }
  if (
    closure &&
    (closure.kind !== "text_package_closure" ||
      closure.status !== "closed" ||
      closure.packageValidationId !== packageValidation?.id ||
      closure.finalScriptAssetId !== finalScript?.id ||
      closure.nextStage !== "scene_package" ||
      closure.readyForScenePackage !== true ||
      closure.publishesContent !== false ||
      closure.externalConnections !== false)
  ) {
    issues.push("text_package_closure_invalid");
  }

  const expectedStatus = closure
    ? "ready_for_scene_package"
    : packageValidation
      ? "complete_package_validated"
      : safetyOrigins
        ? "safety_origins_registered"
        : transitionMap
          ? "transition_map_materialized"
          : finalScript
            ? "final_script_consolidated"
            : completeValidation
              ? "complete_script_validated"
    : closing
      ? "closing_validated"
      : reengagement
        ? "reengagement_validated"
        : progression
          ? "progression_validated"
          : opening
            ? "opening_validated"
            : script
              ? "script_structured"
              : description
                ? "description_materialized"
                : title
                  ? "title_materialized"
                  : "modeled";
  if (textPackage.status !== expectedStatus) {
    issues.push("text_package_status_invalid");
  }

  return issues;
}

export function inspectTextPackage(mission) {
  const issues = collectTextPackageIssues(mission);
  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze([...issues])
  });
}

function assertStrategyFoundation(mission) {
  const issues = strategyFoundationIssues(mission);
  if (issues.length > 0) {
    throw new TextPackageValidationError(
      `O pacote estratégico fechado é inválido: ${issues.join(", ")}.`
    );
  }
}

function requireTextPackage(mission) {
  if (!mission?.textPackage) {
    throw new TextPackageValidationError(
      "Modele o pacote textual antes de materializar seus ativos."
    );
  }
  const inspection = inspectTextPackage(mission);
  if (!inspection.valid) {
    throw new TextPackageValidationError(
      `O pacote textual preservado é inválido: ${inspection.issues.join(", ")}.`
    );
  }
  return mission.textPackage;
}

function freezeComponentIds(componentIds) {
  return Object.freeze({ ...componentIds });
}

function freezeSourceContext(source) {
  return Object.freeze({ ...source });
}

function freezeTraceability(traceability) {
  return Object.freeze({
    ...traceability,
    componentIds: freezeComponentIds(traceability.componentIds)
  });
}

function updateTextPackage(textPackage, changes, status, now) {
  return Object.freeze({
    ...textPackage,
    ...changes,
    status,
    updatedAt: now.toISOString()
  });
}

export function createTextPackage({
  mission,
  id = randomUUID(),
  now = new Date()
}) {
  assertStrategyFoundation(mission);
  if (mission.textPackage) {
    throw new TextPackageValidationError(
      "A missão já possui um pacote textual preservado."
    );
  }

  const timestamp = now.toISOString();
  return Object.freeze({
    schemaVersion: 1,
    id,
    missionId: mission.id,
    mode: "local_text_authoring_only",
    externalConnections: false,
    classification: "implementation_new_reconstruction",
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "modeled",
    traceability: freezeTraceability(expectedTraceability(mission)),
    sourceContext: freezeSourceContext(expectedSourceContext(mission)),
    safety: Object.freeze({
      deceptiveTitleAllowed: false,
      guaranteedClicks: false,
      guaranteedOutcome: false,
      unsupportedFactsAllowed: false,
      inventedTestimonialsAllowed: false,
      publishesContent: false,
      connectsAccount: false,
      requestsCredentials: false,
      createsCharge: false,
      webRadioLouvarMonetization: "permanently_disabled"
    })
  });
}

export function materializeFinalTitle({
  mission,
  assetId = randomUUID(),
  now = new Date()
}) {
  const textPackage = requireTextPackage(mission);
  if (textPackage.titleAsset) {
    throw new TextPackageValidationError("O título final já foi materializado.");
  }

  const title = mission.clickStrategy.title;
  assertThemeAlignment(title, mission.strategyBriefing.theme.value, "O título final");
  assertSafeAuthoredText(title, "O título final");
  const titleAsset = Object.freeze({
    schemaVersion: 1,
    id: assetId,
    kind: "final_title",
    text: title,
    createdAt: now.toISOString(),
    source: Object.freeze({
      strategyPackageId: mission.strategyPackage.id,
      clickStrategyId: mission.clickStrategy.id,
      theme: mission.strategyBriefing.theme.value,
      themeClassification: "anderson_input",
      reuse: "validated_strategy_component"
    }),
    safety: Object.freeze({
      deceptive: false,
      guaranteedClicks: false,
      guaranteedOutcome: false
    })
  });
  return updateTextPackage(
    textPackage,
    { titleAsset },
    "title_materialized",
    now
  );
}

export function materializeFinalDescription({
  mission,
  assetId = randomUUID(),
  now = new Date()
}) {
  const textPackage = requireTextPackage(mission);
  if (!textPackage.titleAsset) {
    throw new TextPackageValidationError(
      "Materialize o título final antes da descrição final."
    );
  }
  if (textPackage.descriptionAsset) {
    throw new TextPackageValidationError("A descrição final já foi materializada.");
  }

  const description = mission.descriptionStrategy.description;
  assertThemeAlignment(
    description,
    mission.strategyBriefing.theme.value,
    "A descrição final"
  );
  assertSafeAuthoredText(description, "A descrição final");
  const descriptionAsset = Object.freeze({
    schemaVersion: 1,
    id: assetId,
    kind: "final_description",
    text: description,
    createdAt: now.toISOString(),
    source: Object.freeze({
      strategyPackageId: mission.strategyPackage.id,
      descriptionStrategyId: mission.descriptionStrategy.id,
      titleAssetId: textPackage.titleAsset.id,
      theme: mission.strategyBriefing.theme.value,
      reuse: "validated_strategy_component"
    }),
    safety: Object.freeze({
      unsupportedClaimsAllowed: false,
      guaranteedOutcome: false,
      correspondsToPlannedContent: true
    })
  });
  return updateTextPackage(
    textPackage,
    { descriptionAsset },
    "description_materialized",
    now
  );
}

export function structureTextScript({
  mission,
  scriptId = randomUUID(),
  now = new Date()
}) {
  const textPackage = requireTextPackage(mission);
  if (!textPackage.descriptionAsset) {
    throw new TextPackageValidationError(
      "Materialize a descrição final antes de estruturar o roteiro."
    );
  }
  if (textPackage.script) {
    throw new TextPackageValidationError("O roteiro textual já foi estruturado.");
  }

  const stages = mission.retentionPlan.stages.map((retentionStage) =>
    Object.freeze({
      id: retentionStage.id,
      retentionStageId: retentionStage.id,
      objective: retentionStage.objective,
      sourceCriteriaIds: Object.freeze([...retentionStage.sourceCriteriaIds]),
      status: "planned",
      textAssetId: null
    })
  );
  if (
    stages.length !== SCRIPT_STAGE_IDS.length ||
    SCRIPT_STAGE_IDS.some((id, index) => stages[index]?.id !== id)
  ) {
    throw new TextPackageValidationError(
      "O plano de retenção não contém as quatro etapas obrigatórias."
    );
  }

  const script = Object.freeze({
    schemaVersion: 1,
    id: scriptId,
    status: "structured",
    createdAt: now.toISOString(),
    retentionPlanId: mission.retentionPlan.id,
    format: mission.strategyBriefing.constraints.format,
    stages: Object.freeze(stages),
    safety: Object.freeze({
      inventedFactsAllowed: false,
      inventedTestimonialsAllowed: false,
      guaranteedOutcome: false
    })
  });
  return updateTextPackage(
    textPackage,
    { script },
    "script_structured",
    now
  );
}

export function createValidatedTextOpening({
  mission,
  text,
  assetId = randomUUID(),
  now = new Date()
}) {
  const textPackage = requireTextPackage(mission);
  if (!textPackage.script) {
    throw new TextPackageValidationError(
      "Estruture o roteiro antes de criar a abertura textual."
    );
  }
  if (textPackage.openingAsset) {
    throw new TextPackageValidationError("A abertura textual já foi validada.");
  }

  const source = expectedSourceContext(mission);
  const maximum = OPENING_MAX_CHARACTERS[source.format];
  if (!maximum) {
    throw new TextPackageValidationError("O formato da abertura é inválido.");
  }
  const openingText = normalizeText(
    text,
    `Informe uma abertura textual entre 20 e ${maximum} caracteres.`,
    { min: 20, max: maximum }
  );
  assertThemeAlignment(openingText, source.theme, "A abertura textual");
  assertSafeAuthoredText(openingText, "A abertura textual");

  const timestamp = now.toISOString();
  const openingAsset = Object.freeze({
    schemaVersion: 1,
    id: assetId,
    kind: "script_opening",
    stageId: "opening",
    scriptId: textPackage.script.id,
    text: openingText,
    createdAt: timestamp,
    traceability: Object.freeze({
      textPackageId: textPackage.id,
      strategyPackageId: mission.strategyPackage.id,
      briefingId: mission.strategyBriefing.id,
      retentionPlanId: mission.retentionPlan.id,
      retentionStageId: "opening",
      theme: source.theme,
      themeClassification: source.themeClassification,
      objective: source.objective,
      audience: source.audience,
      format: source.format
    }),
    validation: Object.freeze({
      status: "valid",
      linkedInputs: Object.freeze([
        "theme",
        "objective",
        "audience",
        "format",
        "retention_opening"
      ]),
      themeAlignment: "validated_theme_overlap",
      deceptive: false,
      guaranteedOutcome: false,
      unsupportedFactsAllowed: false,
      inventedTestimonialsAllowed: false
    })
  });

  const stages = textPackage.script.stages.map((stage) =>
    stage.id === "opening"
      ? Object.freeze({
          ...stage,
          status: "validated",
          textAssetId: openingAsset.id
        })
      : Object.freeze({ ...stage })
  );
  const script = Object.freeze({
    ...textPackage.script,
    stages: Object.freeze(stages)
  });
  return updateTextPackage(
    textPackage,
    { script, openingAsset },
    "opening_validated",
    now
  );
}

function createValidatedTextStage({
  mission,
  stageId,
  text,
  assetId = randomUUID(),
  now = new Date()
}) {
  const config = SCRIPT_STAGE_CONFIG[stageId];
  if (!config) {
    throw new TextPackageValidationError("A etapa textual informada é inválida.");
  }

  const textPackage = requireTextPackage(mission);
  if (textPackage.status !== config.requiredStatus) {
    throw new TextPackageValidationError(
      `A etapa ${stageId} exige o estado ${config.requiredStatus}.`
    );
  }
  if (textPackage[config.assetProperty]) {
    throw new TextPackageValidationError(`A etapa ${stageId} já foi validada.`);
  }

  const source = expectedSourceContext(mission);
  const maximum = SCRIPT_STAGE_MAX_CHARACTERS[stageId]?.[source.format];
  if (!maximum) {
    throw new TextPackageValidationError(`O formato da etapa ${stageId} é inválido.`);
  }
  const authoredText = normalizeText(
    text,
    `Informe a etapa ${stageId} entre 20 e ${maximum} caracteres.`,
    { min: 20, max: maximum }
  );
  assertThemeAlignment(authoredText, source.theme, `A etapa ${stageId}`);
  assertSafeAuthoredText(authoredText, `A etapa ${stageId}`);

  const stageIndex = SCRIPT_STAGE_IDS.indexOf(stageId);
  const retentionStage = mission.retentionPlan.stages[stageIndex];
  if (
    retentionStage?.id !== stageId ||
    !Array.isArray(retentionStage.sourceCriteriaIds)
  ) {
    throw new TextPackageValidationError(
      `A etapa ${stageId} não corresponde ao plano de retenção preservado.`
    );
  }

  const timestamp = now.toISOString();
  const asset = Object.freeze({
    schemaVersion: 1,
    id: assetId,
    kind: config.kind,
    stageId,
    scriptId: textPackage.script.id,
    text: authoredText,
    createdAt: timestamp,
    traceability: Object.freeze({
      textPackageId: textPackage.id,
      strategyPackageId: mission.strategyPackage.id,
      briefingId: mission.strategyBriefing.id,
      retentionPlanId: mission.retentionPlan.id,
      retentionStageId: stageId,
      retentionStageObjective: retentionStage.objective,
      sourceCriteriaIds: Object.freeze([...retentionStage.sourceCriteriaIds]),
      theme: source.theme,
      themeClassification: source.themeClassification,
      objective: source.objective,
      audience: source.audience,
      format: source.format
    }),
    validation: Object.freeze({
      status: "valid",
      linkedInputs: Object.freeze([
        "theme",
        "objective",
        "audience",
        "format",
        `retention_${stageId}`
      ]),
      themeAlignment: "validated_theme_overlap",
      deceptive: false,
      guaranteedOutcome: false,
      unsupportedFactsAllowed: false,
      inventedTestimonialsAllowed: false
    })
  });

  const stages = textPackage.script.stages.map((stage) =>
    stage.id === stageId
      ? Object.freeze({ ...stage, status: "validated", textAssetId: asset.id })
      : Object.freeze({ ...stage })
  );
  const script = Object.freeze({
    ...textPackage.script,
    stages: Object.freeze(stages)
  });
  return updateTextPackage(
    textPackage,
    { script, [config.assetProperty]: asset },
    config.completedStatus,
    now
  );
}

export function createValidatedTextProgression(options) {
  return createValidatedTextStage({ ...options, stageId: "progression" });
}

export function createValidatedTextReengagement(options) {
  return createValidatedTextStage({ ...options, stageId: "reengagement" });
}

export function createValidatedTextClosing(options) {
  return createValidatedTextStage({ ...options, stageId: "closing" });
}

export function validateCompleteTextScript({ mission, now = new Date() }) {
  const textPackage = requireTextPackage(mission);
  if (textPackage.status !== "closing_validated") {
    throw new TextPackageValidationError(
      "Valide opening, progression, reengagement e closing antes do roteiro completo."
    );
  }

  const assets = [
    textPackage.openingAsset,
    textPackage.progressionAsset,
    textPackage.reengagementAsset,
    textPackage.closingAsset
  ];
  const stages = textPackage.script.stages;
  const validOrder = SCRIPT_STAGE_IDS.every(
    (stageId, index) =>
      stages[index]?.id === stageId &&
      stages[index]?.status === "validated" &&
      stages[index]?.textAssetId === assets[index]?.id &&
      assets[index]?.stageId === stageId
  );
  if (!validOrder || new Set(assets.map((asset) => asset?.id)).size !== 4) {
    throw new TextPackageValidationError(
      "As quatro etapas do roteiro não estão completas e na ordem obrigatória."
    );
  }

  const validation = Object.freeze({
    status: "valid",
    validatedAt: now.toISOString(),
    requiredOrder: Object.freeze([...SCRIPT_STAGE_IDS]),
    assetIds: Object.freeze(assets.map((asset) => asset.id)),
    orderValid: true,
    complete: true,
    traceabilityValid: true,
    safety: Object.freeze({
      unsupportedFactsAllowed: false,
      inventedTestimonialsAllowed: false,
      guaranteedOutcome: false
    })
  });
  const script = Object.freeze({
    ...textPackage.script,
    status: "complete_validated",
    validation
  });
  const continuation = Object.freeze({
    status: "open",
    nextStage: "text_package_continuation",
    externalConnections: false
  });
  return updateTextPackage(
    textPackage,
    { script, continuation },
    "complete_script_validated",
    now
  );
}

function assertContinuationCandidate(mission, textPackage) {
  const inspection = inspectTextPackage({ ...mission, textPackage });
  if (!inspection.valid) {
    throw new TextPackageValidationError(
      `A continuação do pacote textual é inválida: ${inspection.issues.join(", ")}.`
    );
  }
  return textPackage;
}

export function consolidateFinalTextScript({
  mission,
  assetId = randomUUID(),
  now = new Date()
}) {
  const textPackage = requireTextPackage(mission);
  if (textPackage.status !== "complete_script_validated") {
    throw new TextPackageValidationError(
      "Consolide o roteiro final somente depois da validação completa das quatro etapas."
    );
  }

  const stageAssets = scriptStageAssets(textPackage);
  const finalScriptAsset = Object.freeze({
    schemaVersion: 1,
    id: assetId,
    kind: "final_text_script",
    status: "consolidated",
    missionId: mission.id,
    textPackageId: textPackage.id,
    createdAt: now.toISOString(),
    source: Object.freeze({
      titleAssetId: textPackage.titleAsset.id,
      descriptionAssetId: textPackage.descriptionAsset.id,
      scriptId: textPackage.script.id,
      stageAssetIds: Object.freeze(stageAssets.map((asset) => asset.id))
    }),
    content: Object.freeze({
      title: textPackage.titleAsset.text,
      description: textPackage.descriptionAsset.text,
      stages: Object.freeze(
        stageAssets.map((asset, index) =>
          Object.freeze({
            stageId: SCRIPT_STAGE_IDS[index],
            textAssetId: asset.id,
            text: asset.text
          })
        )
      )
    }),
    traceability: Object.freeze({
      strategyPackageId: mission.strategyPackage.id,
      retentionPlanId: mission.retentionPlan.id,
      theme: mission.strategyBriefing.theme.value,
      themeClassification: "anderson_input",
      channelId: mission.channel.id,
      brainId: mission.brain.id,
      brainProfileVersion: mission.brain.profileVersion
    }),
    safety: Object.freeze({
      verbatimExistingAssets: true,
      addsClaims: false,
      unsupportedFactsAllowed: false,
      inventedTestimonialsAllowed: false,
      guaranteedOutcome: false
    })
  });
  const updated = updateTextPackage(
    textPackage,
    { finalScriptAsset },
    "final_script_consolidated",
    now
  );
  return assertContinuationCandidate(mission, updated);
}

export function materializeTextTransitionMap({
  mission,
  assetId = randomUUID(),
  now = new Date()
}) {
  const textPackage = requireTextPackage(mission);
  if (textPackage.status !== "final_script_consolidated") {
    throw new TextPackageValidationError(
      "Materialize as transições somente depois de consolidar o roteiro final."
    );
  }

  const stageAssets = scriptStageAssets(textPackage);
  const transitionMapAsset = Object.freeze({
    schemaVersion: 1,
    id: assetId,
    kind: "text_transition_map",
    status: "materialized",
    createdAt: now.toISOString(),
    finalScriptAssetId: textPackage.finalScriptAsset.id,
    scriptId: textPackage.script.id,
    order: Object.freeze([...SCRIPT_STAGE_IDS]),
    transitions: Object.freeze(
      SCRIPT_TRANSITIONS.map(([from, to], index) => {
        const fromIndex = SCRIPT_STAGE_IDS.indexOf(from);
        const toIndex = SCRIPT_STAGE_IDS.indexOf(to);
        return Object.freeze({
          id: `${assetId}-transition-${index + 1}`,
          fromStageId: from,
          toStageId: to,
          fromTextAssetId: stageAssets[fromIndex].id,
          toTextAssetId: stageAssets[toIndex].id,
          label: `Transição estrutural: ${from} -> ${to}`,
          source: "structural_link_only",
          addsClaims: false
        });
      })
    ),
    safety: Object.freeze({
      addsClaims: false,
      altersText: false,
      guaranteedOutcome: false
    }),
    externalConnections: false
  });
  const updated = updateTextPackage(
    textPackage,
    { transitionMapAsset },
    "transition_map_materialized",
    now
  );
  return assertContinuationCandidate(mission, updated);
}

export function registerTextSafetyOrigins({
  mission,
  registryId = randomUUID(),
  now = new Date()
}) {
  const textPackage = requireTextPackage(mission);
  if (textPackage.status !== "transition_map_materialized") {
    throw new TextPackageValidationError(
      "Registre segurança e origem somente depois do mapa de transições."
    );
  }

  const fragments = textFragments(textPackage);
  const sourceIds = [
    mission.clickStrategy.id,
    mission.descriptionStrategy.id,
    ...scriptStageAssets(textPackage).map((asset) => asset.id)
  ];
  const sourceKinds = [
    "click_strategy",
    "description_strategy",
    ...SCRIPT_STAGE_IDS.map(() => "validated_text_asset")
  ];
  const safetyOriginRegistry = Object.freeze({
    schemaVersion: 1,
    id: registryId,
    kind: "text_safety_origin_registry",
    status: "registered",
    createdAt: now.toISOString(),
    finalScriptAssetId: textPackage.finalScriptAsset.id,
    transitionMapAssetId: textPackage.transitionMapAsset.id,
    records: Object.freeze(
      fragments.map((fragment, index) =>
        Object.freeze({
          order: index + 1,
          role: fragment.role,
          assetId: fragment.assetId,
          contentHash: contentDigest(fragment.text),
          origin: Object.freeze({
            classification: "validated_local_source",
            sourceKind: sourceKinds[index],
            sourceId: sourceIds[index],
            themeClassification: "anderson_input"
          }),
          safety: Object.freeze({
            themeAligned: true,
            unsupportedFactsAllowed: false,
            inventedTestimonialsAllowed: false,
            guaranteedOutcome: false
          })
        })
      )
    ),
    policy: Object.freeze({
      unverifiedClaimsAllowed: false,
      inventedTestimonialsAllowed: false,
      guaranteedOutcome: false
    }),
    externalConnections: false
  });
  const updated = updateTextPackage(
    textPackage,
    { safetyOriginRegistry },
    "safety_origins_registered",
    now
  );
  return assertContinuationCandidate(mission, updated);
}

export function validateCompleteTextPackage({
  mission,
  validationId = randomUUID(),
  now = new Date()
}) {
  const textPackage = requireTextPackage(mission);
  if (textPackage.status !== "safety_origins_registered") {
    throw new TextPackageValidationError(
      "Valide o pacote textual somente depois do registro de segurança e origem."
    );
  }

  const fragments = textFragments(textPackage);
  const packageValidation = Object.freeze({
    schemaVersion: 1,
    id: validationId,
    kind: "complete_text_package_validation",
    status: "valid",
    validatedAt: now.toISOString(),
    finalScriptAssetId: textPackage.finalScriptAsset.id,
    transitionMapAssetId: textPackage.transitionMapAsset.id,
    safetyOriginRegistryId: textPackage.safetyOriginRegistry.id,
    requiredOrder: Object.freeze([...SCRIPT_STAGE_IDS]),
    fragmentAssetIds: Object.freeze(fragments.map((fragment) => fragment.assetId)),
    contentHashes: Object.freeze(
      fragments.map((fragment) => contentDigest(fragment.text))
    ),
    checks: Object.freeze({
      themeCorrespondence: true,
      titleCorrespondence: true,
      descriptionCorrespondence: true,
      scriptCorrespondence: true,
      orderIntegrity: true,
      transitionIntegrity: true,
      safetyIntegrity: true,
      traceabilityIntegrity: true
    }),
    externalConnections: false
  });
  const updated = updateTextPackage(
    textPackage,
    { packageValidation },
    "complete_package_validated",
    now
  );
  return assertContinuationCandidate(mission, updated);
}

export function closeTextPackageForScenePackage({
  mission,
  closureId = randomUUID(),
  now = new Date()
}) {
  const textPackage = requireTextPackage(mission);
  if (textPackage.status !== "complete_package_validated") {
    throw new TextPackageValidationError(
      "Feche o pacote textual somente depois da validação integral."
    );
  }

  const closure = Object.freeze({
    schemaVersion: 1,
    id: closureId,
    kind: "text_package_closure",
    status: "closed",
    closedAt: now.toISOString(),
    packageValidationId: textPackage.packageValidation.id,
    finalScriptAssetId: textPackage.finalScriptAsset.id,
    nextStage: "scene_package",
    readyForScenePackage: true,
    publishesContent: false,
    externalConnections: false
  });
  const continuation = Object.freeze({
    status: "closed",
    nextStage: "scene_package",
    externalConnections: false
  });
  const updated = updateTextPackage(
    textPackage,
    { closure, continuation },
    "ready_for_scene_package",
    now
  );
  return assertContinuationCandidate(mission, updated);
}
