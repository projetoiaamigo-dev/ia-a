import { randomUUID } from "./crypto-browser.js";
import { inspectAndroidExperience } from "./android-experience.js";
import { PROJECT_CHANNELS } from "./channels.js";

const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_REVOCATION_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/youtube.readonly";
const YOUTUBE_UPLOAD_SCOPE =
  "https://www.googleapis.com/auth/youtube.upload";

const REQUIRED_CONFIGURATION_FIELDS = Object.freeze([
  Object.freeze({
    id: "google_oauth_client_id",
    storage: "chrome_local_storage",
    secret: false
  }),
  Object.freeze({
    id: "google_oauth_authorized_javascript_origin",
    storage: "google_cloud_console",
    secret: false
  })
]);

const REQUIRED_MANUAL_EVIDENCE_IDS = Object.freeze([
  "new_google_cloud_project_created",
  "youtube_data_api_enabled",
  "oauth_brand_and_consent_configured",
  "oauth_web_client_created",
  "authorized_javascript_origin_registered",
  "public_client_id_configured_in_chrome",
  "web_radio_louvar_youtube_identity_confirmed",
  "fale_com_deus_youtube_identity_confirmed",
  "eu_oro_por_voce_youtube_identity_confirmed",
  "codigo_da_biblia_youtube_identity_confirmed",
  "palavra_que_desperta_youtube_identity_confirmed",
  "real_android_device_tested",
  "explicit_field_authorization_recorded"
]);

const OFFICIAL_REFERENCE_RECORDS = Object.freeze([
  Object.freeze({
    id: "google-oauth-web-server",
    url: "https://developers.google.com/identity/oauth2/web/guides/use-token-model",
    classification: "verified_public_source",
    verifiedAt: "2026-08-13"
  }),
  Object.freeze({
    id: "youtube-oauth-server-side",
    url: "https://developers.google.com/youtube/v3/guides/auth/client-side-web-apps",
    classification: "verified_public_source",
    verifiedAt: "2026-08-13"
  }),
  Object.freeze({
    id: "youtube-oauth-overview",
    url: "https://developers.google.com/youtube/v3/guides/authentication",
    classification: "verified_public_source",
    verifiedAt: "2026-08-13"
  }),
  Object.freeze({
    id: "google-oauth-policy",
    url: "https://developers.google.com/identity/protocols/oauth2/policies",
    classification: "verified_public_source",
    verifiedAt: "2026-08-13"
  })
]);

export class FieldConnectionsError extends Error {
  constructor(message) {
    super(message);
    this.name = "FieldConnectionsError";
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
  const androidInspection = inspectAndroidExperience(mission);
  const android = mission?.androidExperience;
  if (
    !androidInspection.valid ||
    android?.status !== "ready_for_field_connections" ||
    android.closure?.status !== "closed" ||
    android.closure?.readyForFieldConnections !== true ||
    android.closure?.nextStage !== "field-connections" ||
    android.continuation?.lastCompletedPoint !== 95 ||
    android.continuation?.nextPoint !== 96 ||
    android.closure?.fieldConnectionsStarted !== false ||
    android.closure?.realAndroidDeviceTested !== false ||
    android.closure?.published !== false ||
    android.closure?.externalConnections !== false
  ) {
    throw new FieldConnectionsError(
      "android-experience precisa estar fechado, íntegro e pronto para field-connections."
    );
  }
  return android;
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
    androidExperienceId: mission.androidExperience.id,
    androidClosureId: mission.androidExperience.closure.id,
    theme: mission.textPackage.sourceContext.theme,
    themeClassification: mission.textPackage.sourceContext.themeClassification
  };
}

function sourceMatches(mission, source) {
  return Object.entries(expectedSource(mission)).every(
    ([key, value]) => source?.[key] === value
  );
}

function expectedContinuation(fieldConnections) {
  const completedPoint = fieldConnections.internalHandoff
    ? 99
    : fieldConnections.channelConnectionPlan
      ? 98
      : fieldConnections.oauthContract
        ? 97
        : 96;
  return {
    status: fieldConnections.internalHandoff
      ? "waiting_for_anderson"
      : "internal_preparation",
    lastCompletedPoint: completedPoint,
    nextPoint: completedPoint + 1,
    nextStage: "field-connections",
    requiresAnderson: completedPoint === 99,
    externalConnections: false
  };
}

