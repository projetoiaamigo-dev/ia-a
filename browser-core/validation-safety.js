import { createHash, randomUUID } from "./crypto-browser.js";
import { inspectScenePackage } from "./scene-package.js";
import { inspectTextPackage } from "./text-package.js";

const STAGE_IDS = Object.freeze([
  "opening",
  "progression",
  "reengagement",
  "closing"
]);

const QUALITY_SCOPES = Object.freeze([
  "project",
  "mission",
  "strategy",
  "text_package",
  "scene_package"
]);

const OPERATION_LOCK_IDS = Object.freeze([
  "publishing",
  "account_connections",
  "credential_requests",
  "charging",
  "external_connections",
  "rendering_without_real_assets",
  "media_use_without_confirmed_rights",
  "single_static_composition"
]);

const ENFORCEMENT_RULE_IDS = Object.freeze([
  "content_origin_required",
  "unsupported_claims_blocked",
  "outcome_guarantees_blocked",
  "rights_evidence_required",
  "external_connections_blocked",
  "publication_requires_authorization",
  "credentials_blocked",
  "charging_blocked",
  "render_requires_real_assets",
  "single_static_composition_blocked"
]);

const FINAL_SAFE_BLOCKERS = Object.freeze([
  "real_assets_not_registered",
  "rights_evidence_not_registered",
  "external_connections_disabled",
  "publication_not_authorized"
]);

export class ValidationSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationSafetyError";
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
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}

function stageAssets(textPackage) {
  return [
    textPackage.openingAsset,
    textPackage.progressionAsset,
    textPackage.reengagementAsset,
    textPackage.closingAsset
  ];
}

function textFragments(mission) {
  const textPackage = mission.textPackage;
  return [
    { role: "title", asset: textPackage.titleAsset },
    { role: "description", asset: textPackage.descriptionAsset },
    ...STAGE_IDS.map((role, index) => ({
      role,
      asset: stageAssets(textPackage)[index]
    }))
  ];
}

function assertClosedSourcePackages(mission) {
  const textInspection = inspectTextPackage(mission);
  const sceneInspection = inspectScenePackage(mission);
  const textPackage = mission?.textPackage;
  const scenePackage = mission?.scenePackage;
  if (
    !textInspection.valid ||
    !sceneInspection.valid ||
    textPackage?.status !== "ready_for_scene_package" ||
    textPackage.closure?.status !== "closed" ||
    scenePackage?.status !== "ready_for_validation_safety" ||
    scenePackage.closure?.status !== "closed" ||
    scenePackage.closure?.readyForValidationSafety !== true ||
    scenePackage.closure?.nextStage !== "validation-safety" ||
    scenePackage.continuation?.lastCompletedPoint !== 70 ||
    scenePackage.continuation?.nextPoint !== 71
  ) {
    throw new ValidationSafetyError(
      "O pacote de cenas precisa estar fechado, íntegro e pronto para validation-safety."
    );
  }
  return { textPackage, scenePackage };
}

function expectedSource(mission) {
  return {
    projectId: mission.project?.id ?? null,
    projectName: mission.project?.name ?? null,
    missionId: mission.id,
    missionTitle: mission.title,
    channelId: mission.channel.id,
    brainId: mission.brain.id,
    brainProfileVersion: mission.brain.profileVersion,
    strategyPackageId: mission.strategyPackage.id,
    textPackageId: mission.textPackage.id,
    textPackageValidationId: mission.textPackage.packageValidation.id,
    scenePackageId: mission.scenePackage.id,
    scenePackageClosureId: mission.scenePackage.closure.id,
    theme: mission.textPackage.sourceContext.theme,
    themeClassification: mission.textPackage.sourceContext.themeClassification
  };
}

function expectedRightsSources(mission) {
  const scenePackage = mission.scenePackage;
  return [
    ...scenePackage.mediaRequirementsPlan.requirements.map((requirement) => ({
      assetType: "dynamic_visual_media",
      sourceRequirementId: requirement.id,
      stageId: requirement.stageId
    })),
    {
      assetType: "narration_audio",
      sourceRequirementId: scenePackage.audioLayerPlan.tracks.narration.id,
      stageId: null
    },
    {
      assetType: "background_music",
      sourceRequirementId: scenePackage.audioLayerPlan.tracks.backgroundMusic.id,
      stageId: null
    },
    ...scenePackage.audioLayerPlan.tracks.soundEffects.cues.map((cue) => ({
      assetType: "sound_effect",
      sourceRequirementId: cue.id,
      stageId: null
    }))
  ];
}

function validationSafetyAt75Snapshot(validationSafety) {
  return {
    source: validationSafety.source,
    qualityCriteriaMatrix: validationSafety.qualityCriteriaMatrix,
    rightsInventory: validationSafety.rightsInventory,
    contentSafetyValidation: validationSafety.contentSafetyValidation,
    operationalLocks: validationSafety.operationalLocks,
    integratedReport: validationSafety.integratedReport
  };
}

