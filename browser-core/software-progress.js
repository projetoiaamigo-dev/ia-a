const milestones = [
  { id: "local-foundation", label: "Núcleo local e primeira missão persistente", points: 10, completed: true },
  { id: "project-create", label: "Criar e reabrir um projeto local", points: 1, completed: true },
  { id: "project-list", label: "Listar projetos preservados", points: 1, completed: true },
  { id: "mission-project-link", label: "Vincular missão ao projeto correto", points: 1, completed: true },
  { id: "project-separation", label: "Separar dados e memória de cada projeto", points: 1, completed: true },
  { id: "mission-status", label: "Controlar os estados da missão", points: 1, completed: true },
  { id: "mission-update", label: "Atualizar missão com histórico", points: 1, completed: true },
  { id: "mission-reopen", label: "Retomar missão interrompida", points: 1, completed: true },
  { id: "project-archive", label: "Arquivar projeto sem apagar dados", points: 1, completed: true },
  { id: "project-permissions", label: "Aplicar permissões locais do projeto", points: 1, completed: true },
  { id: "project-core-validation", label: "Validar o núcleo de projetos e missões", points: 1, completed: true },
  { id: "brain-profile-model", label: "Modelar o cérebro estratégico local", points: 1, completed: true },
  { id: "brain-channel-separation", label: "Separar um cérebro para cada canal piloto", points: 1, completed: true },
  { id: "brain-channel-selection", label: "Selecionar o cérebro pelo canal da missão", points: 1, completed: true },
  { id: "brain-mission-application", label: "Aplicar o cérebro selecionado à missão", points: 1, completed: true },
  { id: "brain-reference-criteria", label: "Registrar critérios de referência por cérebro", points: 1, completed: true },
  { id: "brain-reference-sources", label: "Preservar fontes de referência verificadas", points: 1, completed: true },
  { id: "brain-versioning", label: "Versionar os cérebros por canal", points: 1, completed: true },
  { id: "brain-compatibility", label: "Validar compatibilidade entre cérebro e canal", points: 1, completed: true },
  { id: "brain-controlled-change", label: "Controlar a troca de cérebro da missão", points: 1, completed: true },
  { id: "brain-core-completion", label: "Fechar a aplicação dos cérebros no núcleo", points: 1, completed: true },
  { id: "strategy-brief-model", label: "Modelar o briefing estratégico local", points: 1, completed: true },
  { id: "strategy-theme-structure", label: "Transformar o tema em briefing estruturado", points: 1, completed: true },
  { id: "strategy-constraints", label: "Registrar objetivo, público e formato", points: 1, completed: true },
  { id: "strategy-funnel-plan", label: "Planejar o funil sem garantia de resultado", points: 1, completed: true },
  { id: "retention-strategy", label: "Planejar a retenção da missão", points: 1, completed: true },
  { id: "click-strategy", label: "Planejar título e clique", points: 1, completed: true },
  { id: "description-strategy", label: "Planejar a descrição estratégica", points: 1, completed: true },
  { id: "publishing-window-strategy", label: "Planejar a janela de publicação", points: 1, completed: true },
  { id: "strategy-brief-validation", label: "Validar o briefing estratégico", points: 1, completed: true },
  { id: "strategy-package-completion", label: "Fechar o pacote estratégico", points: 1, completed: true },
  { id: "text-package-model", label: "Modelar e persistir o pacote textual", points: 1, completed: true },
  { id: "text-title-asset", label: "Materializar o título final rastreável", points: 1, completed: true },
  { id: "text-description-asset", label: "Materializar a descrição final", points: 1, completed: true },
  { id: "text-script-structure", label: "Estruturar o roteiro pelas quatro etapas de retenção", points: 1, completed: true },
  { id: "text-opening", label: "Criar e validar a abertura textual", points: 1, completed: true },
  { id: "text-progression", label: "Materializar a progressão textual", points: 1, completed: true },
  { id: "text-reengagement", label: "Materializar o reengajamento textual", points: 1, completed: true },
  { id: "text-closing", label: "Materializar o encerramento textual", points: 1, completed: true },
  { id: "text-script-validation", label: "Validar o roteiro textual completo", points: 1, completed: true },
  { id: "text-script-persistence", label: "Persistir e reabrir o roteiro textual completo", points: 1, completed: true },
  { id: "text-final-script", label: "Consolidar o ativo único de roteiro final", points: 1, completed: true },
  { id: "text-transition-map", label: "Materializar o mapa textual de transições", points: 1, completed: true },
  { id: "text-safety-origins", label: "Registrar segurança e origem das afirmações", points: 1, completed: true },
  { id: "text-package-validation", label: "Validar integralmente o pacote textual", points: 1, completed: true },
  { id: "text-package-closure", label: "Fechar e preparar o pacote textual para cenas", points: 1, completed: true },
  { id: "scene-package-model", label: "Modelar o pacote local de cenas", points: 1, completed: true },
  { id: "scene-storyboard", label: "Estruturar o storyboard pelas quatro etapas", points: 1, completed: true },
  { id: "scene-narration", label: "Materializar o roteiro de narração", points: 1, completed: true },
  { id: "scene-captions", label: "Criar o plano estrutural de legendas", points: 1, completed: true },
  { id: "scene-visual-map", label: "Criar e preservar o mapa visual dinâmico", points: 1, completed: true },
  { id: "scene-package-continuation", label: "Continuar o plano integrado de cenas", points: 10, completed: true },
  { id: "validation-safety", label: "Qualidade, direitos, segurança e bloqueios", points: 10, completed: true },
  { id: "audit-checkpoints", label: "Auditoria, checkpoints e exportação", points: 10, completed: true },
  { id: "android-experience", label: "Experiência móvel preparada para Android", points: 5, completed: true },
  { id: "field-connections", label: "Conexões e teste de campo com Anderson", points: 5, completed: false, completedPoints: 4, requiresAnderson: true }
];

const totalPoints = milestones.reduce((total, milestone) => total + milestone.points, 0);
if (totalPoints !== 100) {
  throw new Error(`Os marcos do software somam ${totalPoints}, não 100.`);
}

export function getSoftwareProgress() {
  const percentage = milestones
    .reduce(
      (total, milestone) =>
        total +
        (milestone.completed
          ? milestone.points
          : Math.min(milestone.points, milestone.completedPoints ?? 0)),
      0
    );

  const next = milestones.find((milestone) => !milestone.completed) ?? null;

  return {
    percentage,
    total: 100,
    next: next
      ? {
          id: next.id,
          label: next.label,
          points: next.points,
          completedPoints: next.completedPoints ?? 0,
          remainingPoints: next.points - (next.completedPoints ?? 0)
        }
      : null,
    andersonStartsAt: 95,
    milestones: milestones.map((milestone) => ({ ...milestone }))
  };
}
