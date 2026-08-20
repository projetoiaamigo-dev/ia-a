import { PILOT_CHANNELS } from "./browser-core/channels.js";
import {
  assessBrainChannelCompatibility,
  listChannelBrains,
  listChannelBrainVersions
} from "./browser-core/brains.js";
import { validateBrainCoreCatalog } from "./browser-core/brain-core.js";
import { validateProjectMissionCore } from "./browser-core/core-validation.js";
import {
  applyClickStrategy,
  applyDescriptionStrategy,
  applyMissionMobileErgonomicsContract,
  applyMissionTextClosing,
  applyMissionTextOpening,
  applyMissionTextProgression,
  applyMissionTextReengagement,
  applyPublishingWindowStrategy,
  applyRetentionPlan,
  applyStrategyValidation,
  applyStrategyBriefing,
  changeMissionStatus,
  closeMissionAuditCheckpoints,
  closeMissionAndroidExperience,
  closeMissionScenePackage,
  closeMissionValidationSafety,
  closeMissionTextPackage,
  closeMissionStrategyPackage,
  consolidateMissionInternalFieldHandoff,
  consolidateMissionAuditReadinessReport,
  consolidateMissionFinalTextScript,
  consolidateMissionValidationSafetyReport,
  createMissionCaptionPlan,
  createMissionDynamicVisualMap,
  createMissionSceneDurationPlan,
  createMissionRenderPreparationPlan,
  createMission,
  evaluateMissionRightsReadiness,
  materializeMissionMediaRequirements,
  materializeMissionAndroidCapabilityProfile,
  materializeMissionFieldConnectorRegistry,
  materializeMissionAuditLedger,
  materializeMissionCheckpointPolicy,
  materializeMissionQualityCriteriaMatrix,
  materializeMissionRightsInventory,
  materializeMissionSceneMotionPlan,
  materializeMissionSceneUnits,
  materializeMissionSafeExportManifest,
  materializeMissionStructuralExportBundle,
  materializeMissionTextDescription,
  materializeMissionTextTitle,
  materializeMissionTextTransitionMap,
  materializeMissionNarration,
  materializeMissionValidationSafetyEnforcementPolicy,
  openMissionScenePackage,
  openMissionTextPackage,
  prepareMissionOfflineInstallability,
  prepareMissionGoogleYouTubeOAuthContract,
  prepareMissionTwoChannelConnectionPlan,
  registerMissionTextSafetyOrigins,
  resumeMission,
  sealMissionStructuralExportIntegrity,
  sealMissionValidationSafetyIntegrity,
  structureMissionSceneStoryboard,
  structureMissionAudioLayers,
  structureMissionCompositionTimeline,
  structureMissionTextScript,
  synchronizeMissionSceneStructure,
  updateMissionDetails,
  validateMissionCompleteTextPackage,
  validateMissionCompleteTextScript,
  validateMissionCompleteValidationSafety,
  validateMissionAuditTrail,
  validateMissionCompleteAuditCheckpoints,
  validateMissionCompleteAndroidExperience,
  validateMissionContentSafety,
  validateMissionIntegratedScenePlan,
  validateMissionOperationalLocks,
  verifyMissionStructuralExportRestore
} from "./browser-core/mission.js";
import {
  applyProjectLocalPermissions,
  archiveProject,
  assertProjectWritable,
  createProject
} from "./browser-core/project.js";
import { getSoftwareProgress } from "./browser-core/software-progress.js";

const nativeFetch = window.fetch.bind(window);
const KEY = "ia_a_chrome_runtime_v1";
const STATE_SCHEMA = 2;

if (!Array.prototype.toReversed) {
  Object.defineProperty(Array.prototype, "toReversed", { value() { return [...this].reverse(); }, configurable: true });
}
if (!Array.prototype.toSorted) {
  Object.defineProperty(Array.prototype, "toSorted", { value(compareFn) { return [...this].sort(compareFn); }, configurable: true });
}

