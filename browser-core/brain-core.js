import {
  BRAIN_PROFILE_HISTORY,
  assessBrainAssignmentCompatibility,
  findChannelBrain,
  listChannelBrainVersions,
  listChannelBrains
} from "./brains.js";
import { PROJECT_CHANNELS } from "./channels.js";
import { REFERENCE_CLASSIFICATIONS } from "./brain-references.js";

export class BrainCoreValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "BrainCoreValidationError";
  }
}

function addIssue(issues, code, channelId = null, brainId = null) {
  issues.push(Object.freeze({ code, channelId, brainId }));
}

function isVerifiedResearchStatus(status) {
  return status === "verified" || status === "owner_verified";
}

function isValidReferenceSource(source) {
  if (!source || !Array.isArray(source.facts) || source.facts.length === 0) return false;

  if (source.type === REFERENCE_CLASSIFICATIONS.ownerSpecification) {
    return (
      typeof source.providedBy === "string" &&
      source.providedBy.trim().length > 0 &&
      source.facts.every(
        (fact) =>
          fact.classification === REFERENCE_CLASSIFICATIONS.ownerDefinedFact
      )
    );
  }

  return (
    typeof source.url === "string" &&
    source.url.startsWith("https://") &&
    source.facts.every(
      (fact) => fact.classification === REFERENCE_CLASSIFICATIONS.verifiedFact
    )
  );
}

function validateCurrentProfile(profile, issues) {
  const sourceIds = new Set(profile.referenceSources.map((source) => source.id));

  if (!isVerifiedResearchStatus(profile.referenceResearch.status)) {
    addIssue(issues, "brain_references_not_verified", profile.channel.id, profile.id);
  }
  if (profile.referenceCriteria.length === 0) {
    addIssue(issues, "brain_criteria_missing", profile.channel.id, profile.id);
  }
  if (profile.referenceSources.length === 0) {
    addIssue(issues, "brain_sources_missing", profile.channel.id, profile.id);
  }
  if (
    profile.referenceCriteria.some(
      (criterion) =>
        ![
          REFERENCE_CLASSIFICATIONS.reconstructionCriterion,
          REFERENCE_CLASSIFICATIONS.ownerSpecification
        ].includes(criterion.classification) ||
        criterion.sourceIds.some((sourceId) => !sourceIds.has(sourceId))
    )
  ) {
    addIssue(issues, "brain_criteria_invalid", profile.channel.id, profile.id);
  }
  if (profile.referenceSources.some((source) => !isValidReferenceSource(source))) {
    addIssue(issues, "brain_sources_invalid", profile.channel.id, profile.id);
  }
  if (
    profile.referenceHypotheses.some(
      (hypothesis) =>
        hypothesis.status !== "pending_validation" ||
        hypothesis.classification !==
          REFERENCE_CLASSIFICATIONS.unvalidatedHypothesis
    )
  ) {
    addIssue(issues, "brain_hypotheses_invalid", profile.channel.id, profile.id);
  }
}

export function validateBrainCoreCatalog() {
  const issues = [];
  const currentProfiles = listChannelBrains();

  for (const channel of PROJECT_CHANNELS) {
    const versions = listChannelBrainVersions(channel.id);
    const versionNumbers = versions.map((profile) => profile.profileVersion);
    const expectedVersions = versionNumbers.map((_, index) => index + 1);

    if (versions.length === 0) {
      addIssue(issues, "channel_brain_missing", channel.id);
      continue;
    }
    if (new Set(versionNumbers).size !== versionNumbers.length) {
      addIssue(issues, "brain_version_duplicate", channel.id, versions[0].id);
    }
    if (JSON.stringify(versionNumbers) !== JSON.stringify(expectedVersions)) {
      addIssue(issues, "brain_version_gap", channel.id, versions[0].id);
    }

    const current = currentProfiles.find(
      (profile) => profile.channel.id === channel.id
    );
    if (!current) {
      addIssue(issues, "current_brain_missing", channel.id);
      continue;
    }
    validateCurrentProfile(current, issues);
  }

  if (
    new Set(currentProfiles.map((profile) => profile.channel.id)).size !==
    PROJECT_CHANNELS.length
  ) {
    addIssue(issues, "current_brain_channel_coverage_invalid");
  }

  const counts = Object.freeze({
    channels: PROJECT_CHANNELS.length,
    profiles: BRAIN_PROFILE_HISTORY.length,
    currentProfiles: currentProfiles.length,
    criteria: currentProfiles.reduce(
      (total, profile) => total + profile.referenceCriteria.length,
      0
    ),
    sources: currentProfiles.reduce(
      (total, profile) => total + profile.referenceSources.length,
      0
    ),
    hypotheses: currentProfiles.reduce(
      (total, profile) => total + profile.referenceHypotheses.length,
      0
    ),
    issues: issues.length
  });

  return Object.freeze({
    valid: issues.length === 0,
    status: issues.length === 0 ? "valid" : "invalid",
    mode: "local_read_only",
    externalConnections: false,
    counts,
    issues: Object.freeze(issues)
  });
}

export function createBrainStrategyContext({ assignment, channelId }) {
  const compatibility = assessBrainAssignmentCompatibility({
    assignment,
    channelId
  });
  if (!compatibility.compatible) {
    throw new BrainCoreValidationError(
      "O cérebro da missão não é compatível com o canal informado."
    );
  }

  const profile = findChannelBrain(assignment.id, assignment.profileVersion);
  if (!profile || !isVerifiedResearchStatus(profile.referenceResearch.status)) {
    throw new BrainCoreValidationError(
      "A missão precisa de uma versão oficial ou de referências verificadas do cérebro."
    );
  }

  return Object.freeze({
    brainId: profile.id,
    brainName: profile.name,
    profileVersion: profile.profileVersion,
    channelId: profile.channel.id,
    referenceStatus: profile.referenceResearch.status,
    criteriaIds: Object.freeze(
      profile.referenceCriteria.map((criterion) => criterion.id)
    ),
    sourceIds: Object.freeze(
      profile.referenceSources.map((source) => source.id)
    ),
    hypothesisIds: Object.freeze(
      profile.referenceHypotheses.map((hypothesis) => hypothesis.id)
    )
  });
}

