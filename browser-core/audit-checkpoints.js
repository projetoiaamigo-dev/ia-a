import { createHash, randomUUID } from "./crypto-browser.js";
import { inspectValidationSafety } from "./validation-safety.js";

const CHECKPOINT_REQUIREMENT_IDS = Object.freeze([
  "sha256_digest",
  "checksum_manifest",
  "safe_archive_paths",
  "independent_restore",
  "directed_validation"
]);

const EXPORT_SECTION_IDS = Object.freeze([
  "mission_identity",
  "package_references",
  "audit_ledger",
  "checkpoint_policy",
  "validation_summary"
]);

const BLOCKED_EXPORT_CONTENT = Object.freeze([
  "credentials",
  "secrets",
  "real_media_files",
  "media_without_confirmed_rights",
  "external_connection_configuration"
]);

export class AuditCheckpointsError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuditCheckpointsError";
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

function contentDigest(value) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value), "utf8")
    .digest("hex");
}

function recordsEqual(left, right, keys) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    right.every((expected, index) =>
      keys.every((key) => left[index]?.[key] === expected[key])
    )
  );
}

function assertReadySource(mission) {
  const validation = inspectValidationSafety(mission);
  const validationSafety = mission?.validationSafety;
  if (
    !validation.valid ||
    validationSafety?.status !== "ready_for_audit_checkpoints" ||
    validationSafety.closure?.status !== "closed" ||
    validationSafety.closure?.readyForAuditCheckpoints !== true ||
    validationSafety.closure?.nextStage !== "audit-checkpoints" ||
    validationSafety.continuation?.lastCompletedPoint !== 80 ||
    validationSafety.continuation?.nextPoint !== 81 ||
    mission.strategyPackage?.status !== "strategic_package_closed" ||
    mission.textPackage?.closure?.status !== "closed" ||
    mission.scenePackage?.closure?.status !== "closed"
  ) {
    throw new AuditCheckpointsError(
      "validation-safety precisa estar fechado, íntegro e pronto para audit-checkpoints."
    );
  }
  return validationSafety;
}

function expectedSource(mission) {
  return {
    projectId: mission.project?.id ?? null,
    projectName: mission.project?.name ?? null,
    missionId: mission.id,
    missionTitle: mission.title,
    channelId: mission.channel.id,
    channelName: mission.channel.name,
    brainId: mission.brain.id,
    brainProfileVersion: mission.brain.profileVersion,
    strategyPackageId: mission.strategyPackage.id,
    strategyPackageSchemaVersion: mission.strategyPackage.schemaVersion,
    textPackageId: mission.textPackage.id,
    textPackageSchemaVersion: mission.textPackage.schemaVersion,
    textPackageClosureId: mission.textPackage.closure.id,
    scenePackageId: mission.scenePackage.id,
    scenePackageSchemaVersion: mission.scenePackage.schemaVersion,
    scenePackageClosureId: mission.scenePackage.closure.id,
    validationSafetyId: mission.validationSafety.id,
    validationSafetySchemaVersion: mission.validationSafety.schemaVersion,
    validationSafetyClosureId: mission.validationSafety.closure.id,
    theme: mission.textPackage.sourceContext.theme,
    themeClassification: mission.textPackage.sourceContext.themeClassification
  };
}

function sourceMatches(mission, source) {
  return Object.entries(expectedSource(mission)).every(
    ([key, value]) => source?.[key] === value
  );
}

function expectedLedgerEntries(mission, sourceHistoryLength) {
  return mission.history.slice(0, sourceHistoryLength).map((record, index) => ({
    sequence: index + 1,
    sourceIndex: index,
    eventType: record.type,
    occurredAt: record.at,
    digest: contentDigest(record),
    status: "preserved"
  }));
}

function expectedClosureBindings(mission) {
  const sources = [
    {
      scope: "strategy_package",
      packageId: mission.strategyPackage.id,
      closureId: mission.strategyPackage.id,
      schemaVersion: mission.strategyPackage.schemaVersion,
      status: mission.strategyPackage.status,
      value: mission.strategyPackage
    },
    {
      scope: "text_package",
      packageId: mission.textPackage.id,
      closureId: mission.textPackage.closure.id,
      schemaVersion: mission.textPackage.schemaVersion,
      status: mission.textPackage.closure.status,
      value: mission.textPackage
    },
    {
      scope: "scene_package",
      packageId: mission.scenePackage.id,
      closureId: mission.scenePackage.closure.id,
      schemaVersion: mission.scenePackage.schemaVersion,
      status: mission.scenePackage.closure.status,
      value: mission.scenePackage
    },
    {
      scope: "validation_safety",
      packageId: mission.validationSafety.id,
      closureId: mission.validationSafety.closure.id,
      schemaVersion: mission.validationSafety.schemaVersion,
      status: mission.validationSafety.closure.status,
      value: mission.validationSafety
    }
  ];
  return sources.map(({ value, ...source }, index) => ({
    sequence: index + 1,
    ...source,
    digest: contentDigest(value),
    statusVerified: true
  }));
}

function expectedExportEntries(mission, auditCheckpoints) {
  const sourceIds = [
    mission.id,
    mission.strategyPackage.id,
    auditCheckpoints.auditLedger.id,
    auditCheckpoints.checkpointPolicy.id,
    mission.validationSafety.closure.id
  ];
  return EXPORT_SECTION_IDS.map((section, index) => ({
    sequence: index + 1,
    section,
    sourceId: sourceIds[index],
    structuralOnly: true,
    binaryContentIncluded: false
  }));
}