function expectedIntegrityRecords(mission, validationSafety) {
  const records = [
    {
      scope: "mission_identity",
      sourceId: mission.id,
      value: {
        id: mission.id,
        title: mission.title,
        project: mission.project ?? null,
        channel: mission.channel,
        brain: mission.brain
      }
    },
    {
      scope: "strategy_package",
      sourceId: mission.strategyPackage.id,
      value: mission.strategyPackage
    },
    {
      scope: "text_package",
      sourceId: mission.textPackage.id,
      value: mission.textPackage
    },
    {
      scope: "scene_package",
      sourceId: mission.scenePackage.id,
      value: mission.scenePackage
    },
    {
      scope: "validation_safety_75",
      sourceId: validationSafety.integratedReport.id,
      value: validationSafetyAt75Snapshot(validationSafety)
    }
  ];
  return records.map(({ value, ...record }) => ({
    ...record,
    digest: contentDigest(JSON.stringify(value))
  }));
}

function expectedContinuation(validationSafety) {
  const completedPoint = validationSafety.closure
    ? 80
    : validationSafety.completeValidation
      ? 79
      : validationSafety.enforcementPolicy
        ? 78
        : validationSafety.rightsReadinessGate
          ? 77
          : validationSafety.integritySnapshot
            ? 76
            : validationSafety.integratedReport
              ? 75
              : validationSafety.operationalLocks
                ? 74
                : validationSafety.contentSafetyValidation
                  ? 73
                  : validationSafety.rightsInventory
                    ? 72
                    : 71;
  return {
    status: validationSafety.closure ? "closed" : "open",
    lastCompletedPoint: completedPoint,
    nextPoint: completedPoint + 1,
    nextStage: validationSafety.closure
      ? "audit-checkpoints"
      : "validation-safety",
    externalConnections: false
  };
}

function buildContentSafetyChecks(mission) {
  const textPackage = mission.textPackage;
  const scenePackage = mission.scenePackage;
  const assets = stageAssets(textPackage);
  const origins = textPackage.safetyOriginRegistry.records;
  const fragments = textFragments(mission);
  return {
    themePreserved:
      textPackage.sourceContext.theme === mission.strategyBriefing.theme.value,
    titlePreserved: textPackage.titleAsset.text === mission.clickStrategy.title,
    descriptionPreserved:
      textPackage.descriptionAsset.text === mission.descriptionStrategy.description,
    scriptPreserved: assets.every(
      (asset, index) =>
        textPackage.finalScriptAsset.content.stages[index]?.stageId ===
          STAGE_IDS[index] &&
        textPackage.finalScriptAsset.content.stages[index]?.text === asset.text
    ),
    narrationPreserved: assets.every(
      (asset, index) =>
        scenePackage.narrationAsset.segments[index]?.stageId === STAGE_IDS[index] &&
        scenePackage.narrationAsset.segments[index]?.text === asset.text
    ),
    captionsPreserved: assets.every(
      (asset, index) =>
        scenePackage.captionPlan.cues[index]?.stageId === STAGE_IDS[index] &&
        scenePackage.captionPlan.cues[index]?.text === asset.text
    ),
    stageOrderPreserved:
      arraysEqual(
        textPackage.finalScriptAsset.content.stages.map((stage) => stage.stageId),
        STAGE_IDS
      ) &&
      arraysEqual(scenePackage.storyboard.order, STAGE_IDS),
    claimOriginsRegistered: fragments.every(
      (fragment, index) =>
        origins[index]?.role === fragment.role &&
        origins[index]?.assetId === fragment.asset.id &&
        origins[index]?.contentHash === contentDigest(fragment.asset.text) &&
        origins[index]?.origin?.classification === "validated_local_source"
    ),
    unsupportedClaimsBlocked:
      textPackage.safetyOriginRegistry.policy.unverifiedClaimsAllowed === false,
    inventedTestimonialsBlocked:
      textPackage.safetyOriginRegistry.policy.inventedTestimonialsAllowed === false,
    guaranteedOutcomesBlocked:
      textPackage.safetyOriginRegistry.policy.guaranteedOutcome === false &&
      mission.strategyPackage.safety.guaranteedOutcome === false,
    guaranteedClicksBlocked:
      mission.strategyPackage.safety.guaranteedClicks === false,
    guaranteedReachBlocked:
      mission.strategyBriefing.funnel.expectedViewsRange.guaranteed === false &&
      mission.strategyBriefing.outcomePolicy.guaranteeAllowed === false,
    retentionGuaranteesBlocked:
      mission.retentionPlan.measurement.guaranteed === false,
    estimatesClearlyClassified:
      scenePackage.durationPlan.classification ===
        "local_estimate_without_audio" &&
      scenePackage.compositionPlan.timingClassification ===
        "local_estimate_without_real_audio_or_media"
  };
}

