import { randomUUID } from "./crypto-browser.js";
import { inspectAuditCheckpoints } from "./audit-checkpoints.js";

const MOBILE_SURFACE_IDS = Object.freeze([
  "mission_form",
  "primary_actions",
  "mission_cards",
  "status_feedback"
]);

const OFFLINE_SHELL_RESOURCES = Object.freeze([
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.webmanifest",
  "/icons/ia-a.svg"
]);

const FIELD_LOCK_IDS = Object.freeze([
  "real_android_device_test",
  "field_connections",
  "real_media_render",
  "publication",
  "account_connection",
  "credentials",
  "billing"
]);

export class AndroidExperienceError extends Error {
  constructor(message) {
    super(message);
    this.name = "AndroidExperienceError";
  }
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
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
  const auditInspection = inspectAuditCheckpoints(mission);
  const audit = mission?.auditCheckpoints;
  if (
    !auditInspection.valid ||
    audit?.status !== "ready_for_android_experience" ||
    audit.closure?.status !== "closed" ||
    audit.closure?.readyForAndroidExperience !== true ||
    audit.closure?.nextStage !== "android-experience" ||
    audit.continuation?.lastCompletedPoint !== 90 ||
    audit.continuation?.nextPoint !== 91 ||
    mission.strategyPackage?.status !== "strategic_package_closed" ||
    mission.textPackage?.closure?.status !== "closed" ||
    mission.scenePackage?.closure?.status !== "closed" ||
    mission.validationSafety?.closure?.status !== "closed"
  ) {
    throw new AndroidExperienceError(
      "audit-checkpoints precisa estar fechado, íntegro e pronto para android-experience."
    );
  }
  return audit;
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
    textPackageId: mission.textPackage.id,
    scenePackageId: mission.scenePackage.id,
    validationSafetyId: mission.validationSafety.id,
    auditCheckpointsId: mission.auditCheckpoints.id,
    auditClosureId: mission.auditCheckpoints.closure.id,
    theme: mission.textPackage.sourceContext.theme,
    themeClassification: mission.textPackage.sourceContext.themeClassification
  };
}

function sourceMatches(mission, source) {
  return Object.entries(expectedSource(mission)).every(
    ([key, value]) => source?.[key] === value
  );
}

function expectedContinuation(androidExperience) {
  const completedPoint = androidExperience.closure
    ? 95
    : androidExperience.completeValidation
      ? 94
      : androidExperience.installabilityPackage
        ? 93
        : androidExperience.ergonomicsContract
          ? 92
          : 91;
  return {
    status: androidExperience.closure ? "closed" : "open",
    lastCompletedPoint: completedPoint,
    nextPoint: completedPoint + 1,
    nextStage: androidExperience.closure
      ? "field-connections"
      : "android-experience",
    externalConnections: false
  };
}

function expectedErgonomicsRules() {
  return [
    {
      sequence: 1,
      id: "responsive_viewport",
      value: "width=device-width, initial-scale=1, viewport-fit=cover",
      status: "applied"
    },
    {
      sequence: 2,
      id: "touch_target_minimum",
      value: 44,
      unit: "css_pixels",
      status: "applied"
    },
    {
      sequence: 3,
      id: "narrow_screen_reflow",
      value: 576,
      unit: "css_pixels",
      status: "applied"
    },
    {
      sequence: 4,
      id: "sequential_actions",
      value: true,
      status: "applied"
    },
    {
      sequence: 5,
      id: "visible_keyboard_focus",
      value: true,
      status: "applied"
    },
    {
      sequence: 6,
      id: "user_zoom_allowed",
      value: true,
      status: "applied"
    }
  ];
}

