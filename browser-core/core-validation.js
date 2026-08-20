import { assessBrainAssignmentCompatibility } from "./brains.js";
import { findPilotChannel } from "./channels.js";
import { MISSION_STATUSES } from "./mission.js";
import { getProjectLocalPermissionMode } from "./project.js";
import { inspectScenePackage } from "./scene-package.js";
import { inspectTextPackage } from "./text-package.js";
import { inspectValidationSafety } from "./validation-safety.js";
import { inspectAuditCheckpoints } from "./audit-checkpoints.js";
import { inspectAndroidExperience } from "./android-experience.js";
import { inspectFieldConnections } from "./field-connections.js";

const PROJECT_STATUSES = Object.freeze(["active", "archived"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function addIssue(issues, code, entityType, entityId = null) {
  issues.push(Object.freeze({ code, entityType, entityId }));
}

function validateProject(project, issues) {
  const id = isNonEmptyString(project?.id) ? project.id : null;

  if (!id) {
    addIssue(issues, "project_id_invalid", "project");
  }
  if (!isNonEmptyString(project?.name)) {
    addIssue(issues, "project_name_invalid", "project", id);
  }
  if (!PROJECT_STATUSES.includes(project?.status)) {
    addIssue(issues, "project_status_invalid", "project", id);
  }

  try {
    getProjectLocalPermissionMode(project);
  } catch {
    addIssue(issues, "project_permissions_invalid", "project", id);
  }
}

function validateStrategyBriefing(mission, issues, missionId) {
  const briefing = mission?.strategyBriefing;
  if (!briefing) {
    return;
  }

  if (
    briefing.missionId !== missionId ||
    briefing.mode !== "local_planning_only" ||
    briefing.externalConnections !== false ||
    briefing.channel?.id !== mission.channel?.id ||
    briefing.brainContext?.brainId !== mission.brain?.id ||
    briefing.brainContext?.profileVersion !== mission.brain?.profileVersion ||
    briefing.brainContext?.channelId !== mission.channel?.id ||
    briefing.funnel?.expectedViewsRange?.classification !==
      "unvalidated_hypothesis" ||
    briefing.funnel?.expectedViewsRange?.guaranteed !== false ||
    briefing.outcomePolicy?.guaranteeAllowed !== false
  ) {
    addIssue(
      issues,
      "mission_strategy_briefing_mismatch",
      "mission",
      missionId
    );
  }
}

function validateRetentionPlan(mission, issues, missionId) {
  const plan = mission?.retentionPlan;
  if (!plan) {
    return;
  }

  if (
    !mission.strategyBriefing ||
    plan.missionId !== missionId ||
    plan.briefingId !== mission.strategyBriefing.id ||
    plan.mode !== "local_planning_only" ||
    plan.externalConnections !== false ||
    plan.brain?.id !== mission.brain?.id ||
    plan.brain?.profileVersion !== mission.brain?.profileVersion ||
    plan.brain?.channelId !== mission.channel?.id ||
    plan.format !== mission.strategyBriefing.constraints?.format ||
    !Array.isArray(plan.stages) ||
    plan.stages.length !== 4 ||
    plan.measurement?.guaranteed !== false ||
    plan.hypothesis?.classification !== "unvalidated_hypothesis" ||
    plan.hypothesis?.status !== "pending_validation"
  ) {
    addIssue(issues, "mission_retention_plan_mismatch", "mission", missionId);
  }
}

function validateStrategicPackageSteps(mission, issues, missionId) {
  const briefing = mission?.strategyBriefing;
  const retention = mission?.retentionPlan;
  const click = mission?.clickStrategy;
  const description = mission?.descriptionStrategy;
  const window = mission?.publishingWindowStrategy;
  const validation = mission?.strategyValidation;
  const strategyPackage = mission?.strategyPackage;

  if (
    click &&
    (!briefing ||
      !retention ||
      click.missionId !== missionId ||
      click.briefingId !== briefing.id ||
      click.retentionPlanId !== retention.id ||
      click.mode !== "local_planning_only" ||
      click.externalConnections !== false ||
      !isNonEmptyString(click.title) ||
      click.alignment?.deceptive !== false ||
      click.clickMeasurement?.classification !== "unvalidated_hypothesis" ||
      click.clickMeasurement?.guaranteed !== false)
  ) {
    addIssue(issues, "mission_click_strategy_mismatch", "mission", missionId);
  }

  if (
    description &&
    (!briefing ||
      !click ||
      description.missionId !== missionId ||
      description.briefingId !== briefing.id ||
      description.clickStrategyId !== click.id ||
      description.externalConnections !== false ||
      !isNonEmptyString(description.description) ||
      description.contentAlignment?.unsupportedClaimsAllowed !== false ||
      description.outcomePolicy?.guaranteeAllowed !== false)
  ) {
    addIssue(
      issues,
      "mission_description_strategy_mismatch",
      "mission",
      missionId
    );
  }

  if (
    window &&
    (!briefing ||
      !description ||
      window.missionId !== missionId ||
      window.briefingId !== briefing.id ||
      window.descriptionStrategyId !== description.id ||
      window.externalConnections !== false ||
      window.hypothesis?.classification !== "unvalidated_hypothesis" ||
      window.hypothesis?.status !== "pending_real_channel_data" ||
      window.hypothesis?.guaranteed !== false ||
      window.execution?.publishesContent !== false ||
      window.execution?.connectsAccount !== false)
  ) {
    addIssue(
      issues,
      "mission_publishing_window_mismatch",
      "mission",
      missionId
    );
  }

  if (
    validation &&
    (!briefing ||
      !retention ||
      !click ||
      !description ||
      !window ||
      validation.missionId !== missionId ||
      validation.externalConnections !== false ||
      validation.valid !== true ||
      validation.status !== "valid" ||
      !Array.isArray(validation.issues) ||
      validation.issues.length !== 0)
  ) {
    addIssue(
      issues,
      "mission_strategy_validation_mismatch",
      "mission",
      missionId
    );
  }

  const componentIds = strategyPackage?.componentIds;
  if (
    strategyPackage &&
    (!validation ||
      strategyPackage.missionId !== missionId ||
      strategyPackage.status !== "strategic_package_closed" ||
      strategyPackage.externalConnections !== false ||
      componentIds?.briefingId !== briefing?.id ||
      componentIds?.retentionPlanId !== retention?.id ||
      componentIds?.clickStrategyId !== click?.id ||
      componentIds?.descriptionStrategyId !== description?.id ||
      componentIds?.publishingWindowStrategyId !== window?.id ||
      componentIds?.validationId !== validation.id ||
      strategyPackage.safety?.deceptiveTitleAllowed !== false ||
      strategyPackage.safety?.guaranteedClicks !== false ||
      strategyPackage.safety?.guaranteedOutcome !== false ||
      strategyPackage.safety?.publishesContent !== false ||
      strategyPackage.safety?.connectsAccount !== false ||
      strategyPackage.safety?.requestsCredentials !== false ||
      strategyPackage.safety?.createsCharge !== false)
  ) {
    addIssue(
      issues,
      "mission_strategy_package_mismatch",
      "mission",
      missionId
    );
  }
}

function validateTextPackage(mission, issues, missionId) {
  if (!mission?.textPackage) {
    return;
  }
  const inspection = inspectTextPackage(mission);
  if (!inspection.valid) {
    addIssue(issues, "mission_text_package_mismatch", "mission", missionId);
  }
}

function validateScenePackage(mission, issues, missionId) {
  if (!mission?.scenePackage) {
    return;
  }
  const inspection = inspectScenePackage(mission);
  if (!inspection.valid) {
    addIssue(issues, "mission_scene_package_mismatch", "mission", missionId);
  }
}

function validateValidationSafety(mission, issues, missionId) {
  if (!mission?.validationSafety) {
    return;
  }
  const inspection = inspectValidationSafety(mission);
  if (!inspection.valid) {
    addIssue(issues, "mission_validation_safety_mismatch", "mission", missionId);
  }
}

function validateAuditCheckpoints(mission, issues, missionId) {
  if (!mission?.auditCheckpoints) {
    return;
  }
  const inspection = inspectAuditCheckpoints(mission);
  if (!inspection.valid) {
    addIssue(issues, "mission_audit_checkpoints_mismatch", "mission", missionId);
  }
}

function validateAndroidExperience(mission, issues, missionId) {
  if (!mission?.androidExperience) {
    return;
  }
  const inspection = inspectAndroidExperience(mission);
  if (!inspection.valid) {
    addIssue(issues, "mission_android_experience_mismatch", "mission", missionId);
  }
}

function validateFieldConnections(mission, issues, missionId) {
  if (!mission?.fieldConnections) {
    return;
  }
  const inspection = inspectFieldConnections(mission);
  if (!inspection.valid) {
    addIssue(issues, "mission_field_connections_mismatch", "mission", missionId);
  }
}

function validateMission(mission, projectsById, issues, counts) {
  const id = isNonEmptyString(mission?.id) ? mission.id : null;

  if (!id) {
    addIssue(issues, "mission_id_invalid", "mission");
  }
  if (!isNonEmptyString(mission?.title)) {
    addIssue(issues, "mission_title_invalid", "mission", id);
  }

  const channel = findPilotChannel(mission?.channel?.id);
  if (!channel || mission.channel?.name !== channel.name) {
    addIssue(issues, "mission_channel_invalid", "mission", id);
  }
  if (!MISSION_STATUSES.includes(mission?.status)) {
    addIssue(issues, "mission_status_invalid", "mission", id);
  }

  if (!mission?.project) {
    counts.legacyUnlinkedMissions += 1;
  } else if (!isNonEmptyString(mission.project.id)) {
    addIssue(issues, "mission_project_link_invalid", "mission", id);
  } else {
    counts.linkedMissions += 1;
    const project = projectsById.get(mission.project.id);
    if (!project) {
      addIssue(issues, "mission_project_orphaned", "mission", id);
    } else if (mission.project.name !== project.name) {
      addIssue(issues, "mission_project_name_mismatch", "mission", id);
    }
  }

  if (!mission?.brain) {
    counts.legacyMissionsWithoutBrain += 1;
    validateStrategyBriefing(mission, issues, id);
    validateRetentionPlan(mission, issues, id);
    validateStrategicPackageSteps(mission, issues, id);
    validateTextPackage(mission, issues, id);
    validateScenePackage(mission, issues, id);
    validateValidationSafety(mission, issues, id);
    validateAuditCheckpoints(mission, issues, id);
    validateAndroidExperience(mission, issues, id);
    validateFieldConnections(mission, issues, id);
    return;
  }

  counts.assignedBrains += 1;
  const compatibility = assessBrainAssignmentCompatibility({
    assignment: mission.brain,
    channelId: mission.channel?.id
  });
  if (!compatibility.compatible) {
    addIssue(issues, "mission_brain_mismatch", "mission", id);
  }
  validateStrategyBriefing(mission, issues, id);
  validateRetentionPlan(mission, issues, id);
  validateStrategicPackageSteps(mission, issues, id);
  validateTextPackage(mission, issues, id);
  validateScenePackage(mission, issues, id);
  validateValidationSafety(mission, issues, id);
  validateAuditCheckpoints(mission, issues, id);
  validateAndroidExperience(mission, issues, id);
  validateFieldConnections(mission, issues, id);
}

export function validateProjectMissionCore({ projects, missions }) {
  if (!Array.isArray(projects) || !Array.isArray(missions)) {
    throw new TypeError("Projetos e missões devem ser listas.");
  }

  const issues = [];
  const projectsById = new Map();
  const missionIds = new Set();
  const counts = {
    projects: projects.length,
    missions: missions.length,
    linkedMissions: 0,
    legacyUnlinkedMissions: 0,
    assignedBrains: 0,
    legacyMissionsWithoutBrain: 0,
    issues: 0
  };

  for (const project of projects) {
    validateProject(project, issues);
    if (isNonEmptyString(project?.id)) {
      if (projectsById.has(project.id)) {
        addIssue(issues, "project_id_duplicate", "project", project.id);
      } else {
        projectsById.set(project.id, project);
      }
    }
  }

  for (const mission of missions) {
    if (isNonEmptyString(mission?.id)) {
      if (missionIds.has(mission.id)) {
        addIssue(issues, "mission_id_duplicate", "mission", mission.id);
      } else {
        missionIds.add(mission.id);
      }
    }
    validateMission(mission, projectsById, issues, counts);
  }

  counts.issues = issues.length;
  return Object.freeze({
    valid: issues.length === 0,
    status: issues.length === 0 ? "valid" : "invalid",
    mode: "local_read_only",
    counts: Object.freeze({ ...counts }),
    issues: Object.freeze(issues)
  });
}
