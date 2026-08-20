import { findBrainReferencePackage } from "./brain-references.js";
import { findPilotChannel } from "./channels.js";

const BRAIN_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "louvar-continuity",
    name: "Continuidade de Louvor",
    channel: Object.freeze({
      id: "web-radio-louvar",
      name: "Web Rádio Louvar"
    }),
    primaryGoal: "Preservar uma experiência contínua, respeitosa e não monetizada.",
    principles: Object.freeze([
      "continuidade entre cenas e blocos",
      "tom acolhedor sem promessa de resultado",
      "monetização permanentemente desativada"
    ])
  }),
  Object.freeze({
    id: "faith-retention",
    name: "Retenção com Fé",
    channel: Object.freeze({
      id: "fale-com-deus",
      name: "Fale com Deus"
    }),
    primaryGoal: "Conduzir uma narrativa de fé clara, humana e capaz de sustentar atenção.",
    principles: Object.freeze([
      "abertura direta ligada ao tema",
      "progressão narrativa sem repetição vazia",
      "encerramento coerente com a missão"
    ])
  })
]);

function freezeProfile(profile) {
  return Object.freeze({
    ...profile,
    channel: Object.freeze({ ...profile.channel }),
    strategy: Object.freeze({
      ...profile.strategy,
      principles: Object.freeze([...profile.strategy.principles])
    }),
    referenceCriteria: Object.freeze([...(profile.referenceCriteria ?? [])]),
    referenceSources: Object.freeze([...(profile.referenceSources ?? [])]),
    referenceHypotheses: Object.freeze([...(profile.referenceHypotheses ?? [])]),
    referenceResearch: Object.freeze({
      ...profile.referenceResearch,
      sourceIds: Object.freeze([...(profile.referenceResearch.sourceIds ?? [])])
    })
  });
}

function createProfileVersion(definition, profileVersion) {
  const referencePackage = findBrainReferencePackage(definition.id);
  const researchVerified = profileVersion >= 2 && referencePackage;

  return freezeProfile({
    schemaVersion: researchVerified ? 2 : 1,
    profileVersion,
    id: definition.id,
    name: definition.name,
    channel: definition.channel,
    strategy: {
      primaryGoal: definition.primaryGoal,
      principles: definition.principles
    },
    referenceCriteria: researchVerified ? referencePackage.criteria : [],
    referenceSources: researchVerified ? referencePackage.sources : [],
    referenceHypotheses: researchVerified ? referencePackage.hypotheses : [],
    referenceResearch: researchVerified
      ? {
          status: "verified",
          verifiedAt: referencePackage.verifiedAt,
          sourceIds: referencePackage.sources.map((source) => source.id),
          note:
            "Fatos públicos, critérios novos e hipóteses não validadas estão classificados separadamente."
        }
      : {
          status: "pending",
          sourceIds: [],
          note: "Referências públicas de canais bem-sucedidos ainda não foram verificadas."
        }
  });
}

// Perfis e versões novos da reconstrução. Eles não afirmam recuperar os
// cérebros antigos nem copiar a identidade ou o conteúdo das referências.
export const BRAIN_PROFILE_HISTORY = Object.freeze(
  BRAIN_DEFINITIONS.flatMap((definition) => [
    createProfileVersion(definition, 1),
    createProfileVersion(definition, 2)
  ])
);

function latestProfile(profiles) {
  return profiles.reduce(
    (latest, profile) =>
      !latest || profile.profileVersion > latest.profileVersion ? profile : latest,
    null
  );
}

export const CHANNEL_BRAINS = Object.freeze(
  BRAIN_DEFINITIONS.map((definition) =>
    latestProfile(
      BRAIN_PROFILE_HISTORY.filter((profile) => profile.id === definition.id)
    )
  )
);

export function listChannelBrains() {
  return CHANNEL_BRAINS;
}