function nowIso() { return new Date().toISOString(); }
function initialState() { return { schemaVersion: STATE_SCHEMA, projects: [], missions: [] }; }
function clone(value) { return structuredClone(value); }

function normalizeProject(project) {
  const createdAt = project?.createdAt || nowIso();
  return {
    schemaVersion: Math.max(Number(project?.schemaVersion) || 1, 2),
    id: project?.id,
    name: String(project?.name || "PROJETO IA A"),
    status: project?.status === "archived" ? "archived" : "active",
    localPermissions: { mode: project?.localPermissions?.mode === "read_only" ? "read_only" : "read_write" },
    createdAt,
    updatedAt: project?.updatedAt || createdAt,
    history: Array.isArray(project?.history) && project.history.length ? project.history : [{ type: "project.created", at: createdAt, name: String(project?.name || "PROJETO IA A") }]
  };
}

function normalizeMission(mission, projects) {
  const createdAt = mission?.createdAt || nowIso();
  const project = mission?.project || projects.find((p) => p.id === mission?.projectId) || undefined;
  let base;
  try {
    base = createMission({
      id: mission?.id,
      title: String(mission?.title || "Missão preservada"),
      channelId: mission?.channel?.id || "fale-com-deus",
      project,
      now: new Date(createdAt)
    });
  } catch {
    return mission;
  }
  const validStatuses = new Set(["draft", "in_progress", "paused", "completed"]);
  return {
    ...base,
    ...mission,
    schemaVersion: Math.max(Number(mission?.schemaVersion) || 1, base.schemaVersion),
    brain: mission?.brain || base.brain,
    project: project ? { id: project.id, name: project.name } : mission?.project,
    status: validStatuses.has(mission?.status) ? mission.status : "draft",
    createdAt,
    updatedAt: mission?.updatedAt || createdAt,
    history: Array.isArray(mission?.history) && mission.history.length ? mission.history : base.history
  };
}

function readState() {
  let parsed;
  try { parsed = JSON.parse(localStorage.getItem(KEY)); } catch { parsed = null; }
  if (!parsed || !Array.isArray(parsed.projects) || !Array.isArray(parsed.missions)) return initialState();
  const projects = parsed.projects.map(normalizeProject);
  const missions = parsed.missions.map((m) => normalizeMission(m, projects));
  const state = { schemaVersion: STATE_SCHEMA, projects, missions };
  if (parsed.schemaVersion !== STATE_SCHEMA) writeState(state);
  return state;
}
function writeState(state) { localStorage.setItem(KEY, JSON.stringify({ ...state, schemaVersion: STATE_SCHEMA })); }
function parseBody(init) {
  if (!init?.body) return {};
  try { return JSON.parse(init.body); } catch { throw new Error("Os dados enviados são inválidos."); }
}
function json(data, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }));
}
function findProject(state, id) { return state.projects.find((p) => p.id === id) || null; }
function findMission(state, id) { return state.missions.find((m) => m.id === id) || null; }
function replaceProject(state, project) { state.projects[state.projects.findIndex((p) => p.id === project.id)] = clone(project); writeState(state); }
function replaceMission(state, mission) { state.missions[state.missions.findIndex((m) => m.id === mission.id)] = clone(mission); writeState(state); }
function assertMissionProjectWritable(state, mission) {
  if (!mission?.project?.id) return;
  const project = findProject(state, mission.project.id);
  if (project) assertProjectWritable(project);
}

