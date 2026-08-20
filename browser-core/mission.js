import { randomUUID } from "./crypto-browser.js";
import {
  assessBrainAssignmentCompatibility,
  createBrainAssignment
} from "./brains.js";
import { findPilotChannel } from "./channels.js";
import { createRetentionPlan } from "./retention-plan.js";
import {
  closeValidatedScenePackage,
  createCaptionPlan,
  createDynamicVisualMap,
  createLocalDurationAllocationPlan,
  createLocalRenderPreparationPlan,
  createScenePackage,
  materializeMediaRequirementsPlan,
  materializeLocalSceneUnits,
  materializeMotionTransitionInstructions,
  materializeNarrationAsset,
  structureSceneStoryboard,
  structureCompositionTimelinePlan,
  structureLocalAudioLayerPlan,
  synchronizeSceneStructure,
  validateIntegratedSceneExecutionPlan
} from "./scene-package.js";
import { createStrategyBriefing } from "./strategy-briefing.js";
import {
  createClickStrategy,
  createDescriptionStrategy,
  createPublishingWindowStrategy,
  createStrategyPackage,
  validateCompleteStrategy
} from "./strategy-package.js";
import {
  closeTextPackageForScenePackage,
  consolidateFinalTextScript,
  createTextPackage,
  createValidatedTextClosing,
  createValidatedTextOpening,
  createValidatedTextProgression,
  createValidatedTextReengagement,
  materializeFinalDescription,
  materializeFinalTitle,
  materializeTextTransitionMap,
  registerTextSafetyOrigins,
  structureTextScript,
  validateCompleteTextPackage,
  validateCompleteTextScript
} from "./text-package.js";
import {
  closeValidationSafetyForAudit,
  consolidateIntegratedValidationSafetyReport,
  createRightsInventoryLock,
  evaluateRightsReadinessGate,
  materializeQualityCriteriaMatrix,
  materializeValidationSafetyEnforcementPolicy,
  sealValidationSafetyIntegritySnapshot,
  validateCompleteValidationSafety,
  validateContentSafetyAndOrigins,
  validateOperationalLocks
} from "./validation-safety.js";
import {
  closeAuditCheckpointsForAndroid,
  consolidateAuditCheckpointReadinessReport,
  materializeCheckpointPolicy,
  materializeAuthorizedStructuralExport,
  materializeImmutableAuditLedger,
  materializeSafeExportManifest,
  sealStructuralExportIntegrity,
  validateCompleteAuditCheckpoints,
  verifyIndependentStructuralRestore,
  validateCompleteAuditTrail
} from "./audit-checkpoints.js";
import {
  applyMobileErgonomicsContract,
  closeAndroidExperienceForFieldConnections,
  materializeAndroidCapabilityProfile,
  prepareOfflineInstallabilityPackage,
  validateCompleteAndroidExperience
} from "./android-experience.js";
import {
  consolidateInternalFieldHandoff,
  materializeFieldConnectorRegistry,
  prepareGoogleYouTubeOAuthContract,
  prepareTwoChannelConnectionPlan
} from "./field-connections.js";

export class MissionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "MissionValidationError";
  }
}

export const MISSION_STATUSES = Object.freeze([
  "draft",
  "in_progress",
  "paused",
  "completed"
]);

const allowedTransitions = Object.freeze({
  draft: Object.freeze(["in_progress"]),
  in_progress: Object.freeze(["paused", "completed"]),
  paused: Object.freeze([]),
  completed: Object.freeze([])
});

function freezeBrainSnapshot(assignment) {
  if (!assignment || typeof assignment !== "object") {
    return null;
  }

  return Object.freeze({
    id: assignment.id ?? null,
    name: assignment.name ?? null,
    channelId: assignment.channelId ?? null,
    profileVersion: assignment.profileVersion ?? null
  });
}

function sameBrainAssignment(left, right) {
  return Boolean(
    left &&
      right &&
      left.id === right.id &&
      left.name === right.name &&
      left.channelId === right.channelId &&
      left.profileVersion === right.profileVersion
  );
}

export function controlMissionBrainAssignment({
  mission,
  channelId,
  profileVersion
}) {
  if (!mission || typeof mission !== "object" || typeof mission.id !== "string") {
    throw new MissionValidationError("A missão informada é inválida.");
  }

  const channel = findPilotChannel(channelId);
  if (!channel) {
    throw new MissionValidationError("Escolha um dos dois canais piloto.");
  }

  if (
    profileVersion !== undefined &&
    (!Number.isInteger(profileVersion) || profileVersion < 1)
  ) {
    throw new MissionValidationError("A versão solicitada do cérebro é inválida.");
  }

  const current = mission.brain;
  const channelChanged = mission.channel?.id !== channelId;
  const currentAssessment = assessBrainAssignmentCompatibility({
    assignment: current,
    channelId
  });

  let target = current;
  let reason = null;

  if (channelChanged) {
    target = createBrainAssignment(channelId, { profileVersion });
    reason = "channel_changed";
  } else if (
    profileVersion !== undefined &&
    profileVersion !== current?.profileVersion
  ) {
    target = createBrainAssignment(channelId, {
      brainId: current?.id,
      profileVersion
    });
    reason = "profile_version_requested";
  } else if (!currentAssessment.compatible) {
    target = createBrainAssignment(channelId, { profileVersion });
    reason = "assignment_repaired";
  }

  if (!target) {
    throw new MissionValidationError(
      "A versão solicitada não é compatível com o canal da missão."
    );
  }

  const targetAssessment = assessBrainAssignmentCompatibility({
    assignment: target,
    channelId
  });
  if (!targetAssessment.compatible) {
    throw new MissionValidationError(
      "O cérebro selecionado não é compatível com o canal da missão."
    );
  }

  if (sameBrainAssignment(current, target)) {
    return Object.freeze({
      assignment: freezeBrainSnapshot(current),
      change: null
    });
  }

  return Object.freeze({
    assignment: target,
    change: Object.freeze({
      policy: "channel_compatible_versioned",
      reason,
      compatibility: targetAssessment.code,
      from: freezeBrainSnapshot(current),
      to: freezeBrainSnapshot(target)
    })
  });
}

export function createMission({
  title,
  channelId,
  project,
  id = randomUUID(),
  now = new Date()
}) {
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new MissionValidationError("Informe um título para a missão.");
  }

  const channel = findPilotChannel(channelId);
  if (!channel) {
    throw new MissionValidationError("Escolha um dos dois canais piloto.");
  }

  const brain = createBrainAssignment(channel.id);
  if (!brain) {
    throw new MissionValidationError("O canal ainda não possui um cérebro local válido.");
  }

  let linkedProject;
  if (project !== undefined && project !== null) {
    if (
      typeof project !== "object" ||
      typeof project.id !== "string" ||
      project.id.trim().length === 0 ||
      typeof project.name !== "string" ||
      project.name.trim().length === 0
    ) {
      throw new MissionValidationError("O projeto vinculado é inválido.");
    }

    linkedProject = Object.freeze({
      id: project.id,
      name: project.name
    });
  }

  const normalizedTitle = title.trim();
  const timestamp = now.toISOString();

  return Object.freeze({
    schemaVersion: linkedProject ? 3 : 2,
    id,
    title: normalizedTitle,
    channel: Object.freeze({
      id: channel.id,
      name: channel.name
    }),
    brain,
    ...(linkedProject ? { project: linkedProject } : {}),
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
    history: Object.freeze([
      Object.freeze({
        type: "mission.created",
        at: timestamp,
        title: normalizedTitle,
        channelId: channel.id,
        brainId: brain.id,
        ...(linkedProject ? { projectId: linkedProject.id } : {})
      })
    ])
  });
}