function expectedConnectorRecords() {
  return [
    {
      sequence: 1,
      id: "youtube-data",
      category: "distribution_and_channel_data",
      provider: "google_youtube",
      status: "contract_prepared_connection_blocked",
      protocol: "oauth2_browser_token_model",
      interactiveConsentRequired: true,
      serviceAccountSupported: false
    },
    {
      sequence: 2,
      id: "music-generation",
      category: "music_generation",
      provider: "provider_not_connected",
      status: "provider_contract_pending_field_decision",
      protocol: null,
      interactiveConsentRequired: true,
      serviceAccountSupported: null
    },
    {
      sequence: 3,
      id: "video-generation",
      category: "dynamic_video_generation",
      provider: "provider_not_connected",
      status: "provider_contract_pending_field_decision",
      protocol: null,
      interactiveConsentRequired: true,
      serviceAccountSupported: null
    },
    {
      sequence: 4,
      id: "android-field",
      category: "real_device_validation",
      provider: "android_device",
      status: "real_device_test_pending",
      protocol: "manual_guided_validation",
      interactiveConsentRequired: true,
      serviceAccountSupported: null
    }
  ];
}

function expectedChannelPlans() {
  return PROJECT_CHANNELS.map((channel, index) => ({
    sequence: index + 1,
    channelId: channel.id,
    channelName: channel.name,
    channelStatus: channel.status,
    connectionAlias: `youtube-${channel.id}`,
    distinctYouTubeChannelRequired: true,
    objective:
      channel.id === "web-radio-louvar"
        ? "daily_short_subscriber_growth"
        : "channel_specific_long_form_work",
    contentPolicy: "official_brain_and_own_channel_field_data",
    monetization:
      channel.monetization === "never"
        ? "permanently_disabled"
        : channel.monetization === "enabled"
          ? "enabled"
          : "configuration_pending",
    shortsRole:
      channel.id === "web-radio-louvar"
        ? "daily_primary_format"
        : "not_primary_content",
    brainIsolationRequired: true,
    publishingEnabled: false,
    connectionStatus:
      channel.status === "active"
        ? "distinct_channel_connection_pending_confirmation"
        : "channel_configuration_pending"
  }));
}

function expectedHandoffSteps(fieldConnections) {
  const preparationSteps = [
    { sequence: 1, id: "create_clean_google_cloud_project", screen: "Google Cloud · seleção de projeto", actionOwner: "anderson", status: "pending_manual", secretInputInChatAllowed: false },
    { sequence: 2, id: "enable_youtube_data_api", screen: "Google Cloud · Biblioteca de APIs", actionOwner: "anderson", status: "pending_manual", secretInputInChatAllowed: false },
    { sequence: 3, id: "configure_oauth_brand_and_consent", screen: "Google Auth Platform · marca, público e acesso", actionOwner: "anderson", status: "pending_manual", secretInputInChatAllowed: false },
    { sequence: 4, id: "create_oauth_web_client", screen: "Google Auth Platform · clientes", actionOwner: "anderson", status: "pending_manual", secretInputInChatAllowed: false },
    { sequence: 5, id: "register_exact_javascript_origin", screen: "Cliente OAuth · origem JavaScript autorizada", actionOwner: "anderson", status: "pending_manual", secretInputInChatAllowed: false },
    { sequence: 6, id: "configure_public_client_id", screen: "IA A · Client ID público no Chrome", actionOwner: "anderson_with_guidance", status: "pending_manual", secretInputInChatAllowed: false }
  ];
  const channelSteps = PROJECT_CHANNELS.map((channel, index) => ({
    sequence: index + 7,
    id: `authorize_and_confirm_${channel.id.replaceAll("-", "_")}`,
    screen: `Google OAuth · ${channel.name} · link próprio`,
    actionOwner: "anderson",
    status: "pending_manual",
    secretInputInChatAllowed: false
  }));
  return [
    ...preparationSteps,
    ...channelSteps,
    { sequence: 12, id: "validate_on_real_android_device", screen: "Android real · interface, toque e instalação", actionOwner: "anderson_with_guidance", status: "pending_manual", secretInputInChatAllowed: false },
    { sequence: 13, id: "authorize_controlled_field_test", screen: "IA A · autorização final da operação de teste", actionOwner: "anderson", status: "pending_explicit_authorization", secretInputInChatAllowed: false }
  ].map((step) => ({
    ...step,
    connectorRegistryId: fieldConnections.connectorRegistry.id
  }));
}