function expectedStructuralExportRecords(mission, auditCheckpoints) {
  return [
    {
      sequence: 1,
      section: "mission_identity",
      sourceId: mission.id,
      payload: {
        missionId: mission.id,
        projectId: mission.project?.id ?? null,
        channelId: mission.channel.id,
        brainId: mission.brain.id,
        brainProfileVersion: mission.brain.profileVersion
      }
    },
    {
      sequence: 2,
      section: "package_references",
      sourceId: mission.strategyPackage.id,
      payload: {
        strategyPackageId: mission.strategyPackage.id,
        textPackageId: mission.textPackage.id,
        scenePackageId: mission.scenePackage.id,
        validationSafetyId: mission.validationSafety.id
      }
    },
    {
      sequence: 3,
      section: "audit_ledger",
      sourceId: auditCheckpoints.auditLedger.id,
      payload: {
        ledgerId: auditCheckpoints.auditLedger.id,
        ledgerDigest: auditCheckpoints.auditLedger.ledgerDigest,
        historyEntries: auditCheckpoints.auditLedger.entries.length,
        closureBindings: auditCheckpoints.auditLedger.closureBindings.length
      }
    },
    {
      sequence: 4,
      section: "checkpoint_policy",
      sourceId: auditCheckpoints.checkpointPolicy.id,
      payload: {
        policyId: auditCheckpoints.checkpointPolicy.id,
        hashAlgorithm: auditCheckpoints.checkpointPolicy.hashAlgorithm,
        requirementIds: auditCheckpoints.checkpointPolicy.requirements.map(
          (requirement) => requirement.id
        )
      }
    },
    {
      sequence: 5,
      section: "validation_summary",
      sourceId: auditCheckpoints.trailValidation.id,
      payload: {
        trailValidationId: auditCheckpoints.trailValidation.id,
        trailStatus: auditCheckpoints.trailValidation.status,
        gaps: auditCheckpoints.trailValidation.gaps.length,
        readinessReportId: auditCheckpoints.readinessReport.id,
        checkpointReady:
          auditCheckpoints.readinessReport.summary.checkpointReady
      }
    }
  ];
}

function expectedExportIntegrityRecords(auditCheckpoints) {
  const sources = [
    {
      scope: "structural_export_bundle",
      sourceId: auditCheckpoints.structuralExportBundle.id,
      value: auditCheckpoints.structuralExportBundle.records
    },
    {
      scope: "safe_export_manifest",
      sourceId: auditCheckpoints.exportManifest.id,
      value: auditCheckpoints.exportManifest
    },
    {
      scope: "audit_ledger",
      sourceId: auditCheckpoints.auditLedger.id,
      value: auditCheckpoints.auditLedger
    },
    {
      scope: "checkpoint_policy",
      sourceId: auditCheckpoints.checkpointPolicy.id,
      value: auditCheckpoints.checkpointPolicy
    },
    {
      scope: "readiness_report",
      sourceId: auditCheckpoints.readinessReport.id,
      value: auditCheckpoints.readinessReport
    }
  ];
  return sources.map(({ value, ...source }, index) => ({
    sequence: index + 1,
    ...source,
    digest: contentDigest(value),
    status: "matched"
  }));
}

function expectedContinuation(auditCheckpoints) {
  const completedPoint = auditCheckpoints.closure
    ? 90
    : auditCheckpoints.completeValidation
      ? 89
      : auditCheckpoints.restoreVerification
        ? 88
        : auditCheckpoints.exportIntegritySeal
          ? 87
          : auditCheckpoints.structuralExportBundle
            ? 86
            : auditCheckpoints.readinessReport
              ? 85
              : auditCheckpoints.trailValidation
                ? 84
                : auditCheckpoints.exportManifest
                  ? 83
                  : auditCheckpoints.checkpointPolicy
                    ? 82
                    : 81;
  return {
    status: auditCheckpoints.closure ? "closed" : "open",
    lastCompletedPoint: completedPoint,
    nextPoint: completedPoint + 1,
    nextStage: auditCheckpoints.closure
      ? "android-experience"
      : "audit-checkpoints",
    externalConnections: false
  };
}

function historyChronologyValid(entries) {
  let previous = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    const timestamp = Date.parse(entry.occurredAt);
    if (!Number.isFinite(timestamp) || timestamp < previous) return false;
    previous = timestamp;
  }
  return true;
}

function expectedTrailChecks(mission, auditCheckpoints) {
  const ledger = auditCheckpoints.auditLedger;
  const entries = expectedLedgerEntries(mission, ledger.sourceHistoryLength);
  const closures = expectedClosureBindings(mission);
  const policy = auditCheckpoints.checkpointPolicy;
  const manifest = auditCheckpoints.exportManifest;
  const exportEntries = expectedExportEntries(mission, auditCheckpoints);
  return {
    sourceIdentityPreserved: sourceMatches(mission, auditCheckpoints.source),
    historySequenceContinuous: ledger.entries.every(
      (entry, index) => entry.sequence === index + 1 && entry.sourceIndex === index
    ),
    historyDigestsMatched: recordsEqual(ledger.entries, entries, [
      "sequence",
      "sourceIndex",
      "eventType",
      "occurredAt",
      "digest",
      "status"
    ]),
    historyChronologyValid: historyChronologyValid(ledger.entries),
    closureBindingsComplete: recordsEqual(ledger.closureBindings, closures, [
      "sequence",
      "scope",
      "packageId",
      "closureId",
      "schemaVersion",
      "status",
      "digest",
      "statusVerified"
    ]),
    closureDigestsMatched: closures.every(
      (expected, index) => ledger.closureBindings[index]?.digest === expected.digest
    ),
    packageLinksPreserved:
      mission.validationSafety.source?.strategyPackageId === mission.strategyPackage.id &&
      mission.validationSafety.source?.textPackageId === mission.textPackage.id &&
      mission.validationSafety.source?.scenePackageId === mission.scenePackage.id,
    versionsPreserved:
      auditCheckpoints.source.brainProfileVersion === mission.brain.profileVersion &&
      closures.every(
        (expected, index) =>
          ledger.closureBindings[index]?.schemaVersion === expected.schemaVersion
      ),
    checkpointPolicyComplete:
      policy.requirements.length === CHECKPOINT_REQUIREMENT_IDS.length &&
      policy.requirements.every(
        (requirement, index) =>
          requirement.id === CHECKPOINT_REQUIREMENT_IDS[index] &&
          requirement.required === true &&
          requirement.status === "enforced"
      ),
    safeExportManifestValid:
      recordsEqual(manifest.entries, exportEntries, [
        "sequence",
        "section",
        "sourceId",
        "structuralOnly",
        "binaryContentIncluded"
      ]) &&
      Object.values(manifest.safety).every((value) => value === false),
    noAuditGaps:
      ledger.entries.length === ledger.sourceHistoryLength &&
      ledger.closureBindings.length === 4,
    validationSafetyClosed:
      mission.validationSafety.closure.status === "closed" &&
      mission.validationSafety.closure.readyForAuditCheckpoints === true
  };
}