export function changeMissionStatus({ mission, status, now = new Date() }) {
  if (!mission || typeof mission !== "object" || typeof mission.id !== "string") {
    throw new MissionValidationError("A missão informada é inválida.");
  }

  if (!MISSION_STATUSES.includes(status)) {
    throw new MissionValidationError("O estado informado para a missão é inválido.");
  }

  const transitions = allowedTransitions[mission.status] ?? [];
  if (!transitions.includes(status)) {
    throw new MissionValidationError(
      `A missão não pode mudar de ${mission.status} para ${status}.`
    );
  }

  const timestamp = now.toISOString();
  return Object.freeze({
    ...mission,
    status,
    updatedAt: timestamp,
    history: Object.freeze([
      ...(Array.isArray(mission.history) ? mission.history : []),
      Object.freeze({
        type: "mission.status_changed",
        at: timestamp,
        from: mission.status,
        to: status
      })
    ])
  });
}

export function updateMissionDetails({
  mission,
  title = mission?.title,
  channelId = mission?.channel?.id,
  project = mission?.project,
  brainProfileVersion,
  now = new Date()
}) {
  if (!mission || typeof mission !== "object" || typeof mission.id !== "string") {
    throw new MissionValidationError("A missão informada é inválida.");
  }

  const validated = createMission({
    id: mission.id,
    title,
    channelId,
    project,
    now
  });
  const controlledBrain = controlMissionBrainAssignment({
    mission,
    channelId: validated.channel.id,
    profileVersion: brainProfileVersion
  });
  const fields = [];

  if (validated.title !== mission.title) {
    fields.push("title");
  }
  if (validated.channel.id !== mission.channel?.id) {
    fields.push("channel");
  }
  if (controlledBrain.change) {
    fields.push("brain");
  }
  if (validated.project?.id !== mission.project?.id) {
    fields.push("project");
  }

  if (fields.length === 0) {
    throw new MissionValidationError("Informe ao menos uma alteração para a missão.");
  }

  const timestamp = now.toISOString();
  return Object.freeze({
    ...mission,
    schemaVersion: validated.schemaVersion,
    title: validated.title,
    channel: validated.channel,
    brain: controlledBrain.assignment,
    ...(validated.project ? { project: validated.project } : {}),
    updatedAt: timestamp,
    history: Object.freeze([
      ...(Array.isArray(mission.history) ? mission.history : []),
      Object.freeze({
        type: "mission.updated",
        at: timestamp,
        fields: Object.freeze(fields),
        ...(controlledBrain.change
          ? { brainChange: controlledBrain.change }
          : {})
      })
    ])
  });
}

export function resumeMission({ mission, now = new Date() }) {
  if (!mission || typeof mission !== "object" || typeof mission.id !== "string") {
    throw new MissionValidationError("A missão informada é inválida.");
  }

  if (mission.status !== "paused") {
    throw new MissionValidationError("Somente uma missão pausada pode ser retomada.");
  }

  const timestamp = now.toISOString();
  return Object.freeze({
    ...mission,
    status: "in_progress",
    updatedAt: timestamp,
    history: Object.freeze([
      ...(Array.isArray(mission.history) ? mission.history : []),
      Object.freeze({
        type: "mission.resumed",
        at: timestamp,
        from: "paused",
        to: "in_progress"
      })
    ])
  });
}

export function applyStrategyBriefing({
  mission,
  theme,
  objective,
  audience,
  format,
  funnel,
  briefingId,
  now = new Date()
}) {
  if (!mission || typeof mission !== "object" || typeof mission.id !== "string") {
    throw new MissionValidationError("A missão informada é inválida.");
  }
  if (mission.strategyBriefing) {
    throw new MissionValidationError(
      "A missão já possui um briefing estratégico preservado."
    );
  }

  const briefing = createStrategyBriefing({
    mission,
    theme,
    objective,
    audience,
    format,
    funnel,
    ...(briefingId ? { id: briefingId } : {}),
    now
  });
  const timestamp = briefing.createdAt;

  return Object.freeze({
    ...mission,
    schemaVersion: Math.max(Number(mission.schemaVersion) || 1, 4),
    strategyBriefing: briefing,
    updatedAt: timestamp,
    history: Object.freeze([
      ...(Array.isArray(mission.history) ? mission.history : []),
      Object.freeze({
        type: "mission.strategy_briefing_created",
        at: timestamp,
        briefingId: briefing.id,
        brainId: briefing.brainContext.brainId,
        brainProfileVersion: briefing.brainContext.profileVersion,
        targetViews: briefing.funnel.targetViews,
        plannedReach: briefing.funnel.plannedReach
      })
    ])
  });
}

export function applyRetentionPlan({
  mission,
  retentionPlanId,
  now = new Date()
}) {
  if (!mission || typeof mission !== "object" || typeof mission.id !== "string") {
    throw new MissionValidationError("A missão informada é inválida.");
  }
  if (mission.retentionPlan) {
    throw new MissionValidationError(
      "A missão já possui um plano de retenção preservado."
    );
  }

  const retentionPlan = createRetentionPlan({
    mission,
    ...(retentionPlanId ? { id: retentionPlanId } : {}),
    now
  });
  const timestamp = retentionPlan.createdAt;

  return Object.freeze({
    ...mission,
    schemaVersion: Math.max(Number(mission.schemaVersion) || 1, 5),
    retentionPlan,
    updatedAt: timestamp,
    history: Object.freeze([
      ...(Array.isArray(mission.history) ? mission.history : []),
      Object.freeze({
        type: "mission.retention_plan_created",
        at: timestamp,
        retentionPlanId: retentionPlan.id,
        briefingId: retentionPlan.briefingId,
        format: retentionPlan.format,
        measurementStatus: retentionPlan.measurement.status
      })
    ])
  });
}

function assertStrategyStepAvailable(mission, property, message) {
  if (!mission || typeof mission !== "object" || typeof mission.id !== "string") {
    throw new MissionValidationError("A missão informada é inválida.");
  }
  if (mission[property]) {
    throw new MissionValidationError(message);
  }
}

function preserveStrategyStep({
  mission,
  property,
  value,
  schemaVersion,
  history
}) {
  const timestamp = value.createdAt ?? value.validatedAt ?? value.closedAt;
  return Object.freeze({
    ...mission,
    schemaVersion: Math.max(Number(mission.schemaVersion) || 1, schemaVersion),
    [property]: value,
    updatedAt: timestamp,
    history: Object.freeze([
      ...(Array.isArray(mission.history) ? mission.history : []),
      Object.freeze({ at: timestamp, ...history })
    ])
  });
}