function expectedInternalChecks(mission, fieldConnections) {
  const registry = fieldConnections.connectorRegistry;
  const oauth = fieldConnections.oauthContract;
  const plan = fieldConnections.channelConnectionPlan;
  const connectors = expectedConnectorRecords();
  const channelPlans = expectedChannelPlans();
  return {
    androidExperienceClosed:
      mission.androidExperience.closure.status === "closed" &&
      mission.androidExperience.closure.readyForFieldConnections === true,
    sourceIdentityPreserved: sourceMatches(mission, fieldConnections.source),
    connectorRegistryComplete: recordsEqual(registry.connectors, connectors, [
      "sequence",
      "id",
      "category",
      "provider",
      "status",
      "protocol",
      "interactiveConsentRequired",
      "serviceAccountSupported"
    ]),
    officialSourcesPreserved:
      registry.officialReferences.length === OFFICIAL_REFERENCE_RECORDS.length &&
      registry.officialReferences.every(
        (source, index) => source.url === OFFICIAL_REFERENCE_RECORDS[index].url
      ),
    oauthBrowserTokenModelPrepared:
      oauth.flow === "browser_token_model" &&
      oauth.authorizationEndpoint === GOOGLE_AUTHORIZATION_ENDPOINT &&
      oauth.backendRequired === false,
    oauthBrowserSafetyPrepared:
      oauth.security.clientSecretInBrowserAllowed === false &&
      oauth.security.embeddedWebViewAllowed === false &&
      oauth.security.authorizedJavascriptOriginRequired === true,
    minimumIncrementalScopes:
      arraysEqual(oauth.scopes.identity, [YOUTUBE_READONLY_SCOPE]) &&
      arraysEqual(oauth.scopes.uploadAfterExplicitAuthorization, [
        YOUTUBE_UPLOAD_SCOPE
      ]) &&
      oauth.incrementalAuthorization === true,
    youtubeServiceAccountBlocked: oauth.serviceAccountSupported === false,
    secretValuesAbsent:
      oauth.configuration.every(
        (field) => field.value === null && field.valueStored === false
      ) &&
      oauth.tokenStorage.tokensStored === false,
    projectChannelsHaveDistinctConnections:
      new Set(plan.channels.map((channel) => channel.connectionAlias)).size ===
        PROJECT_CHANNELS.length &&
      recordsEqual(plan.channels, channelPlans, [
      "sequence",
      "channelId",
      "channelName",
      "channelStatus",
      "connectionAlias",
      "distinctYouTubeChannelRequired",
      "objective",
      "contentPolicy",
      "monetization",
      "shortsRole",
      "brainIsolationRequired",
      "publishingEnabled",
      "connectionStatus"
    ]),
    louvarMonetizationDisabled:
      plan.channels.find((channel) => channel.channelId === "web-radio-louvar")
        ?.monetization === "permanently_disabled",
    publishingBlocked:
      plan.channels.every((channel) => channel.publishingEnabled === false) &&
      plan.dryRun.publish === false,
    externalConnectionsNotStarted:
      fieldConnections.externalConnections === false &&
      registry.externalConnections === false &&
      oauth.externalConnections === false &&
      plan.externalConnections === false
  };
}