function expectedFinalAuditChecks(mission, auditCheckpoints) {
  const expectedRecords = expectedStructuralExportRecords(
    mission,
    auditCheckpoints
  );
  const bundle = auditCheckpoints.structuralExportBundle;
  const seal = auditCheckpoints.exportIntegritySeal;
  const restore = auditCheckpoints.restoreVerification;
  return {
    auditLedgerValid:
      auditCheckpoints.auditLedger.status === "sealed_immutable" &&
      auditCheckpoints.auditLedger.immutable === true,
    checkpointPolicyActive:
      auditCheckpoints.checkpointPolicy.status === "active",
    safeExportManifestValid:
      auditCheckpoints.exportManifest.status ===
      "materialized_blocked_content_excluded",
    auditTrailValid:
      auditCheckpoints.trailValidation.status === "valid" &&
      auditCheckpoints.trailValidation.gaps.length === 0,
    readinessReportReady:
      auditCheckpoints.readinessReport.status ===
      "ready_for_local_checkpoint",
    structuralExportBundleSafe:
      bundle.status === "materialized_local" &&
      contentDigest(bundle.records) === contentDigest(expectedRecords) &&
      bundle.realMediaIncluded === false &&
      bundle.credentialsIncluded === false &&
      bundle.secretsIncluded === false,
    exportIntegritySealed:
      seal.status === "sealed" &&
      seal.mutationDetected === false &&
      seal.records.every((record) => record.status === "matched"),
    independentRestoreVerified:
      restore.status === "verified" &&
      restore.mode === "isolated_memory_roundtrip" &&
      Object.values(restore.checks).every(Boolean),
    sourcePackagesPreserved:
      sourceMatches(mission, auditCheckpoints.source),
    restrictedContentExcluded:
      bundle.realMediaIncluded === false &&
      bundle.credentialsIncluded === false &&
      bundle.secretsIncluded === false &&
      bundle.externalConnectionConfigurationIncluded === false,
    externalConnectionsDisabled:
      auditCheckpoints.externalConnections === false &&
      bundle.externalConnections === false &&
      seal.externalConnections === false &&
      restore.externalConnections === false
  };
}