export function applyClickStrategy({ mission, title, strategyId, now = new Date() }) {
  assertStrategyStepAvailable(
    mission,
    "clickStrategy",
    "A missão já possui uma estratégia de clique preservada."
  );
  const clickStrategy = createClickStrategy({
    mission,
    title,
    ...(strategyId ? { id: strategyId } : {}),
    now
  });
  return preserveStrategyStep({
    mission,
    property: "clickStrategy",
    value: clickStrategy,
    schemaVersion: 6,
    history: {
      type: "mission.click_strategy_created",
      clickStrategyId: clickStrategy.id,
      title: clickStrategy.title,
      guaranteed: false
    }
  });
}

export function applyDescriptionStrategy({
  mission,
  description,
  strategyId,
  now = new Date()
}) {
  assertStrategyStepAvailable(
    mission,
    "descriptionStrategy",
    "A missão já possui uma descrição estratégica preservada."
  );
  const descriptionStrategy = createDescriptionStrategy({
    mission,
    description,
    ...(strategyId ? { id: strategyId } : {}),
    now
  });
  return preserveStrategyStep({
    mission,
    property: "descriptionStrategy",
    value: descriptionStrategy,
    schemaVersion: 7,
    history: {
      type: "mission.description_strategy_created",
      descriptionStrategyId: descriptionStrategy.id,
      clickStrategyId: descriptionStrategy.clickStrategyId
    }
  });
}

export function applyPublishingWindowStrategy({
  mission,
  timeZone,
  daysOfWeek,
  startLocalTime,
  endLocalTime,
  rationale,
  strategyId,
  now = new Date()
}) {
  assertStrategyStepAvailable(
    mission,
    "publishingWindowStrategy",
    "A missão já possui uma janela de publicação preservada."
  );
  const publishingWindowStrategy = createPublishingWindowStrategy({
    mission,
    timeZone,
    daysOfWeek,
    startLocalTime,
    endLocalTime,
    rationale,
    ...(strategyId ? { id: strategyId } : {}),
    now
  });
  return preserveStrategyStep({
    mission,
    property: "publishingWindowStrategy",
    value: publishingWindowStrategy,
    schemaVersion: 8,
    history: {
      type: "mission.publishing_window_strategy_created",
      publishingWindowStrategyId: publishingWindowStrategy.id,
      classification: publishingWindowStrategy.hypothesis.classification,
      publishesContent: false
    }
  });
}

export function applyStrategyValidation({
  mission,
  validationId,
  now = new Date()
}) {
  assertStrategyStepAvailable(
    mission,
    "strategyValidation",
    "A missão já possui uma validação estratégica preservada."
  );
  const strategyValidation = validateCompleteStrategy({
    mission,
    ...(validationId ? { id: validationId } : {}),
    now
  });
  return preserveStrategyStep({
    mission,
    property: "strategyValidation",
    value: strategyValidation,
    schemaVersion: 9,
    history: {
      type: "mission.strategy_validated",
      strategyValidationId: strategyValidation.id,
      valid: true
    }
  });
}

export function closeMissionStrategyPackage({
  mission,
  packageId,
  now = new Date()
}) {
  assertStrategyStepAvailable(
    mission,
    "strategyPackage",
    "A missão já possui um pacote estratégico fechado."
  );
  const strategyPackage = createStrategyPackage({
    mission,
    ...(packageId ? { id: packageId } : {}),
    now
  });
  return preserveStrategyStep({
    mission,
    property: "strategyPackage",
    value: strategyPackage,
    schemaVersion: 10,
    history: {
      type: "mission.strategy_package_closed",
      strategyPackageId: strategyPackage.id,
      status: strategyPackage.status,
      publishesContent: false
    }
  });
}

function preserveTextPackageStep({
  mission,
  textPackage,
  schemaVersion,
  history
}) {
  const timestamp = textPackage.updatedAt;
  return Object.freeze({
    ...mission,
    schemaVersion: Math.max(Number(mission.schemaVersion) || 1, schemaVersion),
    textPackage,
    updatedAt: timestamp,
    history: Object.freeze([
      ...(Array.isArray(mission.history) ? mission.history : []),
      Object.freeze({ at: timestamp, ...history })
    ])
  });
}

export function openMissionTextPackage({
  mission,
  packageId,
  now = new Date()
}) {
  assertStrategyStepAvailable(
    mission,
    "textPackage",
    "A missão já possui um pacote textual preservado."
  );
  const textPackage = createTextPackage({
    mission,
    ...(packageId ? { id: packageId } : {}),
    now
  });
  return preserveTextPackageStep({
    mission,
    textPackage,
    schemaVersion: 11,
    history: {
      type: "mission.text_package_created",
      textPackageId: textPackage.id,
      strategyPackageId: textPackage.traceability.strategyPackageId,
      classification: textPackage.classification,
      externalConnections: false
    }
  });
}

export function materializeMissionTextTitle({
  mission,
  assetId,
  now = new Date()
}) {
  const textPackage = materializeFinalTitle({
    mission,
    ...(assetId ? { assetId } : {}),
    now
  });
  return preserveTextPackageStep({
    mission,
    textPackage,
    schemaVersion: 12,
    history: {
      type: "mission.text_title_materialized",
      textPackageId: textPackage.id,
      titleAssetId: textPackage.titleAsset.id,
      clickStrategyId: textPackage.titleAsset.source.clickStrategyId,
      themePreserved: true,
      guaranteedOutcome: false
    }
  });
}

export function materializeMissionTextDescription({
  mission,
  assetId,
  now = new Date()
}) {
  const textPackage = materializeFinalDescription({
    mission,
    ...(assetId ? { assetId } : {}),
    now
  });
  return preserveTextPackageStep({
    mission,
    textPackage,
    schemaVersion: 13,
    history: {
      type: "mission.text_description_materialized",
      textPackageId: textPackage.id,
      descriptionAssetId: textPackage.descriptionAsset.id,
      descriptionStrategyId:
        textPackage.descriptionAsset.source.descriptionStrategyId,
      unsupportedClaimsAllowed: false
    }
  });
}

export function structureMissionTextScript({
  mission,
  scriptId,
  now = new Date()
}) {
  const textPackage = structureTextScript({
    mission,
    ...(scriptId ? { scriptId } : {}),
    now
  });
  return preserveTextPackageStep({
    mission,
    textPackage,
    schemaVersion: 14,
    history: {
      type: "mission.text_script_structured",
      textPackageId: textPackage.id,
      scriptId: textPackage.script.id,
      retentionPlanId: textPackage.script.retentionPlanId,
      stages: Object.freeze(textPackage.script.stages.map((stage) => stage.id))
    }
  });
}

export function applyMissionTextOpening({
  mission,
  text,
  assetId,
  now = new Date()
}) {
  const textPackage = createValidatedTextOpening({
    mission,
    text,
    ...(assetId ? { assetId } : {}),
    now
  });
  return preserveTextPackageStep({
    mission,
    textPackage,
    schemaVersion: 15,
    history: {
      type: "mission.text_opening_validated",
      textPackageId: textPackage.id,
      scriptId: textPackage.script.id,
      openingAssetId: textPackage.openingAsset.id,
      themeClassification:
        textPackage.openingAsset.traceability.themeClassification,
      guaranteedOutcome: false,
      publishesContent: false
    }
  });
}