function collectFieldConnectionsIssues(mission) {
  const fieldConnections = mission?.fieldConnections;
  if (!fieldConnections) return [];
  const issues = [];
  try {
    assertReadySource(mission);
  } catch {
    return ["field_source_not_ready"];
  }

  if (
    fieldConnections.missionId !== mission.id ||
    fieldConnections.mode !== "local_preparation_only" ||
    fieldConnections.classification !== "implementation_new_reconstruction" ||
    fieldConnections.externalConnections !== false ||
    !sourceMatches(mission, fieldConnections.source)
  ) {
    issues.push("field_identity_invalid");
  }

  const registry = fieldConnections.connectorRegistry;
  const expectedConnectors = expectedConnectorRecords();
  if (
    !registry ||
    registry.kind !== "field_connector_registry" ||
    registry.status !== "materialized_connections_blocked" ||
    !recordsEqual(registry.connectors, expectedConnectors, [
      "sequence",
      "id",
      "category",
      "provider",
      "status",
      "protocol",
      "interactiveConsentRequired",
      "serviceAccountSupported"
    ]) ||
    registry.connectors.some((connector) =>
      Object.hasOwn(connector, "credentials")
    ) ||
    registry.officialReferences?.length !== OFFICIAL_REFERENCE_RECORDS.length ||
    registry.connectionAttempts !== 0 ||
    registry.accountsConnected !== 0 ||
    registry.published !== false ||
    registry.externalConnections !== false
  ) {
    issues.push("field_connector_registry_invalid");
  }

  const oauth = fieldConnections.oauthContract;
  if (oauth && !registry) issues.push("field_oauth_before_registry");
  if (
    oauth &&
    (oauth.kind !== "google_youtube_oauth_contract" ||
      oauth.status !== "prepared_not_configured" ||
      oauth.connectorRegistryId !== registry?.id ||
      oauth.flow !== "browser_token_model" ||
      oauth.authorizationEndpoint !== GOOGLE_AUTHORIZATION_ENDPOINT ||
      oauth.backendRequired !== false ||
      oauth.revocationEndpoint !== GOOGLE_REVOCATION_ENDPOINT ||
      oauth.apiBaseUrl !== YOUTUBE_API_BASE_URL ||
      oauth.serviceAccountSupported !== false ||
      oauth.incrementalAuthorization !== true ||
      !arraysEqual(oauth.scopes?.identity, [YOUTUBE_READONLY_SCOPE]) ||
      !arraysEqual(oauth.scopes?.uploadAfterExplicitAuthorization, [
        YOUTUBE_UPLOAD_SCOPE
      ]) ||
      oauth.security?.clientSecretInBrowserAllowed !== false ||
      oauth.security?.embeddedWebViewAllowed !== false ||
      oauth.security?.authorizedJavascriptOriginRequired !== true ||
      oauth.configuration?.length !== REQUIRED_CONFIGURATION_FIELDS.length ||
      oauth.configuration.some(
        (field, index) =>
          field.id !== REQUIRED_CONFIGURATION_FIELDS[index].id ||
          field.storage !== REQUIRED_CONFIGURATION_FIELDS[index].storage ||
          field.secret !== REQUIRED_CONFIGURATION_FIELDS[index].secret ||
          field.value !== null ||
          field.valueStored !== false
      ) ||
      oauth.tokenStorage?.persistentAccessTokenStorageAllowed !== false ||
      oauth.tokenStorage?.sourceTreeAllowed !== false ||
      oauth.tokenStorage?.chatInputAllowed !== false ||
      oauth.tokenStorage?.tokensStored !== false ||
      oauth.authorizationRequestCreated !== false ||
      oauth.externalConnections !== false)
  ) {
    issues.push("field_oauth_contract_invalid");
  }

  const plan = fieldConnections.channelConnectionPlan;
  const expectedPlans = expectedChannelPlans();
  if (plan && !oauth) issues.push("field_channel_plan_before_oauth");
  if (
    plan &&
    (plan.kind !== "five_distinct_youtube_channel_connection_plan" ||
      plan.status !== "dry_run_prepared_connections_blocked" ||
      plan.oauthContractId !== oauth?.id ||
      !recordsEqual(plan.channels, expectedPlans, [
        "sequence",
        "channelId",
        "channelName",
        "channelStatus",
        "connectionAlias",
        "distinctYouTubeChannelRequired",
        "objective",
        "contentPolicy",
        "monetization",
        "shortsRole",
        "brainIsolationRequired",
        "publishingEnabled",
        "connectionStatus"
      ]) ||
      plan.dryRun?.mode !== "local_contract_validation" ||
      plan.dryRun?.networkRequestCreated !== false ||
      plan.dryRun?.oauthWindowOpened !== false ||
      plan.dryRun?.publish !== false ||
      plan.dryRun?.upload !== false ||
      plan.dryRun?.billing !== false ||
      plan.providerSelection?.music !== "pending_field_decision" ||
      plan.providerSelection?.video !== "pending_field_decision" ||
      plan.externalConnections !== false)
  ) {
    issues.push("field_channel_plan_invalid");
  }

  const handoff = fieldConnections.internalHandoff;
  if (handoff && !plan) issues.push("field_handoff_before_plan");
  const expectedChecks = plan
    ? expectedInternalChecks(mission, fieldConnections)
    : {};
  const expectedSteps = registry ? expectedHandoffSteps(fieldConnections) : [];
  if (
    handoff &&
    (handoff.kind !== "field_connections_internal_handoff" ||
      handoff.status !== "internal_complete_waiting_for_anderson" ||
      handoff.connectorRegistryId !== registry?.id ||
      handoff.oauthContractId !== oauth?.id ||
      handoff.channelConnectionPlanId !== plan?.id ||
      Object.entries(expectedChecks).some(
        ([key, value]) => value !== true || handoff.internalChecks?.[key] !== true
      ) ||
      !recordsEqual(handoff.guidedSteps, expectedSteps, [
        "sequence",
        "id",
        "screen",
        "actionOwner",
        "status",
        "secretInputInChatAllowed",
        "connectorRegistryId"
      ]) ||
      !arraysEqual(handoff.requiredManualEvidence, REQUIRED_MANUAL_EVIDENCE_IDS) ||
      handoff.guidanceMode !== "one_screen_at_a_time_with_screenshots" ||
      handoff.internalWorkExhausted !== true ||
      handoff.point100Started !== false ||
      handoff.connectionAttempts !== 0 ||
      handoff.accountsConnected !== 0 ||
      handoff.realAndroidDeviceTested !== false ||
      handoff.credentialsRequestedInChat !== false ||
      handoff.published !== false ||
      handoff.chargeCreated !== false ||
      handoff.externalConnections !== false)
  ) {
    issues.push("field_internal_handoff_invalid");
  }

  const continuation = expectedContinuation(fieldConnections);
  if (
    Object.entries(continuation).some(
      ([key, value]) => fieldConnections.continuation?.[key] !== value
    )
  ) {
    issues.push("field_continuation_invalid");
  }

  const expectedStatus = handoff
    ? "waiting_for_anderson"
    : plan
      ? "channel_plan_prepared"
      : oauth
        ? "oauth_contract_prepared"
        : "connector_registry_materialized";
  if (fieldConnections.status !== expectedStatus) {
    issues.push("field_status_invalid");
  }
  return [...new Set(issues)];
}