function collectAuditCheckpointsIssues(mission) {
  const auditCheckpoints = mission?.auditCheckpoints;
  if (!auditCheckpoints) return [];
  const issues = [];
  try {
    assertReadySource(mission);
  } catch {
    return ["audit_source_not_ready"];
  }

  if (
    auditCheckpoints.missionId !== mission.id ||
    auditCheckpoints.mode !== "local_audit_only" ||
    auditCheckpoints.classification !== "implementation_new_reconstruction" ||
    auditCheckpoints.externalConnections !== false ||
    !sourceMatches(mission, auditCheckpoints.source)
  ) {
    issues.push("audit_identity_invalid");
  }

  const ledger = auditCheckpoints.auditLedger;
  const ledgerEntries = Number.isInteger(ledger?.sourceHistoryLength)
    ? expectedLedgerEntries(mission, ledger.sourceHistoryLength)
    : [];
  const closureBindings = expectedClosureBindings(mission);
  const expectedLedgerDigest = contentDigest({
    entries: ledgerEntries,
    closureBindings
  });
  if (
    !ledger ||
    ledger.kind !== "local_immutable_audit_ledger" ||
    ledger.status !== "sealed_immutable" ||
    ledger.auditCheckpointsId !== auditCheckpoints.id ||
    ledger.algorithm !== "sha256" ||
    !Number.isInteger(ledger.sourceHistoryLength) ||
    ledger.sourceHistoryLength < 1 ||
    mission.history.length < ledger.sourceHistoryLength ||
    !recordsEqual(ledger.entries, ledgerEntries, [
      "sequence",
      "sourceIndex",
      "eventType",
      "occurredAt",
      "digest",
      "status"
    ]) ||
    !recordsEqual(ledger.closureBindings, closureBindings, [
      "sequence",
      "scope",
      "packageId",
      "closureId",
      "schemaVersion",
      "status",
      "digest",
      "statusVerified"
    ]) ||
    ledger.ledgerDigest !== expectedLedgerDigest ||
    ledger.immutable !== true ||
    ledger.sourceHistoryRewritesAllowed !== false ||
    ledger.externalConnections !== false
  ) {
    issues.push("audit_ledger_invalid");
  }

  const policy = auditCheckpoints.checkpointPolicy;
  if (policy && !ledger) issues.push("checkpoint_policy_before_ledger");
  if (
    policy &&
    (policy.kind !== "local_checkpoint_policy" ||
      policy.status !== "active" ||
      policy.auditLedgerId !== ledger?.id ||
      policy.archiveFormat !== "tar" ||
      policy.hashAlgorithm !== "sha256" ||
      !Array.isArray(policy.requirements) ||
      policy.requirements.length !== CHECKPOINT_REQUIREMENT_IDS.length ||
      CHECKPOINT_REQUIREMENT_IDS.some(
        (id, index) =>
          policy.requirements[index]?.sequence !== index + 1 ||
          policy.requirements[index]?.id !== id ||
          policy.requirements[index]?.required !== true ||
          policy.requirements[index]?.status !== "enforced"
      ) ||
      policy.pathSafety?.absolutePathsAllowed !== false ||
      policy.pathSafety?.parentTraversalAllowed !== false ||
      policy.pathSafety?.escapingLinksAllowed !== false ||
      policy.originalCheckpointImmutable !== true ||
      policy.independentRestoreRequired !== true ||
      policy.directedValidationRequired !== true ||
      policy.fullSuiteOnEntry !== false ||
      policy.externalConnections !== false)
  ) {
    issues.push("checkpoint_policy_invalid");
  }

  const manifest = auditCheckpoints.exportManifest;
  if (manifest && !policy) issues.push("export_manifest_before_policy");
  const exportEntries = policy
    ? expectedExportEntries(mission, auditCheckpoints)
    : [];
  if (
    manifest &&
    (manifest.kind !== "safe_structural_export_manifest" ||
      manifest.status !== "materialized_blocked_content_excluded" ||
      manifest.checkpointPolicyId !== policy?.id ||
      manifest.auditLedgerId !== ledger?.id ||
      manifest.scope !== "authorized_structure_only" ||
      !recordsEqual(manifest.entries, exportEntries, [
        "sequence",
        "section",
        "sourceId",
        "structuralOnly",
        "binaryContentIncluded"
      ]) ||
      !arraysEqual(manifest.blockedContent, BLOCKED_EXPORT_CONTENT) ||
      manifest.manifestDigest !== contentDigest(exportEntries) ||
      manifest.safety?.includesCredentials !== false ||
      manifest.safety?.includesSecrets !== false ||
      manifest.safety?.includesRealMedia !== false ||
      manifest.safety?.includesUnlicensedMedia !== false ||
      manifest.safety?.includesExternalConnectionConfig !== false ||
      manifest.safety?.publishesContent !== false ||
      manifest.externalConnections !== false)
  ) {
    issues.push("safe_export_manifest_invalid");
  }

  const validation = auditCheckpoints.trailValidation;
  if (validation && !manifest) issues.push("audit_validation_before_manifest");
  const expectedChecks = manifest
    ? expectedTrailChecks(mission, auditCheckpoints)
    : {};
  if (
    validation &&
    (validation.kind !== "complete_local_audit_trail_validation" ||
      validation.status !== "valid" ||
      validation.auditLedgerId !== ledger?.id ||
      validation.checkpointPolicyId !== policy?.id ||
      validation.exportManifestId !== manifest?.id ||
      Object.entries(expectedChecks).some(
        ([key, value]) => value !== true || validation.checks?.[key] !== true
      ) ||
      validation.gaps?.length !== 0 ||
      validation.openIssues?.length !== 0 ||
      validation.hashesValidated !== true ||
      validation.closuresValidated !== true ||
      validation.externalConnections !== false)
  ) {
    issues.push("audit_trail_validation_invalid");
  }

  const report = auditCheckpoints.readinessReport;
  if (report && !validation) issues.push("audit_report_before_validation");
  if (
    report &&
    (report.kind !== "audit_checkpoint_readiness_report" ||
      report.status !== "ready_for_local_checkpoint" ||
      report.auditLedgerId !== ledger?.id ||
      report.checkpointPolicyId !== policy?.id ||
      report.exportManifestId !== manifest?.id ||
      report.trailValidationId !== validation?.id ||
      report.summary?.ledger !== "valid_immutable" ||
      report.summary?.checkpointPolicy !== "active" ||
      report.summary?.structuralExport !== "safe" ||
      report.summary?.auditTrail !== "valid_without_gaps" ||
      report.summary?.checkpointReady !== true ||
      report.stageStatus !== "open" ||
      report.nextPoint !== 86 ||
      report.nextStage !== "audit-checkpoints" ||
      report.realMediaIncluded !== false ||
      report.credentialsIncluded !== false ||
      report.secretsIncluded !== false ||
      report.externalConnections !== false)
  ) {
    issues.push("audit_readiness_report_invalid");
  }

  const bundle = auditCheckpoints.structuralExportBundle;
  if (bundle && !report) issues.push("structural_export_before_report");
  const structuralRecords = report
    ? expectedStructuralExportRecords(mission, auditCheckpoints)
    : [];
  if (
    bundle &&
    (bundle.kind !== "authorized_structural_export_bundle" ||
      bundle.status !== "materialized_local" ||
      bundle.readinessReportId !== report?.id ||
      bundle.exportManifestId !== manifest?.id ||
      bundle.format !== "json" ||
      bundle.scope !== "authorized_structure_only" ||
      contentDigest(bundle.records) !== contentDigest(structuralRecords) ||
      bundle.bundleDigest !== contentDigest(structuralRecords) ||
      bundle.recordCount !== structuralRecords.length ||
      bundle.realMediaIncluded !== false ||
      bundle.credentialsIncluded !== false ||
      bundle.secretsIncluded !== false ||
      bundle.externalConnectionConfigurationIncluded !== false ||
      bundle.binaryContentIncluded !== false ||
      bundle.published !== false ||
      bundle.externalConnections !== false)
  ) {
    issues.push("structural_export_bundle_invalid");
  }

  const seal = auditCheckpoints.exportIntegritySeal;
  if (seal && !bundle) issues.push("export_integrity_before_bundle");
  const integrityRecords = bundle
    ? expectedExportIntegrityRecords(auditCheckpoints)
    : [];
  if (
    seal &&
    (seal.kind !== "structural_export_integrity_seal" ||
      seal.status !== "sealed" ||
      seal.structuralExportBundleId !== bundle?.id ||
      seal.algorithm !== "sha256" ||
      !recordsEqual(seal.records, integrityRecords, [
        "sequence",
        "scope",
        "sourceId",
        "digest",
        "status"
      ]) ||
      seal.sealDigest !== contentDigest(integrityRecords) ||
      seal.mutationDetected !== false ||
      seal.externalConnections !== false)
  ) {
    issues.push("structural_export_integrity_invalid");
  }

  const restore = auditCheckpoints.restoreVerification;
  if (restore && !seal) issues.push("restore_verification_before_seal");
  const restoredRecords = bundle
    ? JSON.parse(JSON.stringify(bundle.records))
    : [];
  const expectedRestoreChecks = bundle
    ? {
        serializedLocally: true,
        isolatedRoundTrip: true,
        recordCountMatched: restoredRecords.length === bundle.recordCount,
        digestMatched:
          contentDigest(restoredRecords) === bundle.bundleDigest,
        manifestLinkMatched:
          bundle.exportManifestId === auditCheckpoints.exportManifest.id,
        integritySealMatched:
          seal?.structuralExportBundleId === bundle.id &&
          seal?.mutationDetected === false,
        restrictedContentAbsent:
          bundle.realMediaIncluded === false &&
          bundle.credentialsIncluded === false &&
          bundle.secretsIncluded === false &&
          bundle.externalConnectionConfigurationIncluded === false,
        externalConnectionsDisabled: bundle.externalConnections === false
      }
    : {};
  if (
    restore &&
    (restore.kind !== "independent_structural_restore_verification" ||
      restore.status !== "verified" ||
      restore.mode !== "isolated_memory_roundtrip" ||
      restore.structuralExportBundleId !== bundle?.id ||
      restore.exportIntegritySealId !== seal?.id ||
      Object.entries(expectedRestoreChecks).some(
        ([key, value]) => value !== true || restore.checks?.[key] !== true
      ) ||
      restore.restoredRecordCount !== restoredRecords.length ||
      restore.restoredDigest !== contentDigest(restoredRecords) ||
      restore.outputFile !== null ||
      restore.openIssues?.length !== 0 ||
      restore.externalConnections !== false)
  ) {
    issues.push("independent_structural_restore_invalid");
  }

  const completeValidation = auditCheckpoints.completeValidation;
  if (completeValidation && !restore) {
    issues.push("complete_audit_validation_before_restore");
  }
  const expectedFinalChecks = restore
    ? expectedFinalAuditChecks(mission, auditCheckpoints)
    : {};
  if (
    completeValidation &&
    (completeValidation.kind !== "complete_audit_checkpoints_validation" ||
      completeValidation.status !== "valid" ||
      completeValidation.readinessReportId !== report?.id ||
      completeValidation.structuralExportBundleId !== bundle?.id ||
      completeValidation.exportIntegritySealId !== seal?.id ||
      completeValidation.restoreVerificationId !== restore?.id ||
      Object.entries(expectedFinalChecks).some(
        ([key, value]) =>
          value !== true || completeValidation.checks?.[key] !== true
      ) ||
      !arraysEqual(completeValidation.safeExclusions, [
        "real_media",
        "credentials",
        "secrets",
        "external_connection_configuration"
      ]) ||
      completeValidation.openIssues?.length !== 0 ||
      completeValidation.checkpointReady !== true ||
      completeValidation.realAssetExecutionAllowed !== false ||
      completeValidation.externalConnections !== false)
  ) {
    issues.push("complete_audit_checkpoints_validation_invalid");
  }

  const closure = auditCheckpoints.closure;
  if (closure && !completeValidation) {
    issues.push("audit_closure_before_complete_validation");
  }
  if (
    closure &&
    (closure.kind !== "audit_checkpoints_closure" ||
      closure.status !== "closed" ||
      closure.completeValidationId !== completeValidation?.id ||
      closure.readinessReportId !== report?.id ||
      closure.restoreVerificationId !== restore?.id ||
      closure.readyForAndroidExperience !== true ||
      closure.nextStage !== "android-experience" ||
      closure.structuralExportVerified !== true ||
      closure.realMediaIncluded !== false ||
      closure.credentialsIncluded !== false ||
      closure.published !== false ||
      closure.externalConnections !== false)
  ) {
    issues.push("audit_checkpoints_closure_invalid");
  }

  const continuation = expectedContinuation(auditCheckpoints);
  if (
    Object.entries(continuation).some(
      ([key, value]) => auditCheckpoints.continuation?.[key] !== value
    )
  ) {
    issues.push("audit_continuation_invalid");
  }

  const expectedStatus = closure
    ? "ready_for_android_experience"
    : completeValidation
      ? "complete_audit_validation_valid"
      : restore
        ? "structural_restore_verified"
        : seal
          ? "structural_export_integrity_sealed"
          : bundle
            ? "structural_export_materialized"
            : report
              ? "readiness_report_persisted"
              : validation
                ? "audit_trail_validated"
                : manifest
                  ? "safe_export_manifest_materialized"
                  : policy
                    ? "checkpoint_policy_active"
                    : "audit_ledger_materialized";
  if (auditCheckpoints.status !== expectedStatus) {
    issues.push("audit_status_invalid");
  }
  return [...new Set(issues)];
}