const groupedSteps = {
  "scene-package": {
    "": [openMissionScenePackage, null],
    "storyboard": [structureMissionSceneStoryboard, "storyboard"],
    "narration": [materializeMissionNarration, "narrationAsset"],
    "captions": [createMissionCaptionPlan, "captionPlan"],
    "visual-map": [createMissionDynamicVisualMap, "visualMap"],
    "units": [materializeMissionSceneUnits, "sceneUnitPlan"],
    "duration-plan": [createMissionSceneDurationPlan, "durationPlan"],
    "synchronization": [synchronizeMissionSceneStructure, "synchronizationPlan"],
    "motion-transitions": [materializeMissionSceneMotionPlan, "motionPlan"],
    "integrated-plan": [validateMissionIntegratedScenePlan, "integratedExecutionPlan"],
    "media-requirements": [materializeMissionMediaRequirements, "mediaRequirementsPlan"],
    "audio-layers": [structureMissionAudioLayers, "audioLayerPlan"],
    "composition": [structureMissionCompositionTimeline, "compositionPlan"],
    "render-plan": [createMissionRenderPreparationPlan, "renderPlan"],
    "close": [closeMissionScenePackage, "closure"]
  },
  "validation-safety": {
    "quality-matrix": [materializeMissionQualityCriteriaMatrix, "qualityCriteriaMatrix"],
    "rights-inventory": [materializeMissionRightsInventory, "rightsInventory"],
    "content-safety": [validateMissionContentSafety, "contentSafetyValidation"],
    "operational-locks": [validateMissionOperationalLocks, "operationalLocks"],
    "integrated-report": [consolidateMissionValidationSafetyReport, "integratedReport"],
    "integrity-snapshot": [sealMissionValidationSafetyIntegrity, "integritySnapshot"],
    "rights-readiness": [evaluateMissionRightsReadiness, "rightsReadinessGate"],
    "enforcement-policy": [materializeMissionValidationSafetyEnforcementPolicy, "enforcementPolicy"],
    "complete-validation": [validateMissionCompleteValidationSafety, "completeValidation"],
    "close": [closeMissionValidationSafety, "closure"]
  },
  "audit-checkpoints": {
    "ledger": [materializeMissionAuditLedger, "auditLedger"],
    "checkpoint-policy": [materializeMissionCheckpointPolicy, "checkpointPolicy"],
    "safe-export-manifest": [materializeMissionSafeExportManifest, "exportManifest"],
    "validate": [validateMissionAuditTrail, "trailValidation"],
    "readiness-report": [consolidateMissionAuditReadinessReport, "readinessReport"],
    "structural-export": [materializeMissionStructuralExportBundle, "structuralExportBundle"],
    "export-integrity": [sealMissionStructuralExportIntegrity, "exportIntegritySeal"],
    "restore-verification": [verifyMissionStructuralExportRestore, "restoreVerification"],
    "complete-validation": [validateMissionCompleteAuditCheckpoints, "completeValidation"],
    "close": [closeMissionAuditCheckpoints, "closure"]
  },
  "android-experience": {
    "capability-profile": [materializeMissionAndroidCapabilityProfile, "capabilityProfile"],
    "ergonomics": [applyMissionMobileErgonomicsContract, "ergonomicsContract"],
    "offline-installability": [prepareMissionOfflineInstallability, "installabilityPackage"],
    "validate": [validateMissionCompleteAndroidExperience, "completeValidation"],
    "close": [closeMissionAndroidExperience, "closure"]
  },
  "field-connections": {
    "registry": [materializeMissionFieldConnectorRegistry, "connectorRegistry"],
    "oauth-contract": [prepareMissionGoogleYouTubeOAuthContract, "oauthContract"],
    "channel-plan": [prepareMissionTwoChannelConnectionPlan, "channelConnectionPlan"],
    "internal-handoff": [consolidateMissionInternalFieldHandoff, "internalHandoff"]
  }
};