export function inspectFieldConnections(mission) {
  const issues = collectFieldConnectionsIssues(mission);
  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues)
  });
}

function requireFieldConnections(mission) {
  if (!mission?.fieldConnections) {
    throw new FieldConnectionsError(
      "Materialize o catálogo de conectores antes de continuar field-connections."
    );
  }
  const inspection = inspectFieldConnections(mission);
  if (!inspection.valid) {
    throw new FieldConnectionsError(
      `O estado de field-connections é inválido: ${inspection.issues.join(", ")}.`
    );
  }
  return mission.fieldConnections;
}

function updateFieldConnections(fieldConnections, changes, status, now) {
  const candidate = {
    ...fieldConnections,
    ...changes,
    status,
    updatedAt: now.toISOString()
  };
  return Object.freeze({
    ...candidate,
    continuation: Object.freeze(expectedContinuation(candidate))
  });
}

function assertCandidate(mission, fieldConnections) {
  const inspection = inspectFieldConnections({ ...mission, fieldConnections });
  if (!inspection.valid) {
    throw new FieldConnectionsError(
      `A evolução de field-connections é inválida: ${inspection.issues.join(", ")}.`
    );
  }
  return fieldConnections;
}

export function materializeFieldConnectorRegistry({
  mission,
  id = randomUUID(),
  registryId = randomUUID(),
  now = new Date()
}) {
  assertReadySource(mission);
  if (mission.fieldConnections) {
    throw new FieldConnectionsError(
      "A missão já possui um estado de field-connections preservado."
    );
  }
  const timestamp = now.toISOString();
  const connectors = expectedConnectorRecords();
  const connectorRegistry = Object.freeze({
    schemaVersion: 1,
    id: registryId,
    kind: "field_connector_registry",
    status: "materialized_connections_blocked",
    createdAt: timestamp,
    connectors: Object.freeze(connectors.map((connector) => Object.freeze(connector))),
    officialReferences: Object.freeze(
      OFFICIAL_REFERENCE_RECORDS.map((source) => Object.freeze({ ...source }))
    ),
    centralInfrastructure: Object.freeze({
      generation: "new_clean_current_account",
      googleCloudProject: null,
      oauthClients: 0,
      credentialsStored: false,
      tokensStored: false
    }),
    connectionAttempts: 0,
    accountsConnected: 0,
    published: false,
    externalConnections: false
  });
  const fieldConnections = Object.freeze({
    schemaVersion: 1,
    id,
    missionId: mission.id,
    mode: "local_preparation_only",
    classification: "implementation_new_reconstruction",
    externalConnections: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "connector_registry_materialized",
    source: Object.freeze(expectedSource(mission)),
    connectorRegistry,
    continuation: Object.freeze({
      status: "internal_preparation",
      lastCompletedPoint: 96,
      nextPoint: 97,
      nextStage: "field-connections",
      requiresAnderson: false,
      externalConnections: false
    })
  });
  return assertCandidate(mission, fieldConnections);
}