function buildOperationalChecks(mission, validationSafety) {
  const scenePackage = mission.scenePackage;
  const inventory = validationSafety.rightsInventory;
  return {
    publishingBlocked:
      mission.strategyPackage.safety.publishesContent === false &&
      scenePackage.closure.published === false,
    accountConnectionsBlocked:
      mission.strategyPackage.safety.connectsAccount === false &&
      scenePackage.renderPlan.safety.connectsAccount === false,
    credentialRequestsBlocked:
      mission.strategyPackage.safety.requestsCredentials === false &&
      scenePackage.renderPlan.safety.requestsCredentials === false,
    chargingBlocked:
      mission.strategyPackage.safety.createsCharge === false &&
      scenePackage.renderPlan.safety.createsCharge === false,
    externalConnectionsBlocked:
      mission.strategyBriefing.externalConnections === false &&
      mission.strategyPackage.externalConnections === false &&
      mission.textPackage.externalConnections === false &&
      scenePackage.externalConnections === false,
    renderBlockedWithoutAssets:
      scenePackage.renderPlan.renderAllowed === false &&
      scenePackage.renderPlan.executionStatus === "not_started" &&
      scenePackage.renderPlan.outputFile === null &&
      scenePackage.renderPlan.blockers.length > 0,
    mediaBlockedWithoutRights:
      inventory.entries.every(
        (entry) =>
          entry.rightsStatus === "required_before_use" &&
          entry.useAllowed === false
      ),
    dynamicVisualRequired:
      scenePackage.safety.dynamicVisualRequired === true &&
      scenePackage.safety.singleStaticImageAllowed === false &&
      scenePackage.compositionPlan.singleStaticCompositionAllowed === false,
    webRadioLouvarMonetizationPreserved: true
  };
}

