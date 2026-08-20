import { randomUUID } from "./crypto-browser.js";

const FORMAT_RETENTION_BLUEPRINTS = Object.freeze({
  short_video: Object.freeze({
    openingTargetSeconds: 2,
    sceneCadenceSeconds: Object.freeze({ min: 3, max: 7 })
  }),
  standard_video: Object.freeze({
    openingTargetSeconds: 5,
    sceneCadenceSeconds: Object.freeze({ min: 8, max: 18 })
  }),
  long_video: Object.freeze({
    openingTargetSeconds: 8,
    sceneCadenceSeconds: Object.freeze({ min: 15, max: 35 })
  }),
  continuous_live: Object.freeze({
    openingTargetSeconds: 15,
    sceneCadenceSeconds: Object.freeze({ min: 45, max: 120 })
  })
});

export class RetentionPlanValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RetentionPlanValidationError";
  }
}

function freezeStage(stage) {
  return Object.freeze({
    ...stage,
    sourceCriteriaIds: Object.freeze([...stage.sourceCriteriaIds])
  });
}

export function createRetentionPlan({
  mission,
  id = randomUUID(),
  now = new Date()
}) {
  const briefing = mission?.strategyBriefing;
  if (!mission || typeof mission.id !== "string" || !briefing) {
    throw new RetentionPlanValidationError(
      "A missão precisa de um briefing estratégico antes do plano de retenção."
    );
  }

  const blueprint = FORMAT_RETENTION_BLUEPRINTS[briefing.constraints?.format];
  if (!blueprint) {
    throw new RetentionPlanValidationError(
      "O formato do briefing não possui uma política de retenção."
    );
  }
  if (
    briefing.brainContext?.brainId !== mission.brain?.id ||
    briefing.brainContext?.profileVersion !== mission.brain?.profileVersion ||
    briefing.channel?.id !== mission.channel?.id
  ) {
    throw new RetentionPlanValidationError(
      "O briefing não corresponde ao cérebro e ao canal atuais da missão."
    );
  }

  const criteriaIds = briefing.brainContext.criteriaIds;
  const theme = briefing.theme.value;

  return Object.freeze({
    schemaVersion: 1,
    id,
    missionId: mission.id,
    briefingId: briefing.id,
    mode: "local_planning_only",
    externalConnections: false,
    createdAt: now.toISOString(),
    brain: Object.freeze({
      id: mission.brain.id,
      profileVersion: mission.brain.profileVersion,
      channelId: mission.channel.id
    }),
    format: briefing.constraints.format,
    theme,
    stages: Object.freeze([
      freezeStage({
        id: "opening",
        objective: `Apresentar “${theme}” com clareza e sem promessa de resultado.`,
        targetSeconds: blueprint.openingTargetSeconds,
        sourceCriteriaIds: criteriaIds
      }),
      freezeStage({
        id: "progression",
        objective:
          "Avançar a narrativa por blocos distintos, sem repetição vazia.",
        sceneCadenceSeconds: blueprint.sceneCadenceSeconds,
        sourceCriteriaIds: criteriaIds
      }),
      freezeStage({
        id: "reengagement",
        objective:
          "Usar mudanças visuais, sonoras ou narrativas somente quando reforçarem o sentido da missão.",
        sourceCriteriaIds: criteriaIds
      }),
      freezeStage({
        id: "closing",
        objective:
          "Encerrar com coerência, sem prolongamento artificial e sem chamada enganosa.",
        sourceCriteriaIds: criteriaIds
      })
    ]),
    measurement: Object.freeze({
      status: "awaiting_real_channel_data",
      metric: "audience_retention",
      guaranteed: false
    }),
    hypothesis: Object.freeze({
      classification: "unvalidated_hypothesis",
      status: "pending_validation",
      statement:
        "A estrutura planejada pode apoiar a retenção, mas precisa ser validada no próprio canal."
    })
  });
}