export function prepareGoogleYouTubeOAuthContract({
  mission,
  contractId = randomUUID(),
  now = new Date()
}) {
  const fieldConnections = requireFieldConnections(mission);
  if (fieldConnections.status !== "connector_registry_materialized") {
    throw new FieldConnectionsError(
      "Prepare OAuth somente depois do catálogo de conectores."
    );
  }
  const oauthContract = Object.freeze({
    schemaVersion: 1,
    id: contractId,
    kind: "google_youtube_oauth_contract",
    status: "prepared_not_configured",
    createdAt: now.toISOString(),
    connectorRegistryId: fieldConnections.connectorRegistry.id,
    flow: "browser_token_model",
    authorizationEndpoint: GOOGLE_AUTHORIZATION_ENDPOINT,
    backendRequired: false,
    revocationEndpoint: GOOGLE_REVOCATION_ENDPOINT,
    apiBaseUrl: YOUTUBE_API_BASE_URL,
    serviceAccountSupported: false,
    incrementalAuthorization: true,
    scopes: Object.freeze({
      identity: Object.freeze([YOUTUBE_READONLY_SCOPE]),
      uploadAfterExplicitAuthorization: Object.freeze([YOUTUBE_UPLOAD_SCOPE])
    }),
    security: Object.freeze({
      clientSecretInBrowserAllowed: false,
      embeddedWebViewAllowed: false,
      authorizedJavascriptOriginRequired: true,
      bearerTokenInQueryAllowed: false
    }),
    configuration: Object.freeze(
      REQUIRED_CONFIGURATION_FIELDS.map((field) =>
        Object.freeze({
          ...field,
          value: null,
          valueStored: false,
          sourceTreeAllowed: false
        })
      )
    ),
    tokenStorage: Object.freeze({
      persistentAccessTokenStorageAllowed: false,
      sourceTreeAllowed: false,
      chatInputAllowed: false,
      revocationSupported: true,
      tokensStored: false
    }),
    authorizationRequestCreated: false,
    externalConnections: false
  });
  const updated = updateFieldConnections(
    fieldConnections,
    { oauthContract },
    "oauth_contract_prepared",
    now
  );
  return assertCandidate(mission, updated);
}