async function apiFetch(url, method, init) {
  const state = readState();

  if (method === "GET" && url.pathname === "/api/health") return json({ status: "ok", mode: "chrome-local", runtimeVersion: "v009-shared-official-youtube-five-brains", externalConnections: false });
  if (method === "GET" && url.pathname === "/api/channels") return json({ channels: PILOT_CHANNELS.map(({ id, name }) => ({ id, name })) });
  if (method === "GET" && url.pathname === "/api/brains") return json({ brains: listChannelBrains(), researchMode: "official_owner_base_with_own_channel_field_learning", externalConnections: false });
  if (method === "GET" && url.pathname === "/api/brains/versions") {
    const channelId = url.searchParams.get("channelId");
    const versions = listChannelBrainVersions(channelId);
    if (!versions.length) return json({ error: "Informe um canal piloto com versões de cérebro preservadas." }, 400);
    return json({ channelId, versions, externalConnections: false });
  }
  if (method === "GET" && url.pathname === "/api/brains/validation") return json(validateBrainCoreCatalog());
  if (method === "GET" && url.pathname === "/api/brains/compatibility") {
    const brainId = url.searchParams.get("brainId");
    const channelId = url.searchParams.get("channelId");
    const raw = url.searchParams.get("profileVersion");
    const profileVersion = Number(raw);
    if (!brainId || !channelId || !raw || !Number.isInteger(profileVersion)) return json({ error: "Informe cérebro, versão e canal para validar a compatibilidade." }, 400);
    return json(assessBrainChannelCompatibility({ brainId, profileVersion, channelId }));
  }
  if (method === "GET" && url.pathname === "/api/core/validation") return json(validateProjectMissionCore({ projects: state.projects, missions: state.missions }));
  if (method === "GET" && url.pathname === "/api/progress") return json(getSoftwareProgress());

  if (method === "GET" && url.pathname === "/api/projects") return json({ projects: state.projects.toReversed() });
  if (method === "POST" && url.pathname === "/api/projects") {
    const project = createProject(parseBody(init)); state.projects.push(clone(project)); writeState(state); return json({ project }, 201);
  }
  let match = url.pathname.match(/^\/api\/projects\/([^/]+)\/memory$/);
  if (method === "GET" && match) {
    const project = findProject(state, match[1]); if (!project) return json({ error: "Projeto não encontrado." }, 404);
    return json({ project, missions: state.missions.filter((m) => m.project?.id === project.id).toReversed() });
  }
  match = url.pathname.match(/^\/api\/projects\/([^/]+)\/permissions$/);
  if (method === "PATCH" && match) {
    const project = findProject(state, match[1]); if (!project) return json({ error: "Projeto não encontrado." }, 404);
    const updated = applyProjectLocalPermissions({ project, mode: parseBody(init).mode }); replaceProject(state, updated); return json({ project: updated });
  }
  match = url.pathname.match(/^\/api\/projects\/([^/]+)\/archive$/);
  if (method === "POST" && match) {
    const project = findProject(state, match[1]); if (!project) return json({ error: "Projeto não encontrado." }, 404);
    assertProjectWritable(project); const updated = archiveProject({ project }); replaceProject(state, updated); return json({ project: updated });
  }
  match = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (method === "GET" && match) { const project = findProject(state, match[1]); return project ? json({ project }) : json({ error: "Projeto não encontrado." }, 404); }

  if (method === "GET" && url.pathname === "/api/missions") return json({ missions: state.missions.toReversed() });
  if (method === "POST" && url.pathname === "/api/missions") {
    const body = parseBody(init);
    let project;
    if (Object.hasOwn(body, "projectId")) {
      if (typeof body.projectId !== "string" || !body.projectId.trim()) throw new Error("Escolha um projeto preservado.");
      project = findProject(state, body.projectId);
      if (!project) throw new Error("O projeto informado não existe.");
      if (project.status !== "active") throw new Error("O projeto informado está arquivado.");
      assertProjectWritable(project);
    }
    const mission = createMission({ title: body.title, channelId: body.channelId, project });
    state.missions.push(clone(mission)); writeState(state); return json({ mission }, 201);
  }

  match = url.pathname.match(/^\/api\/missions\/([^/]+)\/resume$/);
  if (method === "POST" && match) {
    const mission = findMission(state, match[1]); if (!mission) return json({ error: "Missão não encontrada." }, 404);
    assertMissionProjectWritable(state, mission); const updated = resumeMission({ mission }); replaceMission(state, updated); return json({ mission: updated });
  }
  match = url.pathname.match(/^\/api\/missions\/([^/]+)\/status$/);
  if (method === "PATCH" && match) {
    const mission = findMission(state, match[1]); if (!mission) return json({ error: "Missão não encontrada." }, 404);
    assertMissionProjectWritable(state, mission); const updated = changeMissionStatus({ mission, status: parseBody(init).status }); replaceMission(state, updated); return json({ mission: updated });
  }

  const strategyRoutes = [
    ["strategy-briefing", (mission, body) => applyStrategyBriefing({ mission, theme: body.theme, objective: body.objective, audience: body.audience, format: body.format, funnel: body.funnel }), "briefing", "strategyBriefing"],
    ["retention-plan", (mission) => applyRetentionPlan({ mission }), "retentionPlan", "retentionPlan"],
    ["click-strategy", (mission, body) => applyClickStrategy({ mission, title: body.title }), "clickStrategy", "clickStrategy"],
    ["description-strategy", (mission, body) => applyDescriptionStrategy({ mission, description: body.description }), "descriptionStrategy", "descriptionStrategy"],
    ["publishing-window-strategy", (mission, body) => applyPublishingWindowStrategy({ mission, timeZone: body.timeZone, daysOfWeek: body.daysOfWeek, startLocalTime: body.startLocalTime, endLocalTime: body.endLocalTime, rationale: body.rationale }), "publishingWindowStrategy", "publishingWindowStrategy"],
    ["strategy-validation", (mission) => applyStrategyValidation({ mission }), "strategyValidation", "strategyValidation"],
    ["strategy-package", (mission) => closeMissionStrategyPackage({ mission }), "strategyPackage", "strategyPackage"]
  ];
  for (const [suffix, apply, responseKey, missionKey] of strategyRoutes) {
    match = url.pathname.match(new RegExp(`^/api/missions/([^/]+)/${suffix}$`));
    if (method === "POST" && match) {
      const mission = findMission(state, match[1]); if (!mission) return json({ error: "Missão não encontrada." }, 404);
      assertMissionProjectWritable(state, mission); const updated = apply(mission, parseBody(init)); replaceMission(state, updated);
      return json({ mission: updated, [responseKey]: updated[missionKey] });
    }
  }

  const textSimple = {
    "": [openMissionTextPackage, null],
    "title": [materializeMissionTextTitle, "titleAsset"],
    "description": [materializeMissionTextDescription, "descriptionAsset"],
    "script": [structureMissionTextScript, "script"],
    "validate": [validateMissionCompleteTextScript, "script"],
    "final-script": [consolidateMissionFinalTextScript, "finalScriptAsset"],
    "transitions": [materializeMissionTextTransitionMap, "transitionMapAsset"],
    "safety-origins": [registerMissionTextSafetyOrigins, "safetyOriginRegistry"],
    "complete-validation": [validateMissionCompleteTextPackage, "packageValidation"],
    "close": [closeMissionTextPackage, "closure"]
  };
  match = url.pathname.match(/^\/api\/missions\/([^/]+)\/text-package(?:\/([^/]+))?$/);
  if (method === "POST" && match) {
    const mission = findMission(state, match[1]); if (!mission) return json({ error: "Missão não encontrada." }, 404);
    assertMissionProjectWritable(state, mission);
    const suffix = match[2] || "";
    let updated;
    if (["opening", "progression", "reengagement", "closing"].includes(suffix)) {
      const body = parseBody(init);
      const apply = { opening: applyMissionTextOpening, progression: applyMissionTextProgression, reengagement: applyMissionTextReengagement, closing: applyMissionTextClosing }[suffix];
      updated = apply({ mission, text: body.text });
    } else {
      const spec = textSimple[suffix]; if (!spec) return json({ error: "Rota local não disponível." }, 404);
      updated = spec[0]({ mission });
    }
    replaceMission(state, updated); return json({ mission: updated, textPackage: updated.textPackage });
  }

  match = url.pathname.match(/^\/api\/missions\/([^/]+)\/(scene-package|validation-safety|audit-checkpoints|android-experience|field-connections)(?:\/([^/]+))?$/);
  if (method === "POST" && match) {
    const mission = findMission(state, match[1]); if (!mission) return json({ error: "Missão não encontrada." }, 404);
    assertMissionProjectWritable(state, mission);
    const group = match[2], suffix = match[3] || "";
    const spec = groupedSteps[group]?.[suffix]; if (!spec) return json({ error: "Rota local não disponível." }, 404);
    const updated = spec[0]({ mission }); replaceMission(state, updated);
    const groupProperty = { "scene-package":"scenePackage", "validation-safety":"validationSafety", "audit-checkpoints":"auditCheckpoints", "android-experience":"androidExperience", "field-connections":"fieldConnections" }[group];
    return json({ mission: updated, [groupProperty]: updated[groupProperty], asset: spec[1] ? updated[groupProperty]?.[spec[1]] : updated[groupProperty] });
  }

  match = url.pathname.match(/^\/api\/missions\/([^/]+)$/);
  if (match) {
    const mission = findMission(state, match[1]); if (!mission) return json({ error: "Missão não encontrada." }, 404);
    if (method === "GET") return json({ mission });
    if (method === "PATCH") {
      assertMissionProjectWritable(state, mission); const body = parseBody(init);
      let project = mission.project;
      if (Object.hasOwn(body, "projectId")) {
        project = findProject(state, body.projectId); if (!project) throw new Error("O projeto informado não existe.");
        if (project.status !== "active") throw new Error("O projeto informado está arquivado."); assertProjectWritable(project);
      }
      const updated = updateMissionDetails({ mission, title: Object.hasOwn(body,"title") ? body.title : mission.title, channelId: Object.hasOwn(body,"channelId") ? body.channelId : mission.channel?.id, project, brainProfileVersion: Object.hasOwn(body,"brainProfileVersion") ? body.brainProfileVersion : undefined });
      replaceMission(state, updated); return json({ mission: updated });
    }
  }

  return json({ error: "Rota local não disponível no modo Chrome." }, 404);
}

