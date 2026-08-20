export const REFERENCE_CLASSIFICATIONS = Object.freeze({
  verifiedFact: "verified_public_fact",
  reconstructionCriterion: "reconstruction_criterion",
  unvalidatedHypothesis: "unvalidated_hypothesis",
  ownerSpecification: "owner_specification",
  ownerDefinedFact: "owner_defined_fact"
});

const VERIFIED_AT = "2026-08-11";

function freezeSource(source) {
  return Object.freeze({
    ...source,
    facts: Object.freeze(
      source.facts.map((fact) =>
        Object.freeze({
          ...fact,
          classification: REFERENCE_CLASSIFICATIONS.verifiedFact
        })
      )
    )
  });
}

function freezeCriterion(criterion) {
  return Object.freeze({
    ...criterion,
    classification: REFERENCE_CLASSIFICATIONS.reconstructionCriterion,
    sourceIds: Object.freeze([...(criterion.sourceIds ?? [])])
  });
}

function freezeHypothesis(hypothesis) {
  return Object.freeze({
    ...hypothesis,
    status: "pending_validation",
    classification: REFERENCE_CLASSIFICATIONS.unvalidatedHypothesis
  });
}

function freezeReferencePackage(referencePackage) {
  return Object.freeze({
    ...referencePackage,
    verifiedAt: VERIFIED_AT,
    sources: Object.freeze(referencePackage.sources.map(freezeSource)),
    criteria: Object.freeze(referencePackage.criteria.map(freezeCriterion)),
    hypotheses: Object.freeze(referencePackage.hypotheses.map(freezeHypothesis))
  });
}

// Pesquisa pública verificada em 11/08/2026. Os fatos abaixo são fotografias
// datadas das fontes; critérios e hipóteses permanecem classificados à parte.
export const BRAIN_REFERENCE_PACKAGES = Object.freeze([
  freezeReferencePackage({
    brainId: "louvar-continuity",
    sources: [
      {
        id: "lofi-girl-youtube-channel",
        type: "youtube_channel",
        name: "Lofi Girl",
        publisher: "Lofi Girl",
        url: "https://www.youtube.com/channel/UCSJ4gkVC6NrvII8umztf0Ow",
        facts: [
          {
            id: "lofi-girl-public-scale",
            statement:
              "A página pública indexada exibia 15,8 milhões de inscritos e 437 vídeos na verificação datada."
          },
          {
            id: "lofi-girl-continuous-radio",
            statement:
              "A página pública apresentava rádios musicais 24/7 e transmissões ao vivo com finalidades distintas."
          }
        ]
      },
      {
        id: "lofi-girl-official-live-catalog",
        type: "official_website",
        name: "Lofi Girl — catálogo oficial de transmissões",
        publisher: "Lofi Girl",
        url: "https://www.lofigirl.com/",
        facts: [
          {
            id: "lofi-girl-format-catalog",
            statement:
              "O catálogo oficial listava formatos contínuos separados para estudo, descanso, sono, jazz, synthwave e Pomodoro."
          }
        ]
      }
    ],
    criteria: [
      {
        id: "continuous-session-design",
        origin: "reference_analysis",
        statement:
          "Planejar blocos longos com transições coerentes para preservar continuidade sem repetição desordenada.",
        sourceIds: [
          "lofi-girl-youtube-channel",
          "lofi-girl-official-live-catalog"
        ]
      },
      {
        id: "purpose-specific-continuity",
        origin: "reference_analysis",
        statement:
          "Definir uma finalidade clara para cada experiência contínua e manter identidade audiovisual compatível com ela.",
        sourceIds: ["lofi-girl-official-live-catalog"]
      },
      {
        id: "rights-and-non-monetization-gate",
        origin: "project_rule",
        statement:
          "Bloquear qualquer material sem direitos confirmados e preservar a monetização permanentemente desativada da Web Rádio Louvar.",
        sourceIds: []
      }
    ],
    hypotheses: [
      {
        id: "louvar-continuity-retention-hypothesis",
        statement:
          "Uma experiência contínua e reconhecível pode ampliar o tempo de sessão da Web Rádio Louvar; isso ainda exige teste real no próprio canal."
      }
    ]
  }),
  freezeReferencePackage({
    brainId: "faith-retention",
    sources: [
      {
        id: "bibleproject-portuguese-youtube-channel",
        type: "youtube_channel",
        name: "BibleProject — Português",
        publisher: "BibleProject",
        url: "https://www.youtube.com/channel/UCRyMEBm9qrb4vEdJOPhRd1w",
        facts: [
          {
            id: "bibleproject-portuguese-public-scale",
            statement:
              "A página pública indexada exibia 1 milhão de inscritos e 292 vídeos na verificação datada."
          },
          {
            id: "bibleproject-portuguese-format",
            statement:
              "A descrição pública apresentava o projeto como um estúdio sem fins lucrativos que produz vídeos curtos animados sobre a Bíblia."
          }
        ]
      },
      {
        id: "bibleproject-official-media-catalog",
        type: "official_website",
        name: "BibleProject — catálogo oficial",
        publisher: "BibleProject",
        url: "https://bibleproject.com/",
        facts: [
          {
            id: "bibleproject-topic-structure",
            statement:
              "O catálogo oficial organizava vídeos animados por livros bíblicos, temas centrais, coleções e séries de aprendizagem."
          }
        ]
      }
    ],
    criteria: [
      {
        id: "theme-led-opening",
        origin: "reference_analysis",
        statement:
          "Abrir a missão declarando o tema humano e espiritual que será desenvolvido, sem promessa de resultado.",
        sourceIds: [
          "bibleproject-portuguese-youtube-channel",
          "bibleproject-official-media-catalog"
        ]
      },
      {
        id: "structured-faith-progression",
        origin: "reference_analysis",
        statement:
          "Organizar a mensagem em progressão compreensível, conectando contexto, desenvolvimento e encerramento coerente.",
        sourceIds: ["bibleproject-official-media-catalog"]
      },
      {
        id: "visual-support-for-meaning",
        origin: "reference_analysis",
        statement:
          "Usar mudanças visuais e cenas para apoiar conceitos da narração, sem copiar identidade ou material da referência.",
        sourceIds: ["bibleproject-portuguese-youtube-channel"]
      }
    ],
    hypotheses: [
      {
        id: "faith-structured-retention-hypothesis",
        statement:
          "Uma abertura temática seguida de progressão visual pode melhorar retenção no Fale com Deus; isso ainda exige teste real no próprio canal."
      }
    ]
  })
]);

export function findBrainReferencePackage(brainId) {
  return (
    BRAIN_REFERENCE_PACKAGES.find(
      (referencePackage) => referencePackage.brainId === brainId
    ) ?? null
  );
}