export function prepareTwoChannelConnectionPlan({
  mission,
  planId = randomUUID(),
  now = new Date()
}) {
  const fieldConnections = requireFieldConnections(mission);
  if (fieldConnections.status !== "oauth_contract_prepared") {
    throw new FieldConnectionsError(
      "Prepare os cinco canais separados somente depois do contrato OAuth."
    );
  }
  const channels = expectedChannelPlans();
  const channelConnectionPlan = Object.freeze({
    schemaVersion: 2,
    id: planId,
    kind: "five_distinct_youtube_channel_connection_plan",
    status: "dry_run_prepared_connections_blocked",
    createdAt: now.toISOString(),
    oauthContractId: fieldConnections.oauthContract.id,
    projectName: "IA A",
    connectionModel: "five_distinct_youtube_channels_with_independent_links",
    channels: Object.freeze(channels.map((channel) => Object.freeze(channel))),
    providerSelection: Object.freeze({
      music: "pending_field_decision",
      video: "pending_field_decision",
      unknownProviderEndpointsAccepted: false
    }),
    dryRun: Object.freeze({
      mode: "local_contract_validation",
      networkRequestCreated: false,
      oauthWindowOpened: false,
      upload: false,
      publish: false,
      billing: false,
      irreversibleAction: false
    }),
    safety: Object.freeze({
      distinctChannelConnections: true,
      brainsIndependentPerChannel: true,
      shortsPrimaryContent: false,
      dynamicVideoRequired: true,
      mediaRightsRequired: true,
      explicitAuthorizationBeforePublishing: true
    }),
    externalConnections: false
  });
  const updated = updateFieldConnections(
    fieldConnections,
    { channelConnectionPlan },
    "channel_plan_prepared",
    now
  );
  return assertCandidate(mission, updated);
}

export function consolidateInternalFieldHandoff({
  mission,
  handoffId = randomUUID(),
  now = new Date()
}) {
  const fieldConnections = requireFieldConnections(mission);
  if (fieldConnections.status !== "channel_plan_prepared") {
    throw new FieldConnectionsError(
      "Consolide a passagem manual somente depois do plano dos cinco canais separados."
    );
  }
  const internalChecks = expectedInternalChecks(mission, fieldConnections);
  const failedChecks = Object.entries(internalChecks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  if (failedChecks.length > 0) {
    throw new FieldConnectionsError(
      `A preparação interna de field-connections falhou: ${failedChecks.join(", ")}.`
    );
  }
  const guidedSteps = expectedHandoffSteps(fieldConnections);
  const internalHandoff = Object.freeze({
    schemaVersion: 1,
    id: handoffId,
    kind: "field_connections_internal_handoff",
    status: "internal_complete_waiting_for_anderson",
    createdAt: now.toISOString(),
    connectorRegistryId: fieldConnections.connectorRegistry.id,
    oauthContractId: fieldConnections.oauthContract.id,
    channelConnectionPlanId: fieldConnections.channelConnectionPlan.id,
    internalChecks: Object.freeze(internalChecks),
    guidedSteps: Object.freeze(guidedSteps.map((step) => Object.freeze(step))),
    requiredManualEvidence: Object.freeze([...REQUIRED_MANUAL_EVIDENCE_IDS]),
    guidanceMode: "one_screen_at_a_time_with_screenshots",
    internalWorkExhausted: true,
    point100Started: false,
    connectionAttempts: 0,
    accountsConnected: 0,
    realAndroidDeviceTested: false,
    credentialsRequestedInChat: false,
    published: false,
    chargeCreated: false,
    externalConnections: false
  });
  const updated = updateFieldConnections(
    fieldConnections,
    { internalHandoff },
    "waiting_for_anderson",
    now
  );
  return assertCandidate(mission, updated);
}

export function validateFieldCompletionEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return Object.freeze({
      valid: false,
      missing: Object.freeze([...REQUIRED_MANUAL_EVIDENCE_IDS])
    });
  }
  const missing = REQUIRED_MANUAL_EVIDENCE_IDS.filter(
    (id) => evidence[id] !== true
  );
  return Object.freeze({
    valid: missing.length === 0,
    missing: Object.freeze(missing)
  });
}