export function inspectAuditCheckpoints(mission) {
  const issues = collectAuditCheckpointsIssues(mission);
  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues)
  });
}

function requireAuditCheckpoints(mission) {
  if (!mission?.auditCheckpoints) {
    throw new AuditCheckpointsError(
      "Materialize o livro-razão antes de continuar audit-checkpoints."
    );
  }
  const inspection = inspectAuditCheckpoints(mission);
  if (!inspection.valid) {
    throw new AuditCheckpointsError(
      `O estado de audit-checkpoints é inválido: ${inspection.issues.join(", ")}.`
    );
  }
  return mission.auditCheckpoints;
}

function updateAuditCheckpoints(auditCheckpoints, changes, status, now) {
  const candidate = {
    ...auditCheckpoints,
    ...changes,
    status,
    updatedAt: now.toISOString()
  };
  return Object.freeze({
    ...candidate,
    continuation: Object.freeze(expectedContinuation(candidate))
  });
}

function assertCandidate(mission, auditCheckpoints) {
  const inspection = inspectAuditCheckpoints({ ...mission, auditCheckpoints });
  if (!inspection.valid) {
    throw new AuditCheckpointsError(
      `A evolução de audit-checkpoints é inválida: ${inspection.issues.join(", ")}.`
    );
  }
  return auditCheckpoints;
}