function expectedValidationChecks(mission, androidExperience) {
  const capability = androidExperience.capabilityProfile;
  const ergonomics = androidExperience.ergonomicsContract;
  const installability = androidExperience.installabilityPackage;
  const auditInspection = inspectAuditCheckpoints(mission);
  return {
    auditCheckpointsClosed: auditInspection.valid &&
      mission.auditCheckpoints.closure.readyForAndroidExperience === true,
    sourceIdentityPreserved: sourceMatches(mission, androidExperience.source),
    capabilityProfileValid:
      capability.status === "materialized_local" &&
      capability.execution.origin === "http://127.0.0.1" &&
      capability.execution.externalConnections === false,
    ergonomicsContractApplied:
      ergonomics.status === "applied_local_interface" &&
      ergonomics.interfaceFilesUpdated === true,
    responsiveNarrowScreenReady:
      ergonomics.layout.minimumViewportCssPixels === 320 &&
      ergonomics.layout.singleColumnAtOrBelowCssPixels === 576,
    touchTargetsReady:
      ergonomics.interaction.minimumTouchTargetCssPixels === 44 &&
      ergonomics.interaction.primaryInput === "touch",
    accessibilityReady:
      ergonomics.accessibility.userZoomAllowed === true &&
      ergonomics.accessibility.visibleFocus === true &&
      ergonomics.accessibility.liveStatusFeedback === true,
    sequentialNavigationReady:
      ergonomics.navigation.actionsSequential === true &&
      ergonomics.navigation.horizontalActionScrollRequired === false,
    installabilityPackageComplete:
      installability.status === "structurally_prepared" &&
      arraysEqual(installability.shellResources, OFFLINE_SHELL_RESOURCES),
    offlineShellSafe:
      installability.offline.interfaceShellPrepared === true &&
      installability.offline.apiUsesNetworkOnly === true &&
      installability.offline.staleMissionMutationAllowed === false,
    localLoopbackPreserved:
      capability.execution.origin === "http://127.0.0.1" &&
      installability.execution.localOnly === true,
    operationalLocksPreserved:
      FIELD_LOCK_IDS.every((id) =>
        installability.locks.some(
          (lock) => lock.id === id && lock.status === "blocked"
        )
      ),
    realAndroidDeviceTestPending:
      capability.realDeviceValidation.status === "pending_field_test" &&
      capability.realDeviceValidation.tested === false &&
      installability.realDeviceInstall.status === "pending_field_test" &&
      installability.realDeviceInstall.tested === false,
    externalConnectionsDisabled:
      androidExperience.externalConnections === false &&
      capability.execution.externalConnections === false &&
      installability.externalConnections === false
  };
}