function applyMissionAuthoredTextStage({
  mission,
  text,
  assetId,
  now,
  creator,
  assetProperty,
  schemaVersion,
  historyType
}) {
  const textPackage = creator({
    mission,
    text,
    ...(assetId ? { assetId } : {}),
    now
  });
  const asset = textPackage[assetProperty];
  return preserveTextPackageStep({
    mission,
    textPackage,
    schemaVersion,
    history: {
      type: historyType,
      textPackageId: textPackage.id,
      scriptId: textPackage.script.id,
      textAssetId: asset.id,
      retentionStageId: asset.traceability.retentionStageId,
      guaranteedOutcome: false,
      publishesContent: false
    }
  });
}

export function applyMissionTextProgression({
  mission,
  text,
  assetId,
  now = new Date()
}) {
  return applyMissionAuthoredTextStage({
    mission,
    text,
    assetId,
    now,
    creator: createValidatedTextProgression,
    assetProperty: "progressionAsset",
    schemaVersion: 16,
    historyType: "mission.text_progression_validated"
  });
}

export function applyMissionTextReengagement({
  mission,
  text,
  assetId,
  now = new Date()
}) {
  return applyMissionAuthoredTextStage({
    mission,
    text,
    assetId,
    now,
    creator: createValidatedTextReengagement,
    assetProperty: "reengagementAsset",
    schemaVersion: 17,
    historyType: "mission.text_reengagement_validated"
  });
}

export function applyMissionTextClosing({
  mission,
  text,
  assetId,
  now = new Date()
}) {
  return applyMissionAuthoredTextStage({
    mission,
    text,
    assetId,
    now,
    creator: createValidatedTextClosing,
    assetProperty: "closingAsset",
    schemaVersion: 18,
    historyType: "mission.text_closing_validated"
  });
}

export function validateMissionCompleteTextScript({
  mission,
  now = new Date()
}) {
  const textPackage = validateCompleteTextScript({ mission, now });
  return preserveTextPackageStep({
    mission,
    textPackage,
    schemaVersion: 19,
    history: {
      type: "mission.text_script_complete_validated",
      textPackageId: textPackage.id,
      scriptId: textPackage.script.id,
      stageOrder: textPackage.script.validation.requiredOrder,
      continuationStatus: textPackage.continuation.status,
      externalConnections: false
    }
  });
}

export function consolidateMissionFinalTextScript({
  mission,
  assetId,
  now = new Date()
}) {
  const textPackage = consolidateFinalTextScript({
    mission,
    ...(assetId ? { assetId } : {}),
    now
  });
  return preserveTextPackageStep({
    mission,
    textPackage,
    schemaVersion: 20,
    history: {
      type: "mission.final_text_script_consolidated",
      textPackageId: textPackage.id,
      finalScriptAssetId: textPackage.finalScriptAsset.id,
      sourceAssetIds: Object.freeze([
        textPackage.finalScriptAsset.source.titleAssetId,
        textPackage.finalScriptAsset.source.descriptionAssetId,
        ...textPackage.finalScriptAsset.source.stageAssetIds
      ]),
      addsClaims: false
    }
  });
}

export function materializeMissionTextTransitionMap({
  mission,
  assetId,
  now = new Date()
}) {
  const textPackage = materializeTextTransitionMap({
    mission,
    ...(assetId ? { assetId } : {}),
    now
  });
  return preserveTextPackageStep({
    mission,
    textPackage,
    schemaVersion: 21,
    history: {
      type: "mission.text_transition_map_materialized",
      textPackageId: textPackage.id,
      transitionMapAssetId: textPackage.transitionMapAsset.id,
      transitions: textPackage.transitionMapAsset.transitions.length,
      addsClaims: false
    }
  });
}

export function registerMissionTextSafetyOrigins({
  mission,
  registryId,
  now = new Date()
}) {
  const textPackage = registerTextSafetyOrigins({
    mission,
    ...(registryId ? { registryId } : {}),
    now
  });
  return preserveTextPackageStep({
    mission,
    textPackage,
    schemaVersion: 22,
    history: {
      type: "mission.text_safety_origins_registered",
      textPackageId: textPackage.id,
      safetyOriginRegistryId: textPackage.safetyOriginRegistry.id,
      records: textPackage.safetyOriginRegistry.records.length,
      unverifiedClaimsAllowed: false
    }
  });
}

export function validateMissionCompleteTextPackage({
  mission,
  validationId,
  now = new Date()
}) {
  const textPackage = validateCompleteTextPackage({
    mission,
    ...(validationId ? { validationId } : {}),
    now
  });
  return preserveTextPackageStep({
    mission,
    textPackage,
    schemaVersion: 23,
    history: {
      type: "mission.text_package_complete_validated",
      textPackageId: textPackage.id,
      packageValidationId: textPackage.packageValidation.id,
      checks: Object.freeze({ ...textPackage.packageValidation.checks }),
      externalConnections: false
    }
  });
}

export function closeMissionTextPackage({
  mission,
  closureId,
  now = new Date()
}) {
  const textPackage = closeTextPackageForScenePackage({
    mission,
    ...(closureId ? { closureId } : {}),
    now
  });
  return preserveTextPackageStep({
    mission,
    textPackage,
    schemaVersion: 24,
    history: {
      type: "mission.text_package_closed",
      textPackageId: textPackage.id,
      closureId: textPackage.closure.id,
      nextStage: textPackage.closure.nextStage,
      readyForScenePackage: true,
      publishesContent: false,
      externalConnections: false
    }
  });
}

function preserveScenePackageStep({
  mission,
  scenePackage,
  schemaVersion,
  history
}) {
  const timestamp = scenePackage.updatedAt;
  return Object.freeze({
    ...mission,
    schemaVersion: Math.max(Number(mission.schemaVersion) || 1, schemaVersion),
    scenePackage,
    updatedAt: timestamp,
    history: Object.freeze([
      ...(Array.isArray(mission.history) ? mission.history : []),
      Object.freeze({ at: timestamp, ...history })
    ])
  });
}