export function materializeImmutableAuditLedger({
  mission,
  id = randomUUID(),
  ledgerId = randomUUID(),
  now = new Date()
}) {
  assertReadySource(mission);
  if (mission.auditCheckpoints) {
    throw new AuditCheckpointsError(
      "A missão já possui um estado de audit-checkpoints preservado."
    );
  }
  const timestamp = now.toISOString();
  const sourceHistoryLength = mission.history.length;
  const entries = expectedLedgerEntries(mission, sourceHistoryLength);
  const closureBindings = expectedClosureBindings(mission);
  const auditLedger = Object.freeze({
    schemaVersion: 1,
    id: ledgerId,
    kind: "local_immutable_audit_ledger",
    status: "sealed_immutable",
    createdAt: timestamp,
    auditCheckpointsId: id,
    algorithm: "sha256",
    sourceHistoryLength,
    entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
    closureBindings: Object.freeze(
      closureBindings.map((binding) => Object.freeze(binding))
    ),
    ledgerDigest: contentDigest({ entries, closureBindings }),
    immutable: true,
    sourceHistoryRewritesAllowed: false,
    externalConnections: false
  });
  const auditCheckpoints = Object.freeze({
    schemaVersion: 1,
    id,
    missionId: mission.id,
    mode: "local_audit_only",
    classification: "implementation_new_reconstruction",
    externalConnections: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "audit_ledger_materialized",
    source: Object.freeze(expectedSource(mission)),
    auditLedger,
    continuation: Object.freeze({
      status: "open",
      lastCompletedPoint: 81,
      nextPoint: 82,
      nextStage: "audit-checkpoints",
      externalConnections: false
    })
  });
  return assertCandidate(mission, auditCheckpoints);
}

export function materializeCheckpointPolicy({
  mission,
  policyId = randomUUID(),
  now = new Date()
}) {
  const auditCheckpoints = requireAuditCheckpoints(mission);
  if (auditCheckpoints.status !== "audit_ledger_materialized") {
    throw new AuditCheckpointsError(
      "Crie a política de checkpoints somente depois do livro-razão."
    );
  }
  const checkpointPolicy = Object.freeze({
    schemaVersion: 1,
    id: policyId,
    kind: "local_checkpoint_policy",
    status: "active",
    createdAt: now.toISOString(),
    auditLedgerId: auditCheckpoints.auditLedger.id,
    archiveFormat: "tar",
    hashAlgorithm: "sha256",
    requirements: Object.freeze(
      CHECKPOINT_REQUIREMENT_IDS.map((id, index) =>
        Object.freeze({
          sequence: index + 1,
          id,
          required: true,
          status: "enforced"
        })
      )
    ),
    pathSafety: Object.freeze({
      absolutePathsAllowed: false,
      parentTraversalAllowed: false,
      escapingLinksAllowed: false
    }),
    originalCheckpointImmutable: true,
    independentRestoreRequired: true,
    directedValidationRequired: true,
    fullSuiteOnEntry: false,
    externalConnections: false
  });
  const updated = updateAuditCheckpoints(
    auditCheckpoints,
    { checkpointPolicy },
    "checkpoint_policy_active",
    now
  );
  return assertCandidate(mission, updated);
}

export function materializeSafeExportManifest({
  mission,
  manifestId = randomUUID(),
  now = new Date()
}) {
  const auditCheckpoints = requireAuditCheckpoints(mission);
  if (auditCheckpoints.status !== "checkpoint_policy_active") {
    throw new AuditCheckpointsError(
      "Crie o manifesto seguro somente depois da política de checkpoints."
    );
  }
  const entries = expectedExportEntries(mission, auditCheckpoints);
  const exportManifest = Object.freeze({
    schemaVersion: 1,
    id: manifestId,
    kind: "safe_structural_export_manifest",
    status: "materialized_blocked_content_excluded",
    createdAt: now.toISOString(),
    checkpointPolicyId: auditCheckpoints.checkpointPolicy.id,
    auditLedgerId: auditCheckpoints.auditLedger.id,
    scope: "authorized_structure_only",
    entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
    blockedContent: Object.freeze([...BLOCKED_EXPORT_CONTENT]),
    manifestDigest: contentDigest(entries),
    safety: Object.freeze({
      includesCredentials: false,
      includesSecrets: false,
      includesRealMedia: false,
      includesUnlicensedMedia: false,
      includesExternalConnectionConfig: false,
      publishesContent: false
    }),
    externalConnections: false
  });
  const updated = updateAuditCheckpoints(
    auditCheckpoints,
    { exportManifest },
    "safe_export_manifest_materialized",
    now
  );
  return assertCandidate(mission, updated);
}