function collectValidationSafetyIssues(mission) {
  const validationSafety = mission?.validationSafety;
  if (!validationSafety) return [];

  const issues = [];
  try {
    assertClosedSourcePackages(mission);
  } catch {
    return ["validation_safety_source_invalid"];
  }

  if (
    validationSafety.missionId !== mission.id ||
    validationSafety.mode !== "local_validation_only" ||
    validationSafety.classification !== "implementation_new_reconstruction" ||
    validationSafety.externalConnections !== false ||
    Object.entries(expectedSource(mission)).some(
      ([key, value]) => validationSafety.source?.[key] !== value
    )
  ) {
    issues.push("validation_safety_identity_invalid");
  }

  const matrix = validationSafety.qualityCriteriaMatrix;
  if (
    !matrix ||
    matrix.kind !== "local_quality_criteria_matrix" ||
    matrix.status !== "materialized" ||
    matrix.validationSafetyId !== validationSafety.id ||
    !Array.isArray(matrix.criteria) ||
    matrix.criteria.length !== QUALITY_SCOPES.length ||
    QUALITY_SCOPES.some((scope, index) => {
      const criterion = matrix.criteria[index];
      return (
        criterion?.scope !== scope ||
        Object.values(criterion?.checks ?? {}).some((value) => value !== true)
      );
    }) ||
    matrix.mutationPolicy?.modifiesValidatedAssets !== false ||
    matrix.mutationPolicy?.preservesSourceVersions !== true ||
    matrix.externalConnections !== false
  ) {
    issues.push("validation_quality_matrix_invalid");
  }

  const rightsInventory = validationSafety.rightsInventory;
  if (rightsInventory && !matrix) {
    issues.push("validation_rights_before_quality_matrix");
  }
  const rightsSources = expectedRightsSources(mission);
  if (
    rightsInventory &&
    (rightsInventory.kind !== "local_rights_inventory" ||
      rightsInventory.status !== "blocked_pending_rights" ||
      rightsInventory.qualityCriteriaMatrixId !== matrix?.id ||
      rightsInventory.realAssetsRegistered !== 0 ||
      rightsInventory.allFutureAssetsBlocked !== true ||
      !Array.isArray(rightsInventory.entries) ||
      rightsInventory.entries.length !== rightsSources.length ||
      rightsSources.some((source, index) => {
        const entry = rightsInventory.entries[index];
        return (
          entry?.sequence !== index + 1 ||
          entry?.assetType !== source.assetType ||
          entry?.sourceRequirementId !== source.sourceRequirementId ||
          entry?.stageId !== source.stageId ||
          entry?.assetId !== null ||
          entry?.originRecord !== null ||
          entry?.rightsEvidence !== null ||
          entry?.rightsStatus !== "required_before_use" ||
          entry?.useAllowed !== false
        );
      }) ||
      rightsInventory.locks?.useWithoutOrigin !== true ||
      rightsInventory.locks?.useWithoutRightsEvidence !== true ||
      rightsInventory.locks?.unknownRights !== true ||
      rightsInventory.safety?.retrievesMedia !== false ||
      rightsInventory.safety?.generatesMedia !== false ||
      rightsInventory.safety?.downloadsMedia !== false ||
      rightsInventory.externalConnections !== false)
  ) {
    issues.push("validation_rights_inventory_invalid");
  }

  const contentSafety = validationSafety.contentSafetyValidation;
  if (contentSafety && !rightsInventory) {
    issues.push("validation_content_safety_before_rights");
  }
  const fragments = textFragments(mission);
  const originRecords = mission.textPackage.safetyOriginRegistry.records;
  const expectedContentChecks = buildContentSafetyChecks(mission);
  if (
    contentSafety &&
    (contentSafety.kind !== "content_safety_validation" ||
      contentSafety.status !== "valid" ||
      contentSafety.rightsInventoryId !== rightsInventory?.id ||
      !arraysEqual(contentSafety.requiredStageOrder, STAGE_IDS) ||
      !Array.isArray(contentSafety.records) ||
      contentSafety.records.length !== fragments.length ||
      fragments.some((fragment, index) => {
        const record = contentSafety.records[index];
        return (
          record?.sequence !== index + 1 ||
          record?.role !== fragment.role ||
          record?.assetId !== fragment.asset.id ||
          record?.contentHash !== contentDigest(fragment.asset.text) ||
          record?.originRegistryId !==
            mission.textPackage.safetyOriginRegistry.id ||
          record?.originRecordOrder !== originRecords[index]?.order ||
          record?.preservedText !== true
        );
      }) ||
      Object.entries(expectedContentChecks).some(
        ([key, value]) => value !== true || contentSafety.checks?.[key] !== true
      ) ||
      contentSafety.openIssues?.length !== 0 ||
      contentSafety.externalConnections !== false)
  ) {
    issues.push("validation_content_safety_invalid");
  }

  const operationalLocks = validationSafety.operationalLocks;
  if (operationalLocks && !contentSafety) {
    issues.push("validation_operational_locks_before_content_safety");
  }
  const expectedOperationalChecks = rightsInventory
    ? buildOperationalChecks(mission, validationSafety)
    : {};
  if (
    operationalLocks &&
    (operationalLocks.kind !== "local_operational_locks" ||
      operationalLocks.status !== "validated_blocked" ||
      operationalLocks.contentSafetyValidationId !== contentSafety?.id ||
      !Array.isArray(operationalLocks.locks) ||
      operationalLocks.locks.length !== OPERATION_LOCK_IDS.length ||
      OPERATION_LOCK_IDS.some(
        (lockId, index) =>
          operationalLocks.locks[index]?.id !== lockId ||
          operationalLocks.locks[index]?.status !== "blocked"
      ) ||
      !arraysEqual(
        operationalLocks.renderBlockers,
        mission.scenePackage.renderPlan.blockers
      ) ||
      operationalLocks.renderAllowed !== false ||
      operationalLocks.runtime?.localOnly !== true ||
      operationalLocks.runtime?.defaultAddress !== "127.0.0.1" ||
      operationalLocks.monetization?.webRadioLouvar !==
        "permanently_disabled" ||
      Object.entries(expectedOperationalChecks).some(
        ([key, value]) => value !== true || operationalLocks.checks?.[key] !== true
      ) ||
      operationalLocks.externalConnections !== false)
  ) {
    issues.push("validation_operational_locks_invalid");
  }

  const report = validationSafety.integratedReport;
  if (report && !operationalLocks) {
    issues.push("validation_report_before_operational_locks");
  }
  if (
    report &&
    (report.kind !== "integrated_quality_rights_safety_report" ||
      report.status !== "valid" ||
      report.qualityCriteriaMatrixId !== matrix?.id ||
      report.rightsInventoryId !== rightsInventory?.id ||
      report.contentSafetyValidationId !== contentSafety?.id ||
      report.operationalLocksId !== operationalLocks?.id ||
      report.summary?.quality !== "valid" ||
      report.summary?.rights !== "blocked_pending_rights" ||
      report.summary?.contentSafety !== "valid" ||
      report.summary?.operations !== "blocked" ||
      report.summary?.realAssetExecutionAllowed !== false ||
      Object.values(report.checks ?? {}).some((value) => value !== true) ||
      report.openIssues?.length !== 0 ||
      report.stageStatus !== "open" ||
      report.readyForNextValidationSafety !== true ||
      report.nextStage !== "validation-safety" ||
      report.externalConnections !== false)
  ) {
    issues.push("validation_integrated_report_invalid");
  }

  const integritySnapshot = validationSafety.integritySnapshot;
  if (integritySnapshot && !report) {
    issues.push("validation_integrity_before_report");
  }
  const integrityRecords = report
    ? expectedIntegrityRecords(mission, validationSafety)
    : [];
  if (
    integritySnapshot &&
    (integritySnapshot.kind !== "validation_safety_integrity_snapshot" ||
      integritySnapshot.status !== "sealed" ||
      integritySnapshot.integratedReportId !== report?.id ||
      integritySnapshot.algorithm !== "sha256" ||
      integritySnapshot.mutationDetected !== false ||
      !Array.isArray(integritySnapshot.records) ||
      integritySnapshot.records.length !== integrityRecords.length ||
      integrityRecords.some((expected, index) => {
        const record = integritySnapshot.records[index];
        return (
          record?.sequence !== index + 1 ||
          record?.scope !== expected.scope ||
          record?.sourceId !== expected.sourceId ||
          record?.digest !== expected.digest ||
          record?.status !== "matched"
        );
      }) ||
      integritySnapshot.externalConnections !== false)
  ) {
    issues.push("validation_integrity_snapshot_invalid");
  }

  const rightsReadinessGate = validationSafety.rightsReadinessGate;
  if (rightsReadinessGate && !integritySnapshot) {
    issues.push("validation_rights_gate_before_integrity");
  }
  if (
    rightsReadinessGate &&
    (rightsReadinessGate.kind !== "rights_readiness_gate" ||
      rightsReadinessGate.status !== "blocked_pending_real_assets_and_rights" ||
      rightsReadinessGate.integritySnapshotId !== integritySnapshot?.id ||
      rightsReadinessGate.rightsInventoryId !== rightsInventory?.id ||
      rightsReadinessGate.realAssetExecutionAllowed !== false ||
      rightsReadinessGate.readyEntries !== 0 ||
      rightsReadinessGate.blockedEntries !== rightsInventory?.entries?.length ||
      !Array.isArray(rightsReadinessGate.decisions) ||
      rightsReadinessGate.decisions.length !== rightsInventory?.entries?.length ||
      rightsInventory?.entries?.some((entry, index) => {
        const decision = rightsReadinessGate.decisions[index];
        return (
          decision?.sequence !== index + 1 ||
          decision?.rightsInventoryEntryId !== entry.id ||
          decision?.assetType !== entry.assetType ||
          decision?.status !== "blocked" ||
          !arraysEqual(decision?.missingEvidence, [
            "asset_id",
            "origin_record",
            "rights_evidence"
          ]) ||
          decision?.useAllowed !== false
        );
      }) ||
      rightsReadinessGate.safety?.bypassAllowed !== false ||
      rightsReadinessGate.safety?.retrievesEvidence !== false ||
      rightsReadinessGate.externalConnections !== false)
  ) {
    issues.push("validation_rights_readiness_gate_invalid");
  }

  const enforcementPolicy = validationSafety.enforcementPolicy;
  if (enforcementPolicy && !rightsReadinessGate) {
    issues.push("validation_policy_before_rights_gate");
  }
  if (
    enforcementPolicy &&
    (enforcementPolicy.kind !== "validation_safety_enforcement_policy" ||
      enforcementPolicy.status !== "active_local_policy" ||
      enforcementPolicy.rightsReadinessGateId !== rightsReadinessGate?.id ||
      enforcementPolicy.mode !== "deny_by_default" ||
      enforcementPolicy.automaticBypassAllowed !== false ||
      !Array.isArray(enforcementPolicy.rules) ||
      enforcementPolicy.rules.length !== ENFORCEMENT_RULE_IDS.length ||
      ENFORCEMENT_RULE_IDS.some((ruleId, index) => {
        const rule = enforcementPolicy.rules[index];
        return (
          rule?.sequence !== index + 1 ||
          rule?.id !== ruleId ||
          rule?.effect !== "block" ||
          rule?.status !== "active"
        );
      }) ||
      enforcementPolicy.safety?.publishesContent !== false ||
      enforcementPolicy.safety?.connectsAccount !== false ||
      enforcementPolicy.safety?.requestsCredentials !== false ||
      enforcementPolicy.safety?.createsCharge !== false ||
      enforcementPolicy.safety?.rendersMedia !== false ||
      enforcementPolicy.externalConnections !== false)
  ) {
    issues.push("validation_enforcement_policy_invalid");
  }

  const completeValidation = validationSafety.completeValidation;
  if (completeValidation && !enforcementPolicy) {
    issues.push("validation_complete_before_policy");
  }
  if (
    completeValidation &&
    (completeValidation.kind !== "complete_validation_safety_validation" ||
      completeValidation.status !== "valid_with_safe_blockers" ||
      completeValidation.integritySnapshotId !== integritySnapshot?.id ||
      completeValidation.rightsReadinessGateId !== rightsReadinessGate?.id ||
      completeValidation.enforcementPolicyId !== enforcementPolicy?.id ||
      Object.values(completeValidation.checks ?? {}).some(
        (value) => value !== true
      ) ||
      !arraysEqual(completeValidation.safeBlockers, FINAL_SAFE_BLOCKERS) ||
      completeValidation.openIssues?.length !== 0 ||
      completeValidation.realAssetExecutionAllowed !== false ||
      completeValidation.externalConnections !== false)
  ) {
    issues.push("validation_complete_validation_invalid");
  }

  const closure = validationSafety.closure;
  if (closure && !completeValidation) {
    issues.push("validation_closure_before_complete_validation");
  }
  if (
    closure &&
    (closure.kind !== "validation_safety_closure" ||
      closure.status !== "closed" ||
      closure.completeValidationId !== completeValidation?.id ||
      closure.integratedReportId !== report?.id ||
      closure.readyForAuditCheckpoints !== true ||
      closure.nextStage !== "audit-checkpoints" ||
      closure.realAssetExecutionAllowed !== false ||
      closure.renderExecuted !== false ||
      closure.published !== false ||
      closure.externalConnections !== false)
  ) {
    issues.push("validation_safety_closure_invalid");
  }

  const continuation = expectedContinuation(validationSafety);
  if (
    Object.entries(continuation).some(
      ([key, value]) => validationSafety.continuation?.[key] !== value
    )
  ) {
    issues.push("validation_safety_continuation_invalid");
  }

  const expectedStatus = closure
    ? "ready_for_audit_checkpoints"
    : completeValidation
      ? "complete_validation_valid"
      : enforcementPolicy
        ? "enforcement_policy_active"
        : rightsReadinessGate
          ? "rights_readiness_blocked"
          : integritySnapshot
            ? "integrity_snapshot_sealed"
            : report
              ? "integrated_report_validated"
              : operationalLocks
                ? "operational_locks_validated"
                : contentSafety
                  ? "content_safety_validated"
                  : rightsInventory
                    ? "rights_inventory_blocked"
                    : "quality_criteria_materialized";
  if (validationSafety.status !== expectedStatus) {
    issues.push("validation_safety_status_invalid");
  }

  return [...new Set(issues)];
}