function collectAndroidExperienceIssues(mission) {
  const androidExperience = mission?.androidExperience;
  if (!androidExperience) return [];
  const issues = [];
  try {
    assertReadySource(mission);
  } catch {
    return ["android_source_not_ready"];
  }

  if (
    androidExperience.missionId !== mission.id ||
    androidExperience.mode !== "local_android_preparation" ||
    androidExperience.classification !== "implementation_new_reconstruction" ||
    androidExperience.externalConnections !== false ||
    !sourceMatches(mission, androidExperience.source)
  ) {
    issues.push("android_identity_invalid");
  }

  const capability = androidExperience.capabilityProfile;
  if (
    !capability ||
    capability.kind !== "local_android_capability_profile" ||
    capability.status !== "materialized_local" ||
    capability.androidPriority !== true ||
    capability.evidence !== "local_configuration_only" ||
    capability.viewport?.minimumCssPixels !== 320 ||
    capability.viewport?.initialScale !== 1 ||
    capability.viewport?.responsive !== true ||
    capability.interaction?.primaryInput !== "touch" ||
    capability.interaction?.minimumTargetCssPixels !== 44 ||
    capability.execution?.mode !== "local_loopback" ||
    capability.execution?.origin !== "http://127.0.0.1" ||
    capability.execution?.externalConnections !== false ||
    capability.realDeviceValidation?.status !== "pending_field_test" ||
    capability.realDeviceValidation?.tested !== false ||
    capability.realDeviceValidation?.claimed !== false ||
    capability.published !== false ||
    capability.externalConnections !== false
  ) {
    issues.push("android_capability_profile_invalid");
  }

  const ergonomics = androidExperience.ergonomicsContract;
  const expectedRules = expectedErgonomicsRules();
  if (ergonomics && !capability) {
    issues.push("android_ergonomics_before_capability");
  }
  if (
    ergonomics &&
    (ergonomics.kind !== "local_mobile_ergonomics_contract" ||
      ergonomics.status !== "applied_local_interface" ||
      ergonomics.capabilityProfileId !== capability?.id ||
      !recordsEqual(ergonomics.rules, expectedRules, [
        "sequence",
        "id",
        "value",
        "unit",
        "status"
      ]) ||
      !arraysEqual(ergonomics.surfaces, MOBILE_SURFACE_IDS) ||
      ergonomics.layout?.minimumViewportCssPixels !== 320 ||
      ergonomics.layout?.singleColumnAtOrBelowCssPixels !== 576 ||
      ergonomics.layout?.horizontalOverflowAllowed !== false ||
      ergonomics.interaction?.primaryInput !== "touch" ||
      ergonomics.interaction?.minimumTouchTargetCssPixels !== 44 ||
      ergonomics.navigation?.actionsSequential !== true ||
      ergonomics.navigation?.horizontalActionScrollRequired !== false ||
      ergonomics.accessibility?.userZoomAllowed !== true ||
      ergonomics.accessibility?.visibleFocus !== true ||
      ergonomics.accessibility?.liveStatusFeedback !== true ||
      ergonomics.interfaceFilesUpdated !== true ||
      ergonomics.assetsMutated !== false ||
      ergonomics.externalConnections !== false)
  ) {
    issues.push("android_ergonomics_contract_invalid");
  }

  const installability = androidExperience.installabilityPackage;
  if (installability && !ergonomics) {
    issues.push("android_installability_before_ergonomics");
  }
  if (
    installability &&
    (installability.kind !== "local_offline_installability_package" ||
      installability.status !== "structurally_prepared" ||
      installability.ergonomicsContractId !== ergonomics?.id ||
      installability.manifestUrl !== "/manifest.webmanifest" ||
      installability.serviceWorkerUrl !== "/service-worker.js" ||
      installability.iconUrl !== "/icons/ia-a.svg" ||
      installability.cacheName !== "ia-a-local-shell-v1" ||
      !arraysEqual(installability.shellResources, OFFLINE_SHELL_RESOURCES) ||
      installability.offline?.interfaceShellPrepared !== true ||
      installability.offline?.apiUsesNetworkOnly !== true ||
      installability.offline?.staleMissionMutationAllowed !== false ||
      installability.offline?.apiFailureStatus !== 503 ||
      installability.execution?.localOnly !== true ||
      installability.execution?.origin !== "http://127.0.0.1" ||
      installability.execution?.published !== false ||
      installability.execution?.accountConnected !== false ||
      installability.realDeviceInstall?.status !== "pending_field_test" ||
      installability.realDeviceInstall?.tested !== false ||
      !Array.isArray(installability.locks) ||
      !arraysEqual(installability.locks.map((lock) => lock.id), FIELD_LOCK_IDS) ||
      installability.locks.some((lock) => lock.status !== "blocked") ||
      installability.externalConnections !== false)
  ) {
    issues.push("android_installability_package_invalid");
  }

  const validation = androidExperience.completeValidation;
  if (validation && !installability) {
    issues.push("android_validation_before_installability");
  }
  const expectedChecks = installability
    ? expectedValidationChecks(mission, androidExperience)
    : {};
  if (
    validation &&
    (validation.kind !== "complete_android_experience_validation" ||
      validation.status !== "valid_with_field_test_pending" ||
      validation.capabilityProfileId !== capability?.id ||
      validation.ergonomicsContractId !== ergonomics?.id ||
      validation.installabilityPackageId !== installability?.id ||
      Object.entries(expectedChecks).some(
        ([key, value]) => value !== true || validation.checks?.[key] !== true
      ) ||
      !arraysEqual(validation.pendingFieldChecks, [
        "real_android_device_execution",
        "install_prompt",
        "touch_interaction",
        "performance_on_device"
      ]) ||
      validation.openIssues?.length !== 0 ||
      validation.fieldConnectionsStarted !== false ||
      validation.published !== false ||
      validation.externalConnections !== false)
  ) {
    issues.push("android_complete_validation_invalid");
  }

  const report = androidExperience.readinessReport;
  const closure = androidExperience.closure;
  if ((report || closure) && !validation) {
    issues.push("android_closure_before_validation");
  }
  if (
    report &&
    (report.kind !== "android_readiness_report" ||
      report.status !== "ready_for_field_connections" ||
      report.completeValidationId !== validation?.id ||
      report.summary?.capabilityProfile !== "valid_local" ||
      report.summary?.ergonomics !== "applied" ||
      report.summary?.installability !== "structurally_prepared" ||
      report.summary?.offlineOperation !== "safe_shell_only" ||
      report.summary?.realDeviceValidation !== "pending_field_test" ||
      report.readyForFieldConnections !== true ||
      report.fieldConnectionsStarted !== false ||
      report.andersonManualPhaseAvailableAfterClosure !== true ||
      report.realAndroidDeviceTested !== false ||
      report.published !== false ||
      report.externalConnections !== false)
  ) {
    issues.push("android_readiness_report_invalid");
  }
  if (
    closure &&
    (closure.kind !== "android_experience_closure" ||
      closure.status !== "closed" ||
      closure.readinessReportId !== report?.id ||
      closure.completeValidationId !== validation?.id ||
      closure.readyForFieldConnections !== true ||
      closure.nextStage !== "field-connections" ||
      closure.fieldConnectionsStarted !== false ||
      closure.realAndroidDeviceTested !== false ||
      closure.renderedRealMedia !== false ||
      closure.published !== false ||
      closure.accountConnected !== false ||
      closure.credentialsRequested !== false ||
      closure.chargeCreated !== false ||
      closure.externalConnections !== false)
  ) {
    issues.push("android_experience_closure_invalid");
  }

  const continuation = expectedContinuation(androidExperience);
  if (
    Object.entries(continuation).some(
      ([key, value]) => androidExperience.continuation?.[key] !== value
    )
  ) {
    issues.push("android_continuation_invalid");
  }

  const expectedStatus = closure
    ? "ready_for_field_connections"
    : validation
      ? "android_experience_validated"
      : installability
        ? "offline_installability_prepared"
        : ergonomics
          ? "ergonomics_contract_applied"
          : "capability_profile_materialized";
  if (androidExperience.status !== expectedStatus) {
    issues.push("android_status_invalid");
  }
  return [...new Set(issues)];
}