export function validateCompleteAuditTrail({
  mission,
  validationId = randomUUID(),
  now = new Date()
}) {
  const auditCheckpoints = requireAuditCheckpoints(mission);
  if (auditCheckpoints.status !== "safe_export_manifest_materialized") {
    throw new AuditCheckpointsError(
      "Valide a trilha somente depois do manifesto estrutural seguro."
    );
  }
  const checks = expectedTrailChecks(mission, auditCheckpoints);
  const failedChecks = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  if (failedChecks.length > 0) {
    throw new AuditCheckpointsError(
      `A trilha de auditoria possui lacunas ou vínculos inválidos: ${failedChecks.join(", ")}.`
    );
  }
  const trailValidation = Object.freeze({
    schemaVersion: 1,
    id: validationId,
    kind: "complete_local_audit_trail_validation",
    status: "valid",
    validatedAt: now.toISOString(),
    auditLedgerId: auditCheckpoints.auditLedger.id,
    checkpointPolicyId: auditCheckpoints.checkpointPolicy.id,
    exportManifestId: auditCheckpoints.exportManifest.id,
    checks: Object.freeze(checks),
    gaps: Object.freeze([]),
    openIssues: Object.freeze([]),
    hashesValidated: true,
    closuresValidated: true,
    externalConnections: false
  });
  const updated = updateAuditCheckpoints(
    auditCheckpoints,
    { trailValidation },
    "audit_trail_validated",
    now
  );
  return assertCandidate(mission, updated);
}

export function consolidateAuditCheckpointReadinessReport({
  mission,
  reportId = randomUUID(),
  now = new Date()
}) {
  const auditCheckpoints = requireAuditCheckpoints(mission);
  if (auditCheckpoints.status !== "audit_trail_validated") {
    throw new AuditCheckpointsError(
      "Consolide o relatório somente depois da validação integral da trilha."
    );
  }
  const readinessReport = Object.freeze({
    schemaVersion: 1,
    id: reportId,
    kind: "audit_checkpoint_readiness_report",
    status: "ready_for_local_checkpoint",
    createdAt: now.toISOString(),
    auditLedgerId: auditCheckpoints.auditLedger.id,
    checkpointPolicyId: auditCheckpoints.checkpointPolicy.id,
    exportManifestId: auditCheckpoints.exportManifest.id,
    trailValidationId: auditCheckpoints.trailValidation.id,
    summary: Object.freeze({
      ledger: "valid_immutable",
      checkpointPolicy: "active",
      structuralExport: "safe",
      auditTrail: "valid_without_gaps",
      checkpointReady: true
    }),
    stageStatus: "open",
    nextPoint: 86,
    nextStage: "audit-checkpoints",
    realMediaIncluded: false,
    credentialsIncluded: false,
    secretsIncluded: false,
    externalConnections: false
  });
  const updated = updateAuditCheckpoints(
    auditCheckpoints,
    { readinessReport },
    "readiness_report_persisted",
    now
  );
  return assertCandidate(mission, updated);
}

export function materializeAuthorizedStructuralExport({
  mission,
  bundleId = randomUUID(),
  now = new Date()
}) {
  const auditCheckpoints = requireAuditCheckpoints(mission);
  if (auditCheckpoints.status !== "readiness_report_persisted") {
    throw new AuditCheckpointsError(
      "Materialize a exportação estrutural somente depois do relatório de prontidão."
    );
  }
  const records = expectedStructuralExportRecords(mission, auditCheckpoints);
  const structuralExportBundle = Object.freeze({
    schemaVersion: 1,
    id: bundleId,
    kind: "authorized_structural_export_bundle",
    status: "materialized_local",
    createdAt: now.toISOString(),
    readinessReportId: auditCheckpoints.readinessReport.id,
    exportManifestId: auditCheckpoints.exportManifest.id,
    format: "json",
    scope: "authorized_structure_only",
    records: Object.freeze(
      records.map((record) =>
        Object.freeze({
          ...record,
          payload: Object.freeze({ ...record.payload })
        })
      )
    ),
    recordCount: records.length,
    bundleDigest: contentDigest(records),
    realMediaIncluded: false,
    credentialsIncluded: false,
    secretsIncluded: false,
    externalConnectionConfigurationIncluded: false,
    binaryContentIncluded: false,
    published: false,
    externalConnections: false
  });
  const updated = updateAuditCheckpoints(
    auditCheckpoints,
    { structuralExportBundle },
    "structural_export_materialized",
    now
  );
  return assertCandidate(mission, updated);
}

export function sealStructuralExportIntegrity({
  mission,
  sealId = randomUUID(),
  now = new Date()
}) {
  const auditCheckpoints = requireAuditCheckpoints(mission);
  if (auditCheckpoints.status !== "structural_export_materialized") {
    throw new AuditCheckpointsError(
      "Sele a exportação somente depois do pacote estrutural autorizado."
    );
  }
  const records = expectedExportIntegrityRecords(auditCheckpoints);
  const exportIntegritySeal = Object.freeze({
    schemaVersion: 1,
    id: sealId,
    kind: "structural_export_integrity_seal",
    status: "sealed",
    sealedAt: now.toISOString(),
    structuralExportBundleId: auditCheckpoints.structuralExportBundle.id,
    algorithm: "sha256",
    records: Object.freeze(records.map((record) => Object.freeze(record))),
    sealDigest: contentDigest(records),
    mutationDetected: false,
    externalConnections: false
  });
  const updated = updateAuditCheckpoints(
    auditCheckpoints,
    { exportIntegritySeal },
    "structural_export_integrity_sealed",
    now
  );
  return assertCandidate(mission, updated);
}