export function inspectValidationSafety(mission) {
  const issues = collectValidationSafetyIssues(mission);
  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues)
  });
}

function requireValidationSafety(mission) {
  if (!mission?.validationSafety) {
    throw new ValidationSafetyError(
      "Materialize a matriz de qualidade antes de continuar validation-safety."
    );
  }
  const inspection = inspectValidationSafety(mission);
  if (!inspection.valid) {
    throw new ValidationSafetyError(
      `O estado de validation-safety é inválido: ${inspection.issues.join(", ")}.`
    );
  }
  return mission.validationSafety;
}

function updateValidationSafety(validationSafety, changes, status, now) {
  const candidate = {
    ...validationSafety,
    ...changes,
    status,
    updatedAt: now.toISOString()
  };
  return Object.freeze({
    ...candidate,
    continuation: Object.freeze(expectedContinuation(candidate))
  });
}

function assertCandidate(mission, validationSafety) {
  const inspection = inspectValidationSafety({ ...mission, validationSafety });
  if (!inspection.valid) {
    throw new ValidationSafetyError(
      `A evolução de validation-safety é inválida: ${inspection.issues.join(", ")}.`
    );
  }
  return validationSafety;
}

export function materializeQualityCriteriaMatrix({
  mission,
  id = randomUUID(),
  matrixId = randomUUID(),
  now = new Date()
}) {
  assertClosedSourcePackages(mission);
  if (mission.validationSafety) {
    throw new ValidationSafetyError(
      "A missão já possui um estado de validation-safety preservado."
    );
  }
  const timestamp = now.toISOString();
  const source = expectedSource(mission);
  const sourceIds = [
    source.projectId,
    source.missionId,
    source.strategyPackageId,
    source.textPackageId,
    source.scenePackageId
  ];
  const qualityCriteriaMatrix = Object.freeze({
    schemaVersion: 1,
    id: matrixId,
    kind: "local_quality_criteria_matrix",
    status: "materialized",
    createdAt: timestamp,
    validationSafetyId: id,
    criteria: Object.freeze(
      QUALITY_SCOPES.map((scope, index) =>
        Object.freeze({
          id: `${matrixId}-${scope}`,
          sequence: index + 1,
          scope,
          sourceId: sourceIds[index],
          checks: Object.freeze({
            identityPreserved: true,
            sourceLinked: true,
            localExecutionOnly: true,
            validatedAssetsUnchanged: true
          })
        })
      )
    ),
    mutationPolicy: Object.freeze({
      modifiesValidatedAssets: false,
      preservesSourceVersions: true
    }),
    externalConnections: false
  });
  const validationSafety = Object.freeze({
    schemaVersion: 1,
    id,
    missionId: mission.id,
    mode: "local_validation_only",
    classification: "implementation_new_reconstruction",
    externalConnections: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "quality_criteria_materialized",
    source: Object.freeze(source),
    qualityCriteriaMatrix,
    continuation: Object.freeze({
      status: "open",
      lastCompletedPoint: 71,
      nextPoint: 72,
      nextStage: "validation-safety",
      externalConnections: false
    })
  });
  return assertCandidate(mission, validationSafety);
}

