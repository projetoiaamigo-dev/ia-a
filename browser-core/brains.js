import { findBrainReferencePackage, REFERENCE_CLASSIFICATIONS } from "./brain-references.js";
import { findProjectChannel } from "./channels.js";
import { OFFICIAL_BRAIN_BASES, OFFICIAL_BRAIN_SOURCE } from "./official-brains.js";

const LEGACY_BRAIN_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "louvar-continuity",
    name: "Continuidade de Louvor",
    channel: Object.freeze({ id: "web-radio-louvar", name: "Web Rádio Louvar" }),
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
    channel: Object.freeze({ id: "fale-com-deus", name: "Fale com Deus" }),
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
    officialBase: profile.officialBase ?? null,
    referenceCriteria: Object.freeze([...(profile.referenceCriteria ?? [])]),
    referenceSources: Object.freeze([...(profile.referenceSources ?? [])]),
    referenceHypotheses: Object.freeze([...(profile.referenceHypotheses ?? [])]),
    referenceResearch: Object.freeze({
      ...profile.referenceResearch,
      sourceIds: Object.freeze([...(profile.referenceResearch.sourceIds ?? [])])
    })
  });
}

function createLegacyProfileVersion(definition, profileVersion) {
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
          note: "Fatos públicos, critérios novos e hipóteses não validadas estão classificados separadamente."
        }
      : {
          status: "pending",
          sourceIds: [],
          note: "Referências públicas de canais bem-sucedidos ainda não foram verificadas."
        }
  });
}

function createOfficialProfile(base, profileVersion) {
  const sourceId = `${OFFICIAL_BRAIN_SOURCE.id}-${base.channel.id}`;
  const source = Object.freeze({
    id: sourceId,
    type: REFERENCE_CLASSIFICATIONS.ownerSpecification,
    name: OFFICIAL_BRAIN_SOURCE.title,
    providedBy: OFFICIAL_BRAIN_SOURCE.providedBy,
    providedAt: OFFICIAL_BRAIN_SOURCE.providedAt,
    facts: Object.freeze([
      Object.freeze({
        id: `${base.channel.id}-official-brain-base`,
        statement: `A base oficial do cérebro ${base.channel.name} foi definida pelo proprietário do projeto.`,
        classification: REFERENCE_CLASSIFICATIONS.ownerDefinedFact
      })
    ])
  });
  const criteria = base.responsibilities.map((statement, index) =>
    Object.freeze({
      id: `${base.channel.id}-official-responsibility-${index + 1}`,
      origin: "owner_official_base",
      statement,
      classification: REFERENCE_CLASSIFICATIONS.ownerSpecification,
      sourceIds: Object.freeze([sourceId])
    })
  );

  return freezeProfile({
    schemaVersion: 3,
    profileVersion,
    id: base.id,
    name: base.name,
    channel: base.channel,
    origin: OFFICIAL_BRAIN_SOURCE.id,
    officialBase: base,
    strategy: {
      primaryGoal: base.primaryGoal,
      principles: base.responsibilities
    },
    referenceCriteria: criteria,
    referenceSources: [source],
    referenceHypotheses: [],
    referenceResearch: {
      status: "owner_verified",
      verifiedAt: OFFICIAL_BRAIN_SOURCE.providedAt,
      sourceIds: [sourceId],
      note: "Base oficial preservada. O aprendizado operacional deve vir dos dados reais do próprio canal."
    }
  });
}

const LEGACY_PROFILE_HISTORY = LEGACY_BRAIN_DEFINITIONS.flatMap((definition) => [
  createLegacyProfileVersion(definition, 1),
  createLegacyProfileVersion(definition, 2)
]);

const OFFICIAL_PROFILE_HISTORY = OFFICIAL_BRAIN_BASES.map((base) =>
  createOfficialProfile(
    base,
    LEGACY_BRAIN_DEFINITIONS.some((definition) => definition.id === base.id) ? 3 : 1
  )
);

// As versões 1 e 2 dos dois cérebros existentes permanecem intactas.
// A base oficial do proprietário entra como nova versão, nunca como reconstrução.
export const BRAIN_PROFILE_HISTORY = Object.freeze([
  ...LEGACY_PROFILE_HISTORY,
  ...OFFICIAL_PROFILE_HISTORY
]);

function latestProfile(profiles) {
  return profiles.reduce(
    (latest, profile) => !latest || profile.profileVersion > latest.profileVersion ? profile : latest,
    null
  );
}

export const CHANNEL_BRAINS = Object.freeze(
  OFFICIAL_BRAIN_BASES.map((base) =>
    latestProfile(BRAIN_PROFILE_HISTORY.filter((profile) => profile.id === base.id))
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
    BRAIN_PROFILE_HISTORY.filter((profile) => profile.channel.id === channelId).toSorted(
      (left, right) => left.profileVersion - right.profileVersion
    )
  );
}

export function findChannelBrain(brainId, profileVersion) {
  const versions = BRAIN_PROFILE_HISTORY.filter((profile) => profile.id === brainId);
  if (profileVersion === undefined) return latestProfile(versions);
  return versions.find((profile) => profile.profileVersion === profileVersion) ?? null;
}

export function selectBrainForChannel(channelId, { profileVersion } = {}) {
  if (!findProjectChannel(channelId)) return null;
  const versions = listChannelBrainVersions(channelId);
  if (profileVersion === undefined) return latestProfile(versions);
  return versions.find((profile) => profile.profileVersion === profileVersion) ?? null;
}

export function assessBrainChannelCompatibility({ brainId, profileVersion, channelId }) {
  const channel = findProjectChannel(channelId);
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
  return Object.freeze({ compatible: true, code: "compatible", brainId, profileVersion, channelId });
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
  if (!assessment.compatible) return assessment;

  const profile = findChannelBrain(assignment.id, assignment.profileVersion);
  if (assignment.name !== profile.name || assignment.channelId !== profile.channel.id) {
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

export function createBrainAssignment(channelId, { brainId, profileVersion } = {}) {
  const brain = brainId
    ? findChannelBrain(brainId, profileVersion)
    : selectBrainForChannel(channelId, { profileVersion });
  if (!brain || brain.channel.id !== channelId) return null;
  return Object.freeze({
    id: brain.id,
    name: brain.name,
    channelId: brain.channel.id,
    profileVersion: brain.profileVersion
  });
}

export function isLatestBrainAssignment(assignment) {
  if (!assignment || typeof assignment !== "object") return false;
  const latest = selectBrainForChannel(assignment.channelId);
  return Boolean(
    latest && latest.id === assignment.id && latest.profileVersion === assignment.profileVersion
  );
}