export function verifyIndependentStructuralRestore({
  mission,
  verificationId = randomUUID(),
  now = new Date()
}) {
  const auditCheckpoints = requireAuditCheckpoints(mission);
  if (auditCheckpoints.status !== "structural_export_integrity_sealed") {
    throw new AuditCheckpointsError(
      "Verifique a restauração somente depois do selo de integridade."
    );
  }
  const bundle = auditCheckpoints.structuralExportBundle;
  const restoredRecords = JSON.parse(JSON.stringify(bundle.records));
  const checks = {
    serializedLocally: true,
    isolatedRoundTrip: true,
    recordCountMatched: restoredRecords.length === bundle.recordCount,
    digestMatched: contentDigest(restoredRecords) === bundle.bundleDigest,
    manifestLinkMatched:
      bundle.exportManifestId === auditCheckpoints.exportManifest.id,
    integritySealMatched:
      auditCheckpoints.exportIntegritySeal.structuralExportBundleId ===
        bundle.id &&
      auditCheckpoints.exportIntegritySeal.mutationDetected === false,
    restrictedContentAbsent:
      bundle.realMediaIncluded === false &&
      bundle.credentialsIncluded === false &&
      bundle.secretsIncluded === false &&
      bundle.externalConnectionConfigurationIncluded === false,
    externalConnectionsDisabled: bundle.externalConnections === false
  };
  if (Object.values(checks).some((value) => value !== true)) {
    throw new AuditCheckpointsError(
      "A restauração estrutural independente não preservou a integridade."
    );
  }
  const restoreVerification = Object.freeze({
    schemaVersion: 1,
    id: verificationId,
    kind: "independent_structural_restore_verification",
    status: "verified",
    verifiedAt: now.toISOString(),
    mode: "isolated_memory_roundtrip",
    structuralExportBundleId: bundle.id,
    exportIntegritySealId: auditCheckpoints.exportIntegritySeal.id,
    checks: Object.freeze(checks),
    restoredRecordCount: restoredRecords.length,
    restoredDigest: contentDigest(restoredRecords),
    outputFile: null,
    openIssues: Object.freeze([]),
    externalConnections: false
  });
  const updated = updateAuditCheckpoints(
    auditCheckpoints,
    { restoreVerification },
    "structural_restore_verified",
    now
  );
  return assertCandidate(mission, updated);
}

export function validateCompleteAuditCheckpoints({
  mission,
  validationId = randomUUID(),
  now = new Date()
}) {
  const auditCheckpoints = requireAuditCheckpoints(mission);
  if (auditCheckpoints.status !== "structural_restore_verified") {
    throw new AuditCheckpointsError(
      "Valide o estágio somente depois da restauração estrutural independente."
    );
  }
  const checks = expectedFinalAuditChecks(mission, auditCheckpoints);
  const failedChecks = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  if (failedChecks.length > 0) {
    throw new AuditCheckpointsError(
      `audit-checkpoints não passou na validação completa: ${failedChecks.join(", ")}.`
    );
  }
  const completeValidation = Object.freeze({
    schemaVersion: 1,
    id: validationId,
    kind: "complete_audit_checkpoints_validation",
    status: "valid",
    validatedAt: now.toISOString(),
    readinessReportId: auditCheckpoints.readinessReport.id,
    structuralExportBundleId: auditCheckpoints.structuralExportBundle.id,
    exportIntegritySealId: auditCheckpoints.exportIntegritySeal.id,
    restoreVerificationId: auditCheckpoints.restoreVerification.id,
    checks: Object.freeze(checks),
    safeExclusions: Object.freeze([
      "real_media",
      "credentials",
      "secrets",
      "external_connection_configuration"
    ]),
    openIssues: Object.freeze([]),
    checkpointReady: true,
    realAssetExecutionAllowed: false,
    externalConnections: false
  });
  const updated = updateAuditCheckpoints(
    auditCheckpoints,
    { completeValidation },
    "complete_audit_validation_valid",
    now
  );
  return assertCandidate(mission, updated);
}

export function closeAuditCheckpointsForAndroid({
  mission,
  closureId = randomUUID(),
  now = new Date()
}) {
  const auditCheckpoints = requireAuditCheckpoints(mission);
  if (auditCheckpoints.status !== "complete_audit_validation_valid") {
    throw new AuditCheckpointsError(
      "Feche audit-checkpoints somente depois da validação completa."
    );
  }
  const closure = Object.freeze({
    schemaVersion: 1,
    id: closureId,
    kind: "audit_checkpoints_closure",
    status: "closed",
    closedAt: now.toISOString(),
    completeValidationId: auditCheckpoints.completeValidation.id,
    readinessReportId: auditCheckpoints.readinessReport.id,
    restoreVerificationId: auditCheckpoints.restoreVerification.id,
    readyForAndroidExperience: true,
    nextStage: "android-experience",
    structuralExportVerified: true,
    realMediaIncluded: false,
    credentialsIncluded: false,
    published: false,
    externalConnections: false
  });
  const updated = updateAuditCheckpoints(
    auditCheckpoints,
    { closure },
    "ready_for_android_experience",
    now
  );
  return assertCandidate(mission, updated);
}