export function createRightsInventoryLock({
  mission,
  inventoryId = randomUUID(),
  now = new Date()
}) {
  const validationSafety = requireValidationSafety(mission);
  if (validationSafety.status !== "quality_criteria_materialized") {
    throw new ValidationSafetyError(
      "Crie o inventário de direitos somente depois da matriz de qualidade."
    );
  }
  const rightsSources = expectedRightsSources(mission);
  const rightsInventory = Object.freeze({
    schemaVersion: 1,
    id: inventoryId,
    kind: "local_rights_inventory",
    status: "blocked_pending_rights",
    createdAt: now.toISOString(),
    qualityCriteriaMatrixId: validationSafety.qualityCriteriaMatrix.id,
    realAssetsRegistered: 0,
    allFutureAssetsBlocked: true,
    entries: Object.freeze(
      rightsSources.map((source, index) =>
        Object.freeze({
          id: `${inventoryId}-entry-${index + 1}`,
          sequence: index + 1,
          ...source,
          assetId: null,
          originRecord: null,
          rightsEvidence: null,
          rightsStatus: "required_before_use",
          useAllowed: false
        })
      )
    ),
    locks: Object.freeze({
      useWithoutOrigin: true,
      useWithoutRightsEvidence: true,
      unknownRights: true
    }),
    safety: Object.freeze({
      retrievesMedia: false,
      generatesMedia: false,
      downloadsMedia: false
    }),
    externalConnections: false
  });
  const updated = updateValidationSafety(
    validationSafety,
    { rightsInventory },
    "rights_inventory_blocked",
    now
  );
  return assertCandidate(mission, updated);
}

export function validateContentSafetyAndOrigins({
  mission,
  validationId = randomUUID(),
  now = new Date()
}) {
  const validationSafety = requireValidationSafety(mission);
  if (validationSafety.status !== "rights_inventory_blocked") {
    throw new ValidationSafetyError(
      "Valide o conteúdo somente depois do inventário de direitos."
    );
  }
  const checks = buildContentSafetyChecks(mission);
  const failedChecks = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  if (failedChecks.length > 0) {
    throw new ValidationSafetyError(
      `O conteúdo, sua origem ou sua preservação não passaram na validação local: ${failedChecks.join(", ")}.`
    );
  }
  const origins = mission.textPackage.safetyOriginRegistry;
  const contentSafetyValidation = Object.freeze({
    schemaVersion: 1,
    id: validationId,
    kind: "content_safety_validation",
    status: "valid",
    validatedAt: now.toISOString(),
    rightsInventoryId: validationSafety.rightsInventory.id,
    requiredStageOrder: Object.freeze([...STAGE_IDS]),
    records: Object.freeze(
      textFragments(mission).map((fragment, index) =>
        Object.freeze({
          sequence: index + 1,
          role: fragment.role,
          assetId: fragment.asset.id,
          contentHash: contentDigest(fragment.asset.text),
          originRegistryId: origins.id,
          originRecordOrder: origins.records[index].order,
          preservedText: true
        })
      )
    ),
    checks: Object.freeze(checks),
    openIssues: Object.freeze([]),
    externalConnections: false
  });
  const updated = updateValidationSafety(
    validationSafety,
    { contentSafetyValidation },
    "content_safety_validated",
    now
  );
  return assertCandidate(mission, updated);
}