export function inspectAndroidExperience(mission) {
  const issues = collectAndroidExperienceIssues(mission);
  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues)
  });
}

function requireAndroidExperience(mission) {
  if (!mission?.androidExperience) {
    throw new AndroidExperienceError(
      "Materialize o perfil Android antes de continuar android-experience."
    );
  }
  const inspection = inspectAndroidExperience(mission);
  if (!inspection.valid) {
    throw new AndroidExperienceError(
      `O estado de android-experience é inválido: ${inspection.issues.join(", ")}.`
    );
  }
  return mission.androidExperience;
}

function updateAndroidExperience(androidExperience, changes, status, now) {
  const candidate = {
    ...androidExperience,
    ...changes,
    status,
    updatedAt: now.toISOString()
  };
  return Object.freeze({
    ...candidate,
    continuation: Object.freeze(expectedContinuation(candidate))
  });
}

function assertCandidate(mission, androidExperience) {
  const inspection = inspectAndroidExperience({ ...mission, androidExperience });
  if (!inspection.valid) {
    throw new AndroidExperienceError(
      `A evolução de android-experience é inválida: ${inspection.issues.join(", ")}.`
    );
  }
  return androidExperience;
}

export function materializeAndroidCapabilityProfile({
  mission,
  id = randomUUID(),
  profileId = randomUUID(),
  now = new Date()
}) {
  const audit = assertReadySource(mission);
  if (mission.androidExperience) {
    throw new AndroidExperienceError(
      "A missão já possui um estado de android-experience preservado."
    );
  }
  const timestamp = now.toISOString();
  const capabilityProfile = Object.freeze({
    schemaVersion: 1,
    id: profileId,
    kind: "local_android_capability_profile",
    status: "materialized_local",
    createdAt: timestamp,
    auditClosureId: audit.closure.id,
    androidPriority: true,
    evidence: "local_configuration_only",
    viewport: Object.freeze({
      minimumCssPixels: 320,
      initialScale: 1,
      responsive: true,
      viewportFit: "cover"
    }),
    interaction: Object.freeze({
      primaryInput: "touch",
      minimumTargetCssPixels: 44,
      keyboardSupported: true
    }),
    execution: Object.freeze({
      mode: "local_loopback",
      origin: "http://127.0.0.1",
      offlineShellTarget: true,
      externalConnections: false
    }),
    realDeviceValidation: Object.freeze({
      status: "pending_field_test",
      tested: false,
      claimed: false,
      requiresAndersonAfterPoint95: true
    }),
    unvalidatedLimits: Object.freeze([
      "device_performance",
      "screen_variations",
      "browser_install_prompt",
      "touch_behavior_on_real_device"
    ]),
    published: false,
    externalConnections: false
  });
  const androidExperience = Object.freeze({
    schemaVersion: 1,
    id,
    missionId: mission.id,
    mode: "local_android_preparation",
    classification: "implementation_new_reconstruction",
    externalConnections: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "capability_profile_materialized",
    source: Object.freeze(expectedSource(mission)),
    capabilityProfile,
    continuation: Object.freeze({
      status: "open",
      lastCompletedPoint: 91,
      nextPoint: 92,
      nextStage: "android-experience",
      externalConnections: false
    })
  });
  return assertCandidate(mission, androidExperience);
}