export function openMissionScenePackage({
  mission,
  packageId,
  now = new Date()
}) {
  const scenePackage = createScenePackage({
    mission,
    ...(packageId ? { id: packageId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 25,
    history: {
      type: "mission.scene_package_created",
      scenePackageId: scenePackage.id,
      textPackageClosureId: scenePackage.source.textPackageClosureId,
      dynamicVisualRequired: true,
      externalConnections: false
    }
  });
}

export function structureMissionSceneStoryboard({
  mission,
  storyboardId,
  now = new Date()
}) {
  const scenePackage = structureSceneStoryboard({
    mission,
    ...(storyboardId ? { storyboardId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 26,
    history: {
      type: "mission.scene_storyboard_structured",
      scenePackageId: scenePackage.id,
      storyboardId: scenePackage.storyboard.id,
      stageOrder: scenePackage.storyboard.order,
      segments: scenePackage.storyboard.segments.length
    }
  });
}

export function materializeMissionNarration({
  mission,
  assetId,
  now = new Date()
}) {
  const scenePackage = materializeNarrationAsset({
    mission,
    ...(assetId ? { assetId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 27,
    history: {
      type: "mission.narration_materialized",
      scenePackageId: scenePackage.id,
      narrationAssetId: scenePackage.narrationAsset.id,
      voiceExecution: "not_started",
      addsClaims: false
    }
  });
}

export function createMissionCaptionPlan({
  mission,
  planId,
  now = new Date()
}) {
  const scenePackage = createCaptionPlan({
    mission,
    ...(planId ? { planId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 28,
    history: {
      type: "mission.caption_plan_created",
      scenePackageId: scenePackage.id,
      captionPlanId: scenePackage.captionPlan.id,
      cues: scenePackage.captionPlan.cues.length,
      timingStatus: scenePackage.captionPlan.timingStatus
    }
  });
}

export function createMissionDynamicVisualMap({
  mission,
  mapId,
  now = new Date()
}) {
  const scenePackage = createDynamicVisualMap({
    mission,
    ...(mapId ? { mapId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 29,
    history: {
      type: "mission.dynamic_visual_map_created",
      scenePackageId: scenePackage.id,
      visualMapId: scenePackage.visualMap.id,
      stagePlans: scenePackage.visualMap.stagePlans.length,
      singleStaticImageAllowed: false,
      nextStage: scenePackage.continuation.nextStage,
      externalConnections: false
    }
  });
}

export function materializeMissionSceneUnits({
  mission,
  planId,
  now = new Date()
}) {
  const scenePackage = materializeLocalSceneUnits({
    mission,
    ...(planId ? { planId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 30,
    history: {
      type: "mission.scene_units_materialized",
      scenePackageId: scenePackage.id,
      sceneUnitPlanId: scenePackage.sceneUnitPlan.id,
      units: scenePackage.sceneUnitPlan.units.length,
      retrievesMedia: false,
      externalConnections: false
    }
  });
}

export function createMissionSceneDurationPlan({
  mission,
  planId,
  now = new Date()
}) {
  const scenePackage = createLocalDurationAllocationPlan({
    mission,
    ...(planId ? { planId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 31,
    history: {
      type: "mission.scene_duration_estimated",
      scenePackageId: scenePackage.id,
      durationPlanId: scenePackage.durationPlan.id,
      classification: scenePackage.durationPlan.classification,
      exactTiming: false,
      externalConnections: false
    }
  });
}

export function synchronizeMissionSceneStructure({
  mission,
  planId,
  now = new Date()
}) {
  const scenePackage = synchronizeSceneStructure({
    mission,
    ...(planId ? { planId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 32,
    history: {
      type: "mission.scene_structure_synchronized",
      scenePackageId: scenePackage.id,
      synchronizationPlanId: scenePackage.synchronizationPlan.id,
      timingStatus: scenePackage.synchronizationPlan.timingStatus,
      textPreserved: true,
      externalConnections: false
    }
  });
}

export function materializeMissionSceneMotionPlan({
  mission,
  planId,
  now = new Date()
}) {
  const scenePackage = materializeMotionTransitionInstructions({
    mission,
    ...(planId ? { planId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 33,
    history: {
      type: "mission.scene_motion_transitions_materialized",
      scenePackageId: scenePackage.id,
      motionPlanId: scenePackage.motionPlan.id,
      instructions: scenePackage.motionPlan.instructions.length,
      singleStaticCompositionAllowed: false,
      externalConnections: false
    }
  });
}

export function validateMissionIntegratedScenePlan({
  mission,
  planId,
  now = new Date()
}) {
  const scenePackage = validateIntegratedSceneExecutionPlan({
    mission,
    ...(planId ? { planId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 34,
    history: {
      type: "mission.integrated_scene_plan_validated",
      scenePackageId: scenePackage.id,
      integratedExecutionPlanId: scenePackage.integratedExecutionPlan.id,
      status: scenePackage.integratedExecutionPlan.status,
      executionStatus: "not_started",
      nextPoint: scenePackage.continuation.nextPoint,
      externalConnections: false
    }
  });
}

export function materializeMissionMediaRequirements({
  mission,
  planId,
  now = new Date()
}) {
  const scenePackage = materializeMediaRequirementsPlan({
    mission,
    ...(planId ? { planId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 35,
    history: {
      type: "mission.media_requirements_materialized",
      scenePackageId: scenePackage.id,
      mediaRequirementsPlanId: scenePackage.mediaRequirementsPlan.id,
      requirements: scenePackage.mediaRequirementsPlan.requirements.length,
      singleStaticAssetAcrossVideoAllowed: false,
      externalConnections: false
    }
  });
}

export function structureMissionAudioLayers({
  mission,
  planId,
  now = new Date()
}) {
  const scenePackage = structureLocalAudioLayerPlan({
    mission,
    ...(planId ? { planId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 36,
    history: {
      type: "mission.audio_layers_structured",
      scenePackageId: scenePackage.id,
      audioLayerPlanId: scenePackage.audioLayerPlan.id,
      classification: scenePackage.audioLayerPlan.classification,
      audioFilesCreated: false,
      externalConnections: false
    }
  });
}

export function structureMissionCompositionTimeline({
  mission,
  planId,
  now = new Date()
}) {
  const scenePackage = structureCompositionTimelinePlan({
    mission,
    ...(planId ? { planId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 37,
    history: {
      type: "mission.composition_timeline_structured",
      scenePackageId: scenePackage.id,
      compositionPlanId: scenePackage.compositionPlan.id,
      units: scenePackage.compositionPlan.units.length,
      singleStaticCompositionAllowed: false,
      externalConnections: false
    }
  });
}

export function createMissionRenderPreparationPlan({
  mission,
  planId,
  now = new Date()
}) {
  const scenePackage = createLocalRenderPreparationPlan({
    mission,
    ...(planId ? { planId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 38,
    history: {
      type: "mission.render_preparation_planned",
      scenePackageId: scenePackage.id,
      renderPlanId: scenePackage.renderPlan.id,
      renderAllowed: false,
      blockers: scenePackage.renderPlan.blockers,
      externalConnections: false
    }
  });
}

export function closeMissionScenePackage({
  mission,
  validationId,
  closureId,
  now = new Date()
}) {
  const scenePackage = closeValidatedScenePackage({
    mission,
    ...(validationId ? { validationId } : {}),
    ...(closureId ? { closureId } : {}),
    now
  });
  return preserveScenePackageStep({
    mission,
    scenePackage,
    schemaVersion: 39,
    history: {
      type: "mission.scene_package_closed",
      scenePackageId: scenePackage.id,
      validationId: scenePackage.scenePackageValidation.id,
      closureId: scenePackage.closure.id,
      structuralPackageComplete: true,
      realMediaExecutionPending: true,
      nextStage: "validation-safety",
      renderExecuted: false,
      published: false,
      externalConnections: false
    }
  });
}

function preserveValidationSafetyStep({
  mission,
  validationSafety,
  schemaVersion,
  history
}) {
  const timestamp = validationSafety.updatedAt;
  return Object.freeze({
    ...mission,
    schemaVersion: Math.max(Number(mission.schemaVersion) || 1, schemaVersion),
    validationSafety,
    updatedAt: timestamp,
    history: Object.freeze([
      ...(Array.isArray(mission.history) ? mission.history : []),
      Object.freeze({ at: timestamp, ...history })
    ])
  });
}

export function materializeMissionQualityCriteriaMatrix({
  mission,
  validationSafetyId,
  matrixId,
  now = new Date()
}) {
  const validationSafety = materializeQualityCriteriaMatrix({
    mission,
    ...(validationSafetyId ? { id: validationSafetyId } : {}),
    ...(matrixId ? { matrixId } : {}),
    now
  });
  return preserveValidationSafetyStep({
    mission,
    validationSafety,
    schemaVersion: 40,
    history: {
      type: "mission.quality_criteria_matrix_materialized",
      validationSafetyId: validationSafety.id,
      qualityCriteriaMatrixId: validationSafety.qualityCriteriaMatrix.id,
      scopes: validationSafety.qualityCriteriaMatrix.criteria.map(
        (criterion) => criterion.scope
      ),
      validatedAssetsChanged: false,
      externalConnections: false
    }
  });
}

export function materializeMissionRightsInventory({
  mission,
  inventoryId,
  now = new Date()
}) {
  const validationSafety = createRightsInventoryLock({
    mission,
    ...(inventoryId ? { inventoryId } : {}),
    now
  });
  return preserveValidationSafetyStep({
    mission,
    validationSafety,
    schemaVersion: 41,
    history: {
      type: "mission.rights_inventory_blocked",
      validationSafetyId: validationSafety.id,
      rightsInventoryId: validationSafety.rightsInventory.id,
      entries: validationSafety.rightsInventory.entries.length,
      realAssetsRegistered: 0,
      externalConnections: false
    }
  });
}

export function validateMissionContentSafety({
  mission,
  validationId,
  now = new Date()
}) {
  const validationSafety = validateContentSafetyAndOrigins({
    mission,
    ...(validationId ? { validationId } : {}),
    now
  });
  return preserveValidationSafetyStep({
    mission,
    validationSafety,
    schemaVersion: 42,
    history: {
      type: "mission.content_safety_validated",
      validationSafetyId: validationSafety.id,
      contentSafetyValidationId:
        validationSafety.contentSafetyValidation.id,
      records: validationSafety.contentSafetyValidation.records.length,
      openIssues: 0,
      externalConnections: false
    }
  });
}

export function validateMissionOperationalLocks({
  mission,
  locksId,
  now = new Date()
}) {
  const validationSafety = validateOperationalLocks({
    mission,
    ...(locksId ? { locksId } : {}),
    now
  });
  return preserveValidationSafetyStep({
    mission,
    validationSafety,
    schemaVersion: 43,
    history: {
      type: "mission.operational_locks_validated",
      validationSafetyId: validationSafety.id,
      operationalLocksId: validationSafety.operationalLocks.id,
      locks: validationSafety.operationalLocks.locks.length,
      renderAllowed: false,
      externalConnections: false
    }
  });
}

export function consolidateMissionValidationSafetyReport({
  mission,
  reportId,
  now = new Date()
}) {
  const validationSafety = consolidateIntegratedValidationSafetyReport({
    mission,
    ...(reportId ? { reportId } : {}),
    now
  });
  return preserveValidationSafetyStep({
    mission,
    validationSafety,
    schemaVersion: 44,
    history: {
      type: "mission.validation_safety_report_consolidated",
      validationSafetyId: validationSafety.id,
      integratedReportId: validationSafety.integratedReport.id,
      status: validationSafety.integratedReport.status,
      nextPoint: validationSafety.continuation.nextPoint,
      realAssetExecutionAllowed: false,
      externalConnections: false
    }
  });
}

export function sealMissionValidationSafetyIntegrity({
  mission,
  snapshotId,
  now = new Date()
}) {
  const validationSafety = sealValidationSafetyIntegritySnapshot({
    mission,
    ...(snapshotId ? { snapshotId } : {}),
    now
  });
  return preserveValidationSafetyStep({
    mission,
    validationSafety,
    schemaVersion: 45,
    history: {
      type: "mission.validation_safety_integrity_sealed",
      validationSafetyId: validationSafety.id,
      integritySnapshotId: validationSafety.integritySnapshot.id,
      records: validationSafety.integritySnapshot.records.length,
      mutationDetected: false,
      externalConnections: false
    }
  });
}

export function evaluateMissionRightsReadiness({
  mission,
  gateId,
  now = new Date()
}) {
  const validationSafety = evaluateRightsReadinessGate({
    mission,
    ...(gateId ? { gateId } : {}),
    now
  });
  return preserveValidationSafetyStep({
    mission,
    validationSafety,
    schemaVersion: 46,
    history: {
      type: "mission.rights_readiness_evaluated",
      validationSafetyId: validationSafety.id,
      rightsReadinessGateId: validationSafety.rightsReadinessGate.id,
      readyEntries: 0,
      blockedEntries: validationSafety.rightsReadinessGate.blockedEntries,
      realAssetExecutionAllowed: false,
      externalConnections: false
    }
  });
}

export function materializeMissionValidationSafetyEnforcementPolicy({
  mission,
  policyId,
  now = new Date()
}) {
  const validationSafety = materializeValidationSafetyEnforcementPolicy({
    mission,
    ...(policyId ? { policyId } : {}),
    now
  });
  return preserveValidationSafetyStep({
    mission,
    validationSafety,
    schemaVersion: 47,
    history: {
      type: "mission.validation_safety_policy_activated",
      validationSafetyId: validationSafety.id,
      enforcementPolicyId: validationSafety.enforcementPolicy.id,
      rules: validationSafety.enforcementPolicy.rules.length,
      mode: "deny_by_default",
      automaticBypassAllowed: false,
      externalConnections: false
    }
  });
}

export function validateMissionCompleteValidationSafety({
  mission,
  validationId,
  now = new Date()
}) {
  const validationSafety = validateCompleteValidationSafety({
    mission,
    ...(validationId ? { validationId } : {}),
    now
  });
  return preserveValidationSafetyStep({
    mission,
    validationSafety,
    schemaVersion: 48,
    history: {
      type: "mission.validation_safety_complete_validation",
      validationSafetyId: validationSafety.id,
      completeValidationId: validationSafety.completeValidation.id,
      status: validationSafety.completeValidation.status,
      safeBlockers: validationSafety.completeValidation.safeBlockers,
      openIssues: 0,
      externalConnections: false
    }
  });
}

export function closeMissionValidationSafety({
  mission,
  closureId,
  now = new Date()
}) {
  const validationSafety = closeValidationSafetyForAudit({
    mission,
    ...(closureId ? { closureId } : {}),
    now
  });
  return preserveValidationSafetyStep({
    mission,
    validationSafety,
    schemaVersion: 49,
    history: {
      type: "mission.validation_safety_closed",
      validationSafetyId: validationSafety.id,
      closureId: validationSafety.closure.id,
      readyForAuditCheckpoints: true,
      nextStage: "audit-checkpoints",
      realAssetExecutionAllowed: false,
      published: false,
      externalConnections: false
    }
  });
}

function preserveAuditCheckpointsStep({
  mission,
  auditCheckpoints,
  schemaVersion,
  history
}) {
  const timestamp = auditCheckpoints.updatedAt;
  return Object.freeze({
    ...mission,
    schemaVersion: Math.max(Number(mission.schemaVersion) || 1, schemaVersion),
    auditCheckpoints,
    updatedAt: timestamp,
    history: Object.freeze([
      ...(Array.isArray(mission.history) ? mission.history : []),
      Object.freeze({ at: timestamp, ...history })
    ])
  });
}

export function materializeMissionAuditLedger({
  mission,
  auditCheckpointsId,
  ledgerId,
  now = new Date()
}) {
  const auditCheckpoints = materializeImmutableAuditLedger({
    mission,
    ...(auditCheckpointsId ? { id: auditCheckpointsId } : {}),
    ...(ledgerId ? { ledgerId } : {}),
    now
  });
  return preserveAuditCheckpointsStep({
    mission,
    auditCheckpoints,
    schemaVersion: 50,
    history: {
      type: "mission.audit_ledger_materialized",
      auditCheckpointsId: auditCheckpoints.id,
      auditLedgerId: auditCheckpoints.auditLedger.id,
      sourceHistoryLength: auditCheckpoints.auditLedger.sourceHistoryLength,
      sourceHistoryRewritten: false,
      externalConnections: false
    }
  });
}

export function materializeMissionCheckpointPolicy({
  mission,
  policyId,
  now = new Date()
}) {
  const auditCheckpoints = materializeCheckpointPolicy({
    mission,
    ...(policyId ? { policyId } : {}),
    now
  });
  return preserveAuditCheckpointsStep({
    mission,
    auditCheckpoints,
    schemaVersion: 51,
    history: {
      type: "mission.checkpoint_policy_activated",
      auditCheckpointsId: auditCheckpoints.id,
      checkpointPolicyId: auditCheckpoints.checkpointPolicy.id,
      requirements: auditCheckpoints.checkpointPolicy.requirements.length,
      hashAlgorithm: "sha256",
      externalConnections: false
    }
  });
}

export function materializeMissionSafeExportManifest({
  mission,
  manifestId,
  now = new Date()
}) {
  const auditCheckpoints = materializeSafeExportManifest({
    mission,
    ...(manifestId ? { manifestId } : {}),
    now
  });
  return preserveAuditCheckpointsStep({
    mission,
    auditCheckpoints,
    schemaVersion: 52,
    history: {
      type: "mission.safe_export_manifest_materialized",
      auditCheckpointsId: auditCheckpoints.id,
      exportManifestId: auditCheckpoints.exportManifest.id,
      structuralEntries: auditCheckpoints.exportManifest.entries.length,
      credentialsIncluded: false,
      realMediaIncluded: false,
      externalConnections: false
    }
  });
}

export function validateMissionAuditTrail({
  mission,
  validationId,
  now = new Date()
}) {
  const auditCheckpoints = validateCompleteAuditTrail({
    mission,
    ...(validationId ? { validationId } : {}),
    now
  });
  return preserveAuditCheckpointsStep({
    mission,
    auditCheckpoints,
    schemaVersion: 53,
    history: {
      type: "mission.audit_trail_validated",
      auditCheckpointsId: auditCheckpoints.id,
      trailValidationId: auditCheckpoints.trailValidation.id,
      gaps: 0,
      openIssues: 0,
      externalConnections: false
    }
  });
}

export function consolidateMissionAuditReadinessReport({
  mission,
  reportId,
  now = new Date()
}) {
  const auditCheckpoints = consolidateAuditCheckpointReadinessReport({
    mission,
    ...(reportId ? { reportId } : {}),
    now
  });
  return preserveAuditCheckpointsStep({
    mission,
    auditCheckpoints,
    schemaVersion: 54,
    history: {
      type: "mission.audit_readiness_report_consolidated",
      auditCheckpointsId: auditCheckpoints.id,
      readinessReportId: auditCheckpoints.readinessReport.id,
      checkpointReady: true,
      stageStatus: "open",
      nextPoint: 86,
      externalConnections: false
    }
  });
}

export function materializeMissionStructuralExportBundle({
  mission,
  bundleId,
  now = new Date()
}) {
  const auditCheckpoints = materializeAuthorizedStructuralExport({
    mission,
    ...(bundleId ? { bundleId } : {}),
    now
  });
  return preserveAuditCheckpointsStep({
    mission,
    auditCheckpoints,
    schemaVersion: 55,
    history: {
      type: "mission.structural_export_bundle_materialized",
      auditCheckpointsId: auditCheckpoints.id,
      structuralExportBundleId: auditCheckpoints.structuralExportBundle.id,
      records: auditCheckpoints.structuralExportBundle.recordCount,
      realMediaIncluded: false,
      credentialsIncluded: false,
      externalConnections: false
    }
  });
}

export function sealMissionStructuralExportIntegrity({
  mission,
  sealId,
  now = new Date()
}) {
  const auditCheckpoints = sealStructuralExportIntegrity({
    mission,
    ...(sealId ? { sealId } : {}),
    now
  });
  return preserveAuditCheckpointsStep({
    mission,
    auditCheckpoints,
    schemaVersion: 56,
    history: {
      type: "mission.structural_export_integrity_sealed",
      auditCheckpointsId: auditCheckpoints.id,
      exportIntegritySealId: auditCheckpoints.exportIntegritySeal.id,
      records: auditCheckpoints.exportIntegritySeal.records.length,
      mutationDetected: false,
      externalConnections: false
    }
  });
}

export function verifyMissionStructuralExportRestore({
  mission,
  verificationId,
  now = new Date()
}) {
  const auditCheckpoints = verifyIndependentStructuralRestore({
    mission,
    ...(verificationId ? { verificationId } : {}),
    now
  });
  return preserveAuditCheckpointsStep({
    mission,
    auditCheckpoints,
    schemaVersion: 57,
    history: {
      type: "mission.structural_export_restore_verified",
      auditCheckpointsId: auditCheckpoints.id,
      restoreVerificationId: auditCheckpoints.restoreVerification.id,
      mode: auditCheckpoints.restoreVerification.mode,
      openIssues: 0,
      externalConnections: false
    }
  });
}

export function validateMissionCompleteAuditCheckpoints({
  mission,
  validationId,
  now = new Date()
}) {
  const auditCheckpoints = validateCompleteAuditCheckpoints({
    mission,
    ...(validationId ? { validationId } : {}),
    now
  });
  return preserveAuditCheckpointsStep({
    mission,
    auditCheckpoints,
    schemaVersion: 58,
    history: {
      type: "mission.audit_checkpoints_complete_validation",
      auditCheckpointsId: auditCheckpoints.id,
      completeValidationId: auditCheckpoints.completeValidation.id,
      checkpointReady: true,
      openIssues: 0,
      externalConnections: false
    }
  });
}

export function closeMissionAuditCheckpoints({
  mission,
  closureId,
  now = new Date()
}) {
  const auditCheckpoints = closeAuditCheckpointsForAndroid({
    mission,
    ...(closureId ? { closureId } : {}),
    now
  });
  return preserveAuditCheckpointsStep({
    mission,
    auditCheckpoints,
    schemaVersion: 59,
    history: {
      type: "mission.audit_checkpoints_closed",
      auditCheckpointsId: auditCheckpoints.id,
      closureId: auditCheckpoints.closure.id,
      readyForAndroidExperience: true,
      nextStage: "android-experience",
      structuralExportVerified: true,
      published: false,
      externalConnections: false
    }
  });
}

function preserveAndroidExperienceStep({
  mission,
  androidExperience,
  schemaVersion,
  history
}) {
  const timestamp = androidExperience.updatedAt;
  return Object.freeze({
    ...mission,
    schemaVersion: Math.max(Number(mission.schemaVersion) || 1, schemaVersion),
    androidExperience,
    updatedAt: timestamp,
    history: Object.freeze([
      ...(Array.isArray(mission.history) ? mission.history : []),
      Object.freeze({ at: timestamp, ...history })
    ])
  });
}

export function materializeMissionAndroidCapabilityProfile({
  mission,
  androidExperienceId,
  profileId,
  now = new Date()
}) {
  const androidExperience = materializeAndroidCapabilityProfile({
    mission,
    ...(androidExperienceId ? { id: androidExperienceId } : {}),
    ...(profileId ? { profileId } : {}),
    now
  });
  return preserveAndroidExperienceStep({
    mission,
    androidExperience,
    schemaVersion: 60,
    history: {
      type: "mission.android_capability_profile_materialized",
      androidExperienceId: androidExperience.id,
      capabilityProfileId: androidExperience.capabilityProfile.id,
      evidence: "local_configuration_only",
      realAndroidDeviceTested: false,
      externalConnections: false
    }
  });
}

export function applyMissionMobileErgonomicsContract({
  mission,
  contractId,
  now = new Date()
}) {
  const androidExperience = applyMobileErgonomicsContract({
    mission,
    ...(contractId ? { contractId } : {}),
    now
  });
  return preserveAndroidExperienceStep({
    mission,
    androidExperience,
    schemaVersion: 61,
    history: {
      type: "mission.mobile_ergonomics_contract_applied",
      androidExperienceId: androidExperience.id,
      ergonomicsContractId: androidExperience.ergonomicsContract.id,
      minimumTouchTargetCssPixels: 44,
      minimumViewportCssPixels: 320,
      assetsMutated: false,
      externalConnections: false
    }
  });
}

export function prepareMissionOfflineInstallability({
  mission,
  packageId,
  now = new Date()
}) {
  const androidExperience = prepareOfflineInstallabilityPackage({
    mission,
    ...(packageId ? { packageId } : {}),
    now
  });
  return preserveAndroidExperienceStep({
    mission,
    androidExperience,
    schemaVersion: 62,
    history: {
      type: "mission.offline_installability_prepared",
      androidExperienceId: androidExperience.id,
      installabilityPackageId: androidExperience.installabilityPackage.id,
      offlineShellPrepared: true,
      apiMutationsUseNetworkOnly: true,
      published: false,
      externalConnections: false
    }
  });
}

export function validateMissionCompleteAndroidExperience({
  mission,
  validationId,
  now = new Date()
}) {
  const androidExperience = validateCompleteAndroidExperience({
    mission,
    ...(validationId ? { validationId } : {}),
    now
  });
  return preserveAndroidExperienceStep({
    mission,
    androidExperience,
    schemaVersion: 63,
    history: {
      type: "mission.android_experience_validated",
      androidExperienceId: androidExperience.id,
      completeValidationId: androidExperience.completeValidation.id,
      realAndroidDeviceTestPending: true,
      openIssues: 0,
      fieldConnectionsStarted: false,
      externalConnections: false
    }
  });
}

export function closeMissionAndroidExperience({
  mission,
  reportId,
  closureId,
  now = new Date()
}) {
  const androidExperience = closeAndroidExperienceForFieldConnections({
    mission,
    ...(reportId ? { reportId } : {}),
    ...(closureId ? { closureId } : {}),
    now
  });
  return preserveAndroidExperienceStep({
    mission,
    androidExperience,
    schemaVersion: 64,
    history: {
      type: "mission.android_experience_closed",
      androidExperienceId: androidExperience.id,
      readinessReportId: androidExperience.readinessReport.id,
      closureId: androidExperience.closure.id,
      readyForFieldConnections: true,
      nextStage: "field-connections",
      fieldConnectionsStarted: false,
      realAndroidDeviceTested: false,
      published: false,
      externalConnections: false
    }
  });
}

function preserveFieldConnectionsStep({
  mission,
  fieldConnections,
  schemaVersion,
  history
}) {
  const timestamp = fieldConnections.updatedAt;
  return Object.freeze({
    ...mission,
    schemaVersion: Math.max(Number(mission.schemaVersion) || 1, schemaVersion),
    fieldConnections,
    updatedAt: timestamp,
    history: Object.freeze([
      ...(Array.isArray(mission.history) ? mission.history : []),
      Object.freeze({ at: timestamp, ...history })
    ])
  });
}

export function materializeMissionFieldConnectorRegistry({
  mission,
  fieldConnectionsId,
  registryId,
  now = new Date()
}) {
  const fieldConnections = materializeFieldConnectorRegistry({
    mission,
    ...(fieldConnectionsId ? { id: fieldConnectionsId } : {}),
    ...(registryId ? { registryId } : {}),
    now
  });
  return preserveFieldConnectionsStep({
    mission,
    fieldConnections,
    schemaVersion: 65,
    history: {
      type: "mission.field_connector_registry_materialized",
      fieldConnectionsId: fieldConnections.id,
      connectorRegistryId: fieldConnections.connectorRegistry.id,
      connectors: fieldConnections.connectorRegistry.connectors.length,
      connectionAttempts: 0,
      accountsConnected: 0,
      externalConnections: false
    }
  });
}

export function prepareMissionGoogleYouTubeOAuthContract({
  mission,
  contractId,
  now = new Date()
}) {
  const fieldConnections = prepareGoogleYouTubeOAuthContract({
    mission,
    ...(contractId ? { contractId } : {}),
    now
  });
  return preserveFieldConnectionsStep({
    mission,
    fieldConnections,
    schemaVersion: 66,
    history: {
      type: "mission.google_youtube_oauth_contract_prepared",
      fieldConnectionsId: fieldConnections.id,
      oauthContractId: fieldConnections.oauthContract.id,
      stateRequired: true,
      pkceRequired: true,
      secretValuesStored: false,
      tokenExchangeExecuted: false,
      externalConnections: false
    }
  });
}

export function prepareMissionTwoChannelConnectionPlan({
  mission,
  planId,
  now = new Date()
}) {
  const fieldConnections = prepareTwoChannelConnectionPlan({
    mission,
    ...(planId ? { planId } : {}),
    now
  });
  return preserveFieldConnectionsStep({
    mission,
    fieldConnections,
    schemaVersion: 67,
    history: {
      type: "mission.two_channel_connection_plan_prepared",
      fieldConnectionsId: fieldConnections.id,
      channelConnectionPlanId: fieldConnections.channelConnectionPlan.id,
      channels: fieldConnections.channelConnectionPlan.channels.length,
      dryRunOnly: true,
      publishingEnabled: false,
      externalConnections: false
    }
  });
}

export function consolidateMissionInternalFieldHandoff({
  mission,
  handoffId,
  now = new Date()
}) {
  const fieldConnections = consolidateInternalFieldHandoff({
    mission,
    ...(handoffId ? { handoffId } : {}),
    now
  });
  return preserveFieldConnectionsStep({
    mission,
    fieldConnections,
    schemaVersion: 68,
    history: {
      type: "mission.field_connections_internal_handoff_consolidated",
      fieldConnectionsId: fieldConnections.id,
      internalHandoffId: fieldConnections.internalHandoff.id,
      internalWorkExhausted: true,
      waitingForAnderson: true,
      nextPoint: 100,
      point100Started: false,
      credentialsRequestedInChat: false,
      connectionAttempts: 0,
      accountsConnected: 0,
      published: false,
      externalConnections: false
    }
  });
}