export function validateOperationalLocks({
  mission,
  locksId = randomUUID(),
  now = new Date()
}) {
  const validationSafety = requireValidationSafety(mission);
  if (validationSafety.status !== "content_safety_validated") {
    throw new ValidationSafetyError(
      "Valide os bloqueios somente depois da segurança do conteúdo."
    );
  }
  const checks = buildOperationalChecks(mission, validationSafety);
  if (Object.values(checks).some((value) => value !== true)) {
    throw new ValidationSafetyError(
      "Os bloqueios operacionais obrigatórios não estão íntegros."
    );
  }
  const operationalLocks = Object.freeze({
    schemaVersion: 1,
    id: locksId,
    kind: "local_operational_locks",
    status: "validated_blocked",
    validatedAt: now.toISOString(),
    contentSafetyValidationId: validationSafety.contentSafetyValidation.id,
    locks: Object.freeze(
      OPERATION_LOCK_IDS.map((id, index) =>
        Object.freeze({ id, sequence: index + 1, status: "blocked" })
      )
    ),
    renderBlockers: Object.freeze([...mission.scenePackage.renderPlan.blockers]),
    renderAllowed: false,
    runtime: Object.freeze({
      localOnly: true,
      defaultAddress: "127.0.0.1"
    }),
    monetization: Object.freeze({
      webRadioLouvar: "permanently_disabled"
    }),
    checks: Object.freeze(checks),
    externalConnections: false
  });
  const updated = updateValidationSafety(
    validationSafety,
    { operationalLocks },
    "operational_locks_validated",
    now
  );
  return assertCandidate(mission, updated);
}

export function consolidateIntegratedValidationSafetyReport({
  mission,
  reportId = randomUUID(),
  now = new Date()
}) {
  const validationSafety = requireValidationSafety(mission);
  if (validationSafety.status !== "operational_locks_validated") {
    throw new ValidationSafetyError(
      "Consolide o relatório somente depois dos bloqueios operacionais."
    );
  }
  const integratedReport = Object.freeze({
    schemaVersion: 1,
    id: reportId,
    kind: "integrated_quality_rights_safety_report",
    status: "valid",
    createdAt: now.toISOString(),
    qualityCriteriaMatrixId: validationSafety.qualityCriteriaMatrix.id,
    rightsInventoryId: validationSafety.rightsInventory.id,
    contentSafetyValidationId: validationSafety.contentSafetyValidation.id,
    operationalLocksId: validationSafety.operationalLocks.id,
    summary: Object.freeze({
      quality: "valid",
      rights: "blocked_pending_rights",
      contentSafety: "valid",
      operations: "blocked",
      realAssetExecutionAllowed: false
    }),
    checks: Object.freeze({
      sourceIdentityPreserved: true,
      validatedAssetsPreserved: true,
      qualityCriteriaValid: true,
      rightsLocksActive: true,
      contentSafetyValid: true,
      operationalLocksActive: true,
      persistenceRequired: true
    }),
    openIssues: Object.freeze([]),
    stageStatus: "open",
    readyForNextValidationSafety: true,
    nextStage: "validation-safety",
    externalConnections: false
  });
  const updated = updateValidationSafety(
    validationSafety,
    { integratedReport },
    "integrated_report_validated",
    now
  );
  return assertCandidate(mission, updated);
}

export function sealValidationSafetyIntegritySnapshot({
  mission,
  snapshotId = randomUUID(),
  now = new Date()
}) {
  const validationSafety = requireValidationSafety(mission);
  if (validationSafety.status !== "integrated_report_validated") {
    throw new ValidationSafetyError(
      "Sele a integridade somente depois do relatório integrado validado."
    );
  }
  const integritySnapshot = Object.freeze({
    schemaVersion: 1,
    id: snapshotId,
    kind: "validation_safety_integrity_snapshot",
    status: "sealed",
    sealedAt: now.toISOString(),
    integratedReportId: validationSafety.integratedReport.id,
    algorithm: "sha256",
    records: Object.freeze(
      expectedIntegrityRecords(mission, validationSafety).map((record, index) =>
        Object.freeze({
          sequence: index + 1,
          ...record,
          status: "matched"
        })
      )
    ),
    mutationDetected: false,
    externalConnections: false
  });
  const updated = updateValidationSafety(
    validationSafety,
    { integritySnapshot },
    "integrity_snapshot_sealed",
    now
  );
  return assertCandidate(mission, updated);
}