export function applyMobileErgonomicsContract({
  mission,
  contractId = randomUUID(),
  now = new Date()
}) {
  const androidExperience = requireAndroidExperience(mission);
  if (androidExperience.status !== "capability_profile_materialized") {
    throw new AndroidExperienceError(
      "Aplique a ergonomia móvel somente depois do perfil Android."
    );
  }
  const rules = expectedErgonomicsRules();
  const ergonomicsContract = Object.freeze({
    schemaVersion: 1,
    id: contractId,
    kind: "local_mobile_ergonomics_contract",
    status: "applied_local_interface",
    appliedAt: now.toISOString(),
    capabilityProfileId: androidExperience.capabilityProfile.id,
    surfaces: Object.freeze([...MOBILE_SURFACE_IDS]),
    rules: Object.freeze(rules.map((rule) => Object.freeze(rule))),
    layout: Object.freeze({
      minimumViewportCssPixels: 320,
      singleColumnAtOrBelowCssPixels: 576,
      contentWidth: "fluid_bounded",
      horizontalOverflowAllowed: false
    }),
    interaction: Object.freeze({
      primaryInput: "touch",
      minimumTouchTargetCssPixels: 44,
      touchAction: "manipulation"
    }),
    navigation: Object.freeze({
      actionsSequential: true,
      semanticLandmarks: true,
      horizontalActionScrollRequired: false
    }),
    accessibility: Object.freeze({
      userZoomAllowed: true,
      visibleFocus: true,
      liveStatusFeedback: true,
      reducedMotionHonored: true
    }),
    interfaceFilesUpdated: true,
    assetsMutated: false,
    externalConnections: false
  });
  const updated = updateAndroidExperience(
    androidExperience,
    { ergonomicsContract },
    "ergonomics_contract_applied",
    now
  );
  return assertCandidate(mission, updated);
}

export function prepareOfflineInstallabilityPackage({
  mission,
  packageId = randomUUID(),
  now = new Date()
}) {
  const androidExperience = requireAndroidExperience(mission);
  if (androidExperience.status !== "ergonomics_contract_applied") {
    throw new AndroidExperienceError(
      "Prepare a instalabilidade somente depois da ergonomia móvel."
    );
  }
  const installabilityPackage = Object.freeze({
    schemaVersion: 1,
    id: packageId,
    kind: "local_offline_installability_package",
    status: "structurally_prepared",
    createdAt: now.toISOString(),
    ergonomicsContractId: androidExperience.ergonomicsContract.id,
    manifestUrl: "/manifest.webmanifest",
    serviceWorkerUrl: "/service-worker.js",
    iconUrl: "/icons/ia-a.svg",
    cacheName: "ia-a-local-shell-v1",
    shellResources: Object.freeze([...OFFLINE_SHELL_RESOURCES]),
    offline: Object.freeze({
      interfaceShellPrepared: true,
      navigationFallback: "/index.html",
      apiUsesNetworkOnly: true,
      staleMissionMutationAllowed: false,
      apiFailureStatus: 503
    }),
    execution: Object.freeze({
      localOnly: true,
      origin: "http://127.0.0.1",
      published: false,
      accountConnected: false,
      externalResources: false
    }),
    realDeviceInstall: Object.freeze({
      status: "pending_field_test",
      tested: false,
      installPromptClaimed: false
    }),
    locks: Object.freeze(
      FIELD_LOCK_IDS.map((id, index) =>
        Object.freeze({ sequence: index + 1, id, status: "blocked" })
      )
    ),
    externalConnections: false
  });
  const updated = updateAndroidExperience(
    androidExperience,
    { installabilityPackage },
    "offline_installability_prepared",
    now
  );
  return assertCandidate(mission, updated);
}