export function listBrainVersions(brainId) {
  return Object.freeze(
    BRAIN_PROFILE_HISTORY.filter((profile) => profile.id === brainId).toSorted(
      (left, right) => left.profileVersion - right.profileVersion
    )
  );
}

export function listChannelBrainVersions(channelId) {
  return Object.freeze(
    BRAIN_PROFILE_HISTORY.filter(
      (profile) => profile.channel.id === channelId
    ).toSorted((left, right) => left.profileVersion - right.profileVersion)
  );
}

export function findChannelBrain(brainId, profileVersion) {
  const versions = BRAIN_PROFILE_HISTORY.filter((profile) => profile.id === brainId);
  if (profileVersion === undefined) {
    return latestProfile(versions);
  }
  return versions.find((profile) => profile.profileVersion === profileVersion) ?? null;
}

export function selectBrainForChannel(channelId, { profileVersion } = {}) {
  if (!findPilotChannel(channelId)) {
    return null;
  }

  const versions = listChannelBrainVersions(channelId);
  if (profileVersion === undefined) {
    return latestProfile(versions);
  }
  return versions.find((profile) => profile.profileVersion === profileVersion) ?? null;
}

export function assessBrainChannelCompatibility({
  brainId,
  profileVersion,
  channelId
}) {
  const channel = findPilotChannel(channelId);
  if (!channel) {
    return Object.freeze({
      compatible: false,
      code: "channel_invalid",
      brainId: brainId ?? null,
      profileVersion: profileVersion ?? null,
      channelId: channelId ?? null
    });
  }

  const profile = findChannelBrain(brainId, profileVersion);
  if (!profile) {
    return Object.freeze({
      compatible: false,
      code: "brain_version_unknown",
      brainId: brainId ?? null,
      profileVersion: profileVersion ?? null,
      channelId
    });
  }

  if (profile.channel.id !== channelId) {
    return Object.freeze({
      compatible: false,
      code: "brain_channel_mismatch",
      brainId,
      profileVersion,
      channelId,
      expectedChannelId: profile.channel.id
    });
  }

  return Object.freeze({
    compatible: true,
    code: "compatible",
    brainId,
    profileVersion,
    channelId
  });
}

export function assessBrainAssignmentCompatibility({ assignment, channelId }) {
  if (!assignment || typeof assignment !== "object") {
    return Object.freeze({
      compatible: false,
      code: "brain_assignment_missing",
      brainId: null,
      profileVersion: null,
      channelId: channelId ?? null
    });
  }

  const assessment = assessBrainChannelCompatibility({
    brainId: assignment.id,
    profileVersion: assignment.profileVersion,
    channelId
  });
  if (!assessment.compatible) {
    return assessment;
  }

  const profile = findChannelBrain(assignment.id, assignment.profileVersion);
  if (
    assignment.name !== profile.name ||
    assignment.channelId !== profile.channel.id
  ) {
    return Object.freeze({
      compatible: false,
      code: "brain_assignment_snapshot_mismatch",
      brainId: assignment.id,
      profileVersion: assignment.profileVersion,
      channelId
    });
  }

  return assessment;
}

export function createBrainAssignment(
  channelId,
  { brainId, profileVersion } = {}
) {
  const brain = brainId
    ? findChannelBrain(brainId, profileVersion)
    : selectBrainForChannel(channelId, { profileVersion });
  if (!brain || brain.channel.id !== channelId) {
    return null;
  }

  return Object.freeze({
    id: brain.id,
    name: brain.name,
    channelId: brain.channel.id,
    profileVersion: brain.profileVersion
  });
}

export function isLatestBrainAssignment(assignment) {
  if (!assignment || typeof assignment !== "object") {
    return false;
  }
  const latest = selectBrainForChannel(assignment.channelId);
  return Boolean(
    latest &&
      latest.id === assignment.id &&
      latest.profileVersion === assignment.profileVersion
  );
}