window.fetch = async function(input, init = {}) {
  const raw = typeof input === "string" ? input : input.url;
  let url;
  try { url = new URL(raw, location.href); } catch { return nativeFetch(input, init); }
  if (!url.pathname.startsWith("/api/")) return nativeFetch(input, init);
  if (url.pathname.startsWith("/api/oauth/")) return nativeFetch(input, init);
  const method = (init.method || (typeof input !== "string" && input.method) || "GET").toUpperCase();
  try { return await apiFetch(url, method, init); }
  catch (error) { return json({ error: error?.message || "Falha no núcleo local." }, 400); }
};

window.IAAChromeRuntime = Object.freeze({
  version: "v009-shared-official-youtube-five-brains",
  mode: "chrome-local-core",
  stateSchemaVersion: STATE_SCHEMA,
  reset() { localStorage.removeItem(KEY); location.reload(); },
  createStarterProject(name = "PROJETO IA A") {
    const state = readState();
    const active = state.projects.find((p) => p.status === "active");
    if (active) return active;
    const project = createProject({ name }); state.projects.push(clone(project)); writeState(state); location.reload(); return project;
  },
  diagnostics() {
    const state = readState();
    return { runtimeVersion: "v009-shared-official-youtube-five-brains", stateSchemaVersion: STATE_SCHEMA, projects: state.projects.length, missions: state.missions.length, core: validateProjectMissionCore({ projects: state.projects, missions: state.missions }) };
  }
});