export function validateCompleteAndroidExperience({
  mission,
  validationId = randomUUID(),
  now = new Date()
}) {
  const androidExperience = requireAndroidExperience(mission);
  if (androidExperience.status !== "offline_installability_prepared") {
    throw new AndroidExperienceError(
      "Valide android-experience somente depois da instalabilidade local."
    );
  }
  const checks = expectedValidationChecks(mission, androidExperience);
  const failedChecks = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  if (failedChecks.length > 0) {
    throw new AndroidExperienceError(
      `android-experience não passou na validação local: ${failedChecks.join(", ")}.`
    );
  }
  const completeValidation = Object.freeze({
    schemaVersion: 1,
    id: validationId,
    kind: "complete_android_experience_validation",
    status: "valid_with_field_test_pending",
    validatedAt: now.toISOString(),
    capabilityProfileId: androidExperience.capabilityProfile.id,
    ergonomicsContractId: androidExperience.ergonomicsContract.id,
    installabilityPackageId: androidExperience.installabilityPackage.id,
    checks: Object.freeze(checks),
    pendingFieldChecks: Object.freeze([
      "real_android_device_execution",
      "install_prompt",
      "touch_interaction",
      "performance_on_device"
    ]),
    openIssues: Object.freeze([]),
    fieldConnectionsStarted: false,
    published: false,
    externalConnections: false
  });
  const updated = updateAndroidExperience(
    androidExperience,
    { completeValidation },
    "android_experience_validated",
    now
  );
  return assertCandidate(mission, updated);
}

export function closeAndroidExperienceForFieldConnections({
  mission,
  reportId = randomUUID(),
  closureId = randomUUID(),
  now = new Date()
}) {
  const androidExperience = requireAndroidExperience(mission);
  if (androidExperience.status !== "android_experience_validated") {
    throw new AndroidExperienceError(
      "Feche android-experience somente depois da validação completa."
    );
  }
  const timestamp = now.toISOString();
  const readinessReport = Object.freeze({
    schemaVersion: 1,
    id: reportId,
    kind: "android_readiness_report",
    status: "ready_for_field_connections",
    createdAt: timestamp,
    completeValidationId: androidExperience.completeValidation.id,
    summary: Object.freeze({
      capabilityProfile: "valid_local",
      ergonomics: "applied",
      installability: "structurally_prepared",
      offlineOperation: "safe_shell_only",
      realDeviceValidation: "pending_field_test"
    }),
    readyForFieldConnections: true,
    fieldConnectionsStarted: false,
    andersonManualPhaseAvailableAfterClosure: true,
    realAndroidDeviceTested: false,
    published: false,
    externalConnections: false
  });
  const closure = Object.freeze({
    schemaVersion: 1,
    id: closureId,
    kind: "android_experience_closure",
    status: "closed",
    closedAt: timestamp,
    readinessReportId: reportId,
    completeValidationId: androidExperience.completeValidation.id,
    readyForFieldConnections: true,
    nextStage: "field-connections",
    fieldConnectionsStarted: false,
    realAndroidDeviceTested: false,
    renderedRealMedia: false,
    published: false,
    accountConnected: false,
    credentialsRequested: false,
    chargeCreated: false,
    externalConnections: false
  });
  const updated = updateAndroidExperience(
    androidExperience,
    { readinessReport, closure },
    "ready_for_field_connections",
    now
  );
  return assertCandidate(mission, updated);
}