export function evaluateRightsReadinessGate({
  mission,
  gateId = randomUUID(),
  now = new Date()
}) {
  const validationSafety = requireValidationSafety(mission);
  if (validationSafety.status !== "integrity_snapshot_sealed") {
    throw new ValidationSafetyError(
      "Avalie a liberação de direitos somente depois do selo de integridade."
    );
  }
  const entries = validationSafety.rightsInventory.entries;
  const decisions = entries.map((entry, index) =>
    Object.freeze({
      sequence: index + 1,
      rightsInventoryEntryId: entry.id,
      assetType: entry.assetType,
      status: "blocked",
      missingEvidence: Object.freeze([
        "asset_id",
        "origin_record",
        "rights_evidence"
      ]),
      useAllowed: false
    })
  );
  const rightsReadinessGate = Object.freeze({
    schemaVersion: 1,
    id: gateId,
    kind: "rights_readiness_gate",
    status: "blocked_pending_real_assets_and_rights",
    evaluatedAt: now.toISOString(),
    integritySnapshotId: validationSafety.integritySnapshot.id,
    rightsInventoryId: validationSafety.rightsInventory.id,
    decisions: Object.freeze(decisions),
    readyEntries: 0,
    blockedEntries: decisions.length,
    realAssetExecutionAllowed: false,
    safety: Object.freeze({
      bypassAllowed: false,
      retrievesEvidence: false
    }),
    externalConnections: false
  });
  const updated = updateValidationSafety(
    validationSafety,
    { rightsReadinessGate },
    "rights_readiness_blocked",
    now
  );
  return assertCandidate(mission, updated);
}

export function materializeValidationSafetyEnforcementPolicy({
  mission,
  policyId = randomUUID(),
  now = new Date()
}) {
  const validationSafety = requireValidationSafety(mission);
  if (validationSafety.status !== "rights_readiness_blocked") {
    throw new ValidationSafetyError(
      "Ative a política somente depois da avaliação de direitos."
    );
  }
  const enforcementPolicy = Object.freeze({
    schemaVersion: 1,
    id: policyId,
    kind: "validation_safety_enforcement_policy",
    status: "active_local_policy",
    createdAt: now.toISOString(),
    rightsReadinessGateId: validationSafety.rightsReadinessGate.id,
    mode: "deny_by_default",
    automaticBypassAllowed: false,
    rules: Object.freeze(
      ENFORCEMENT_RULE_IDS.map((id, index) =>
        Object.freeze({
          sequence: index + 1,
          id,
          effect: "block",
          status: "active"
        })
      )
    ),
    safety: Object.freeze({
      publishesContent: false,
      connectsAccount: false,
      requestsCredentials: false,
      createsCharge: false,
      rendersMedia: false
    }),
    externalConnections: false
  });
  const updated = updateValidationSafety(
    validationSafety,
    { enforcementPolicy },
    "enforcement_policy_active",
    now
  );
  return assertCandidate(mission, updated);
}

export function validateCompleteValidationSafety({
  mission,
  validationId = randomUUID(),
  now = new Date()
}) {
  const validationSafety = requireValidationSafety(mission);
  if (validationSafety.status !== "enforcement_policy_active") {
    throw new ValidationSafetyError(
      "Valide o estágio somente depois da política local de bloqueio."
    );
  }
  const completeValidation = Object.freeze({
    schemaVersion: 1,
    id: validationId,
    kind: "complete_validation_safety_validation",
    status: "valid_with_safe_blockers",
    validatedAt: now.toISOString(),
    integritySnapshotId: validationSafety.integritySnapshot.id,
    rightsReadinessGateId: validationSafety.rightsReadinessGate.id,
    enforcementPolicyId: validationSafety.enforcementPolicy.id,
    checks: Object.freeze({
      integritySnapshotValid: true,
      rightsGateBlockedSafely: true,
      contentSafetyValid: true,
      operationalLocksActive: true,
      denyByDefaultPolicyActive: true,
      externalConnectionsDisabled: true,
      realAssetExecutionBlocked: true,
      publicationBlocked: true
    }),
    safeBlockers: Object.freeze([...FINAL_SAFE_BLOCKERS]),
    openIssues: Object.freeze([]),
    realAssetExecutionAllowed: false,
    externalConnections: false
  });
  const updated = updateValidationSafety(
    validationSafety,
    { completeValidation },
    "complete_validation_valid",
    now
  );
  return assertCandidate(mission, updated);
}

export function closeValidationSafetyForAudit({
  mission,
  closureId = randomUUID(),
  now = new Date()
}) {
  const validationSafety = requireValidationSafety(mission);
  if (validationSafety.status !== "complete_validation_valid") {
    throw new ValidationSafetyError(
      "Feche validation-safety somente depois da validação completa."
    );
  }
  const closure = Object.freeze({
    schemaVersion: 1,
    id: closureId,
    kind: "validation_safety_closure",
    status: "closed",
    closedAt: now.toISOString(),
    completeValidationId: validationSafety.completeValidation.id,
    integratedReportId: validationSafety.integratedReport.id,
    readyForAuditCheckpoints: true,
    nextStage: "audit-checkpoints",
    realAssetExecutionAllowed: false,
    renderExecuted: false,
    published: false,
    externalConnections: false
  });
  const updated = updateValidationSafety(
    validationSafety,
    { closure },
    "ready_for_audit_checkpoints",
    now
  );
  return assertCandidate(mission, updated);
}
