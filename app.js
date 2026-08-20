const form = document.querySelector("#mission-form");
const titleInput = document.querySelector("#title");
const projectSelect = document.querySelector("#project");
const channelSelect = document.querySelector("#channel");
const statusElement = document.querySelector("#form-status");
const missionList = document.querySelector("#mission-list");
const refreshButton = document.querySelector("#refresh");
const projectList = document.querySelector("#project-list");
const refreshProjectsButton = document.querySelector("#refresh-projects");
const progressValue = document.querySelector("#progress-value");
const progressNext = document.querySelector("#progress-next");
const progressTrack = document.querySelector("#progress-track");
const progressFill = document.querySelector("#progress-fill");
const coreValidationStatus = document.querySelector("#core-validation-status");
const validateCoreButton = document.querySelector("#validate-core");
const localStatus = document.querySelector("#local-status");
const createStarterProjectButton = document.querySelector("#create-starter-project");

function setStatus(message, kind = "") {
  statusElement.textContent = message;
  statusElement.dataset.kind = kind;
}

function getProjectPermissionMode(project) {
  return project.localPermissions?.mode ?? "read_write";
}

async function runTextPackageStep(mission, endpoint, progressMessage, body) {
  setStatus(progressMessage);
  try {
    const response = await fetch(`/api/missions/${mission.id}/${endpoint}`, {
      method: "POST",
      ...(body === undefined
        ? {}
        : {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body)
          })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error ?? "Não foi possível atualizar o pacote textual.");
    }
    setStatus(`Pacote textual de “${mission.title}” atualizado localmente.`, "success");
    await Promise.all([loadMissions(), loadCoreValidation()]);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function runScenePackageStep(mission, endpoint, progressMessage) {
  setStatus(progressMessage);
  try {
    const response = await fetch(`/api/missions/${mission.id}/${endpoint}`, {
      method: "POST"
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error ?? "Não foi possível atualizar o pacote de cenas.");
    }
    setStatus(`Pacote de cenas de “${mission.title}” atualizado localmente.`, "success");
    await Promise.all([loadMissions(), loadCoreValidation()]);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function runValidationSafetyStep(mission, endpoint, progressMessage) {
  setStatus(progressMessage);
  try {
    const response = await fetch(`/api/missions/${mission.id}/${endpoint}`, {
      method: "POST"
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(
        result.error ?? "Não foi possível atualizar a validação e segurança."
      );
    }
    setStatus(
      `Validação e segurança de “${mission.title}” atualizadas localmente.`,
      "success"
    );
    await Promise.all([loadMissions(), loadCoreValidation()]);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function runAuditCheckpointsStep(mission, endpoint, progressMessage) {
  setStatus(progressMessage);
  try {
    const response = await fetch(`/api/missions/${mission.id}/${endpoint}`, {
      method: "POST"
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(
        result.error ?? "Não foi possível atualizar a auditoria e os checkpoints."
      );
    }
    setStatus(
      `Auditoria e checkpoints de “${mission.title}” atualizados localmente.`,
      "success"
    );
    await Promise.all([loadMissions(), loadCoreValidation()]);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function runAndroidExperienceStep(mission, endpoint, progressMessage) {
  setStatus(progressMessage);
  try {
    const response = await fetch(`/api/missions/${mission.id}/${endpoint}`, {
      method: "POST"
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(
        result.error ?? "Não foi possível atualizar a experiência Android."
      );
    }
    setStatus(
      `Experiência Android de “${mission.title}” atualizada localmente.`,
      "success"
    );
    await Promise.all([loadMissions(), loadCoreValidation(), loadProgress()]);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function runFieldConnectionsStep(mission, endpoint, progressMessage) {
  setStatus(progressMessage);
  try {
    const response = await fetch(`/api/missions/${mission.id}/${endpoint}`, {
      method: "POST"
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(
        result.error ?? "Não foi possível preparar as conexões de campo."
      );
    }
    setStatus(
      `Conexões de campo de “${mission.title}” preparadas localmente.`,
      "success"
    );
    await Promise.all([loadMissions(), loadCoreValidation(), loadProgress()]);
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function appendTextStageAction(article, mission, {
  stageId,
  label,
  placeholder,
  endpoint
}) {
  const input = document.createElement("textarea");
  input.className = "text-opening-input";
  input.rows = stageId === "progression" ? 7 : 4;
  input.minLength = 20;
  input.maxLength = stageId === "progression" ? 12000 : 2500;
  input.placeholder = placeholder;
  input.setAttribute("aria-label", `${label} de ${mission.title}`);

  const button = document.createElement("button");
  button.className = "secondary mission-action";
  button.type = "button";
  button.textContent = `Criar e validar ${label.toLocaleLowerCase("pt-BR")}`;
  button.addEventListener("click", () =>
    runTextPackageStep(
      mission,
      endpoint,
      `Validando ${label.toLocaleLowerCase("pt-BR")} de “${mission.title}”…`,
      { text: input.value }
    )
  );
  article.append(input, button);
}

function createMissionCard(mission) {
  const article = document.createElement("article");
  article.className = "mission-card";

  const heading = document.createElement("h3");
  heading.textContent = mission.title;

  const channel = document.createElement("p");
  channel.textContent = mission.channel.name;

  const project = document.createElement("p");
  project.className = "mission-project";
  project.textContent = mission.project
    ? `Projeto: ${mission.project.name}`
    : "Projeto: vínculo ainda não informado";

  const brain = document.createElement("p");
  brain.className = "mission-brain";
  brain.textContent = mission.brain
    ? `Cérebro aplicado: ${mission.brain.name} (v${mission.brain.profileVersion})`
    : "Cérebro: missão anterior à seleção local";

  const strategy = document.createElement("p");
  strategy.className = "mission-strategy";
  if (mission.strategyBriefing) {
    const { theme, funnel } = mission.strategyBriefing;
    strategy.textContent =
      `Briefing: ${theme.value} · meta ${funnel.targetViews} · ` +
      `alcance planejado ${funnel.plannedReach} · faixa hipotética ` +
      `${funnel.expectedViewsRange.min}–${funnel.expectedViewsRange.max}`;
  } else {
    strategy.textContent = "Briefing estratégico: ainda não criado";
  }

  const retention = document.createElement("p");
  retention.className = "mission-retention";
  retention.textContent = mission.retentionPlan
    ? `Retenção: ${mission.retentionPlan.stages.length} etapas · dados reais pendentes`
    : "Plano de retenção: ainda não criado";

  const strategicPackage = document.createElement("p");
  strategicPackage.className = "mission-strategic-package";
  strategicPackage.textContent = mission.strategyPackage
    ? `Pacote estratégico: fechado · título verdadeiro · publicação não executada`
    : "Pacote estratégico: ainda não fechado";

  const textPackage = document.createElement("p");
  textPackage.className = "mission-text-package";
  if (mission.textPackage?.closure?.readyForScenePackage) {
    textPackage.textContent =
      "Pacote textual: fechado, preservado localmente e pronto para o pacote de cenas";
  } else if (mission.textPackage?.packageValidation?.status === "valid") {
    textPackage.textContent = "Pacote textual: correspondência integral validada";
  } else if (mission.textPackage?.safetyOriginRegistry) {
    textPackage.textContent = "Pacote textual: segurança e origem registradas";
  } else if (mission.textPackage?.transitionMapAsset) {
    textPackage.textContent = "Pacote textual: transições estruturais materializadas";
  } else if (mission.textPackage?.finalScriptAsset) {
    textPackage.textContent = "Pacote textual: roteiro final consolidado sem alterar os ativos";
  } else if (mission.textPackage?.script?.validation?.status === "valid") {
    textPackage.textContent =
      "Pacote textual: roteiro completo validado e preservado localmente";
  } else if (mission.textPackage?.closingAsset) {
    textPackage.textContent = "Pacote textual: quatro etapas materializadas";
  } else if (mission.textPackage?.reengagementAsset) {
    textPackage.textContent = "Pacote textual: reengajamento validado";
  } else if (mission.textPackage?.progressionAsset) {
    textPackage.textContent = "Pacote textual: progressão validada";
  } else if (mission.textPackage?.openingAsset) {
    textPackage.textContent = "Pacote textual: abertura validada · execução somente local";
  } else if (mission.textPackage?.script) {
    textPackage.textContent = "Pacote textual: roteiro estruturado em quatro etapas";
  } else if (mission.textPackage?.descriptionAsset) {
    textPackage.textContent = "Pacote textual: título e descrição rastreáveis";
  } else if (mission.textPackage?.titleAsset) {
    textPackage.textContent = "Pacote textual: título final rastreável";
  } else if (mission.textPackage) {
    textPackage.textContent = "Pacote textual: modelado e ligado ao pacote estratégico";
  } else {
    textPackage.textContent = "Pacote textual: ainda não iniciado";
  }

  const scenePackage = document.createElement("p");
  scenePackage.className = "mission-scene-package";
  if (mission.scenePackage?.closure?.readyForValidationSafety) {
    scenePackage.textContent =
      "Pacote de cenas: estrutura fechada e pronta para validação e segurança";
  } else if (mission.scenePackage?.renderPlan) {
    scenePackage.textContent =
      "Pacote de cenas: renderização planejada e bloqueada até existirem ativos reais";
  } else if (mission.scenePackage?.compositionPlan) {
    scenePackage.textContent =
      "Pacote de cenas: composição estrutural de vídeo, texto e áudio pronta";
  } else if (mission.scenePackage?.audioLayerPlan) {
    scenePackage.textContent = "Pacote de cenas: camadas locais de áudio estruturadas";
  } else if (mission.scenePackage?.mediaRequirementsPlan) {
    scenePackage.textContent =
      "Pacote de cenas: requisitos de mídia dinâmica materializados";
  } else if (mission.scenePackage?.integratedExecutionPlan?.status === "validated") {
    scenePackage.textContent =
      "Pacote de cenas: primeiro plano integrado validado e preservado localmente";
  } else if (mission.scenePackage?.motionPlan) {
    scenePackage.textContent = "Pacote de cenas: movimento e transições materializados";
  } else if (mission.scenePackage?.synchronizationPlan) {
    scenePackage.textContent =
      "Pacote de cenas: narração, legendas e unidades sincronizadas estruturalmente";
  } else if (mission.scenePackage?.durationPlan) {
    scenePackage.textContent =
      "Pacote de cenas: duração estimada localmente enquanto não há áudio real";
  } else if (mission.scenePackage?.sceneUnitPlan) {
    scenePackage.textContent = "Pacote de cenas: unidades locais materializadas";
  } else if (mission.scenePackage?.visualMap?.status === "validated") {
    scenePackage.textContent =
      "Pacote de cenas: mapa visual dinâmico validado e preservado localmente";
  } else if (mission.scenePackage?.captionPlan) {
    scenePackage.textContent = "Pacote de cenas: plano estrutural de legendas criado";
  } else if (mission.scenePackage?.narrationAsset) {
    scenePackage.textContent = "Pacote de cenas: roteiro de narração materializado";
  } else if (mission.scenePackage?.storyboard) {
    scenePackage.textContent = "Pacote de cenas: storyboard estruturado em quatro etapas";
  } else if (mission.scenePackage) {
    scenePackage.textContent = "Pacote de cenas: modelado sem conexões externas";
  } else {
    scenePackage.textContent = "Pacote de cenas: ainda não iniciado";
  }

  const validationSafety = document.createElement("p");
  validationSafety.className = "mission-validation-safety";
  if (mission.validationSafety?.closure?.readyForAuditCheckpoints) {
    validationSafety.textContent =
      "Validação e segurança: estágio fechado e pronto para auditoria e checkpoints";
  } else if (mission.validationSafety?.completeValidation) {
    validationSafety.textContent =
      "Validação e segurança: validação completa aprovada com bloqueios seguros";
  } else if (mission.validationSafety?.enforcementPolicy) {
    validationSafety.textContent =
      "Validação e segurança: política local de bloqueio por padrão ativa";
  } else if (mission.validationSafety?.rightsReadinessGate) {
    validationSafety.textContent =
      "Validação e segurança: ativos bloqueados por falta de origem e direitos";
  } else if (mission.validationSafety?.integritySnapshot) {
    validationSafety.textContent =
      "Validação e segurança: integridade das fontes selada localmente";
  } else if (mission.validationSafety?.integratedReport?.status === "valid") {
    validationSafety.textContent =
      "Validação e segurança: relatório integrado válido e preservado localmente";
  } else if (mission.validationSafety?.operationalLocks) {
    validationSafety.textContent =
      "Validação e segurança: publicação, contas, cobrança e renderização bloqueadas";
  } else if (mission.validationSafety?.contentSafetyValidation) {
    validationSafety.textContent =
      "Validação e segurança: conteúdo, texto e origem das afirmações validados";
  } else if (mission.validationSafety?.rightsInventory) {
    validationSafety.textContent =
      "Validação e segurança: ativos reais bloqueados até origem e direitos confirmados";
  } else if (mission.validationSafety?.qualityCriteriaMatrix) {
    validationSafety.textContent =
      "Validação e segurança: matriz local de qualidade materializada";
  } else {
    validationSafety.textContent = "Validação e segurança: ainda não iniciada";
  }

  const auditCheckpoints = document.createElement("p");
  auditCheckpoints.className = "mission-audit-checkpoints";
  if (mission.auditCheckpoints?.closure?.readyForAndroidExperience) {
    auditCheckpoints.textContent =
      "Auditoria e checkpoints: estágio fechado e pronto para a experiência Android";
  } else if (mission.auditCheckpoints?.completeValidation) {
    auditCheckpoints.textContent =
      "Auditoria e checkpoints: estágio integralmente validado";
  } else if (mission.auditCheckpoints?.restoreVerification) {
    auditCheckpoints.textContent =
      "Auditoria e checkpoints: restauração estrutural independente verificada";
  } else if (mission.auditCheckpoints?.exportIntegritySeal) {
    auditCheckpoints.textContent =
      "Auditoria e checkpoints: exportação estrutural selada com SHA-256";
  } else if (mission.auditCheckpoints?.structuralExportBundle) {
    auditCheckpoints.textContent =
      "Auditoria e checkpoints: pacote estrutural seguro materializado localmente";
  } else if (mission.auditCheckpoints?.readinessReport) {
    auditCheckpoints.textContent =
      "Auditoria e checkpoints: primeiro relatório persistido; estágio aberto no ponto 85%";
  } else if (mission.auditCheckpoints?.trailValidation) {
    auditCheckpoints.textContent =
      "Auditoria e checkpoints: sequência, vínculos, versões, hashes e fechamentos validados";
  } else if (mission.auditCheckpoints?.exportManifest) {
    auditCheckpoints.textContent =
      "Auditoria e checkpoints: manifesto estrutural seguro sem credenciais, segredos ou mídia real";
  } else if (mission.auditCheckpoints?.checkpointPolicy) {
    auditCheckpoints.textContent =
      "Auditoria e checkpoints: política local de hash, manifesto, segurança e restauração ativa";
  } else if (mission.auditCheckpoints?.auditLedger) {
    auditCheckpoints.textContent =
      "Auditoria e checkpoints: livro-razão local imutável materializado";
  } else {
    auditCheckpoints.textContent = "Auditoria e checkpoints: ainda não iniciados";
  }

  const androidExperience = document.createElement("p");
  androidExperience.className = "mission-android-experience";
  if (mission.androidExperience?.closure?.readyForFieldConnections) {
    androidExperience.textContent =
      "Android: estágio fechado em 95%; teste no aparelho e conexões de campo ainda não iniciados";
  } else if (mission.androidExperience?.completeValidation) {
    androidExperience.textContent =
      "Android: interface local validada; teste em aparelho real permanece pendente";
  } else if (mission.androidExperience?.installabilityPackage) {
    androidExperience.textContent =
      "Android: instalabilidade e shell offline preparados localmente";
  } else if (mission.androidExperience?.ergonomicsContract) {
    androidExperience.textContent =
      "Android: ergonomia móvel aplicada à interface local";
  } else if (mission.androidExperience?.capabilityProfile) {
    androidExperience.textContent =
      "Android: perfil local materializado sem alegar teste em aparelho real";
  } else {
    androidExperience.textContent = "Android: experiência móvel ainda não iniciada";
  }

  const fieldConnections = document.createElement("p");
  fieldConnections.className = "mission-field-connections";
  if (mission.fieldConnections?.internalHandoff) {
    fieldConnections.textContent =
      "Conexões: preparação interna concluída em 99%; aguardando Anderson no ponto 100";
  } else if (mission.fieldConnections?.channelConnectionPlan) {
    fieldConnections.textContent =
      "Conexões: dois canais separados e simulação local preparada, sem conectar contas";
  } else if (mission.fieldConnections?.oauthContract) {
    fieldConnections.textContent =
      "Conexões: contrato Google/YouTube OAuth preparado sem guardar segredos";
  } else if (mission.fieldConnections?.connectorRegistry) {
    fieldConnections.textContent =
      "Conexões: catálogo local materializado; nenhuma tentativa externa executada";
  } else {
    fieldConnections.textContent = "Conexões: estágio de campo ainda não iniciado";
  }

  const metadata = document.createElement("div");
  metadata.className = "mission-meta";

  const status = document.createElement("span");
  const statusLabels = {
    draft: "Rascunho",
    in_progress: "Em andamento",
    paused: "Pausada",
    completed: "Concluída"
  };
  status.textContent = statusLabels[mission.status] ?? mission.status;

  const date = document.createElement("time");
  date.dateTime = mission.createdAt;
  date.textContent = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(mission.createdAt));

  metadata.append(status, date);
  article.append(
    heading,
    project,
    brain,
    strategy,
    retention,
    strategicPackage,
    textPackage,
    scenePackage,
    validationSafety,
    auditCheckpoints,
    androidExperience,
    fieldConnections,
    channel,
    metadata
  );

  if (mission.strategyPackage && !mission.textPackage) {
    const startTextPackageButton = document.createElement("button");
    startTextPackageButton.className = "secondary mission-action";
    startTextPackageButton.type = "button";
    startTextPackageButton.textContent = "Modelar pacote textual";
    startTextPackageButton.addEventListener("click", () =>
      runTextPackageStep(
        mission,
        "text-package",
        `Modelando o pacote textual de “${mission.title}”…`
      )
    );
    article.append(startTextPackageButton);
  } else if (mission.textPackage && !mission.textPackage.titleAsset) {
    const titleButton = document.createElement("button");
    titleButton.className = "secondary mission-action";
    titleButton.type = "button";
    titleButton.textContent = "Materializar título final";
    titleButton.addEventListener("click", () =>
      runTextPackageStep(
        mission,
        "text-package/title",
        `Materializando o título de “${mission.title}”…`
      )
    );
    article.append(titleButton);
  } else if (mission.textPackage && !mission.textPackage.descriptionAsset) {
    const descriptionButton = document.createElement("button");
    descriptionButton.className = "secondary mission-action";
    descriptionButton.type = "button";
    descriptionButton.textContent = "Materializar descrição final";
    descriptionButton.addEventListener("click", () =>
      runTextPackageStep(
        mission,
        "text-package/description",
        `Materializando a descrição de “${mission.title}”…`
      )
    );
    article.append(descriptionButton);
  } else if (mission.textPackage && !mission.textPackage.script) {
    const scriptButton = document.createElement("button");
    scriptButton.className = "secondary mission-action";
    scriptButton.type = "button";
    scriptButton.textContent = "Estruturar roteiro textual";
    scriptButton.addEventListener("click", () =>
      runTextPackageStep(
        mission,
        "text-package/script",
        `Estruturando o roteiro de “${mission.title}”…`
      )
    );
    article.append(scriptButton);
  } else if (mission.textPackage?.script && !mission.textPackage.openingAsset) {
    const openingInput = document.createElement("textarea");
    openingInput.className = "text-opening-input";
    openingInput.rows = 4;
    openingInput.minLength = 20;
    openingInput.maxLength = 1200;
    openingInput.placeholder = "Abertura ligada ao tema, sem promessa nem fato inventado";
    openingInput.setAttribute("aria-label", `Abertura textual de ${mission.title}`);

    const openingButton = document.createElement("button");
    openingButton.className = "secondary mission-action";
    openingButton.type = "button";
    openingButton.textContent = "Criar e validar abertura";
    openingButton.addEventListener("click", () =>
      runTextPackageStep(
        mission,
        "text-package/opening",
        `Validando a abertura de “${mission.title}”…`,
        { text: openingInput.value }
      )
    );
    article.append(openingInput, openingButton);
  } else if (
    mission.textPackage?.openingAsset &&
    !mission.textPackage.progressionAsset
  ) {
    appendTextStageAction(article, mission, {
      stageId: "progression",
      label: "Progressão textual",
      placeholder:
        "Desenvolvimento ligado ao tema e ao objetivo da progressão, sem fatos inventados",
      endpoint: "text-package/progression"
    });
  } else if (
    mission.textPackage?.progressionAsset &&
    !mission.textPackage.reengagementAsset
  ) {
    appendTextStageAction(article, mission, {
      stageId: "reengagement",
      label: "Reengajamento textual",
      placeholder:
        "Retomada de atenção coerente com o tema, sem promessa de resultado",
      endpoint: "text-package/reengagement"
    });
  } else if (
    mission.textPackage?.reengagementAsset &&
    !mission.textPackage.closingAsset
  ) {
    appendTextStageAction(article, mission, {
      stageId: "closing",
      label: "Encerramento textual",
      placeholder:
        "Encerramento coerente com o tema e com a missão, sem alegações inventadas",
      endpoint: "text-package/closing"
    });
  } else if (
    mission.textPackage?.closingAsset &&
    !mission.textPackage.script?.validation
  ) {
    const validationButton = document.createElement("button");
    validationButton.className = "secondary mission-action";
    validationButton.type = "button";
    validationButton.textContent = "Validar roteiro textual completo";
    validationButton.addEventListener("click", () =>
      runTextPackageStep(
        mission,
        "text-package/validate",
        `Validando o roteiro completo de “${mission.title}”…`
      )
    );
    article.append(validationButton);
  } else if (
    mission.textPackage?.script?.validation?.status === "valid" &&
    !mission.textPackage.finalScriptAsset
  ) {
    const finalScriptButton = document.createElement("button");
    finalScriptButton.className = "secondary mission-action";
    finalScriptButton.type = "button";
    finalScriptButton.textContent = "Consolidar roteiro final";
    finalScriptButton.addEventListener("click", () =>
      runTextPackageStep(
        mission,
        "text-package/final-script",
        `Consolidando o roteiro final de “${mission.title}”…`
      )
    );
    article.append(finalScriptButton);
  } else if (
    mission.textPackage?.finalScriptAsset &&
    !mission.textPackage.transitionMapAsset
  ) {
    const transitionsButton = document.createElement("button");
    transitionsButton.className = "secondary mission-action";
    transitionsButton.type = "button";
    transitionsButton.textContent = "Materializar transições";
    transitionsButton.addEventListener("click", () =>
      runTextPackageStep(
        mission,
        "text-package/transitions",
        `Materializando as transições de “${mission.title}”…`
      )
    );
    article.append(transitionsButton);
  } else if (
    mission.textPackage?.transitionMapAsset &&
    !mission.textPackage.safetyOriginRegistry
  ) {
    const safetyOriginsButton = document.createElement("button");
    safetyOriginsButton.className = "secondary mission-action";
    safetyOriginsButton.type = "button";
    safetyOriginsButton.textContent = "Registrar segurança e origem";
    safetyOriginsButton.addEventListener("click", () =>
      runTextPackageStep(
        mission,
        "text-package/safety-origins",
        `Registrando segurança e origem de “${mission.title}”…`
      )
    );
    article.append(safetyOriginsButton);
  } else if (
    mission.textPackage?.safetyOriginRegistry &&
    !mission.textPackage.packageValidation
  ) {
    const packageValidationButton = document.createElement("button");
    packageValidationButton.className = "secondary mission-action";
    packageValidationButton.type = "button";
    packageValidationButton.textContent = "Validar pacote textual integral";
    packageValidationButton.addEventListener("click", () =>
      runTextPackageStep(
        mission,
        "text-package/complete-validation",
        `Validando integralmente o pacote textual de “${mission.title}”…`
      )
    );
    article.append(packageValidationButton);
  } else if (
    mission.textPackage?.packageValidation?.status === "valid" &&
    !mission.textPackage.closure
  ) {
    const closePackageButton = document.createElement("button");
    closePackageButton.className = "secondary mission-action";
    closePackageButton.type = "button";
    closePackageButton.textContent = "Fechar pacote textual";
    closePackageButton.addEventListener("click", () =>
      runTextPackageStep(
        mission,
        "text-package/close",
        `Fechando o pacote textual de “${mission.title}”…`
      )
    );
    article.append(closePackageButton);
  }

  if (mission.textPackage?.closure?.readyForScenePackage) {
    if (!mission.scenePackage) {
      const scenePackageButton = document.createElement("button");
      scenePackageButton.className = "secondary mission-action";
      scenePackageButton.type = "button";
      scenePackageButton.textContent = "Modelar pacote de cenas";
      scenePackageButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package",
          `Modelando o pacote de cenas de “${mission.title}”…`
        )
      );
      article.append(scenePackageButton);
    } else if (!mission.scenePackage.storyboard) {
      const storyboardButton = document.createElement("button");
      storyboardButton.className = "secondary mission-action";
      storyboardButton.type = "button";
      storyboardButton.textContent = "Estruturar storyboard";
      storyboardButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package/storyboard",
          `Estruturando o storyboard de “${mission.title}”…`
        )
      );
      article.append(storyboardButton);
    } else if (!mission.scenePackage.narrationAsset) {
      const narrationButton = document.createElement("button");
      narrationButton.className = "secondary mission-action";
      narrationButton.type = "button";
      narrationButton.textContent = "Materializar narração";
      narrationButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package/narration",
          `Materializando a narração de “${mission.title}”…`
        )
      );
      article.append(narrationButton);
    } else if (!mission.scenePackage.captionPlan) {
      const captionsButton = document.createElement("button");
      captionsButton.className = "secondary mission-action";
      captionsButton.type = "button";
      captionsButton.textContent = "Criar plano de legendas";
      captionsButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package/captions",
          `Criando o plano de legendas de “${mission.title}”…`
        )
      );
      article.append(captionsButton);
    } else if (!mission.scenePackage.visualMap) {
      const visualMapButton = document.createElement("button");
      visualMapButton.className = "secondary mission-action";
      visualMapButton.type = "button";
      visualMapButton.textContent = "Criar mapa visual dinâmico";
      visualMapButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package/visual-map",
          `Criando o mapa visual dinâmico de “${mission.title}”…`
        )
      );
      article.append(visualMapButton);
    } else if (!mission.scenePackage.sceneUnitPlan) {
      const sceneUnitsButton = document.createElement("button");
      sceneUnitsButton.className = "secondary mission-action";
      sceneUnitsButton.type = "button";
      sceneUnitsButton.textContent = "Materializar unidades de cena";
      sceneUnitsButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package/units",
          `Materializando unidades locais de cena de “${mission.title}”…`
        )
      );
      article.append(sceneUnitsButton);
    } else if (!mission.scenePackage.durationPlan) {
      const durationButton = document.createElement("button");
      durationButton.className = "secondary mission-action";
      durationButton.type = "button";
      durationButton.textContent = "Estimar duração local";
      durationButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package/duration-plan",
          `Estimando a duração local de “${mission.title}”…`
        )
      );
      article.append(durationButton);
    } else if (!mission.scenePackage.synchronizationPlan) {
      const synchronizationButton = document.createElement("button");
      synchronizationButton.className = "secondary mission-action";
      synchronizationButton.type = "button";
      synchronizationButton.textContent = "Sincronizar estrutura";
      synchronizationButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package/synchronization",
          `Sincronizando a estrutura de “${mission.title}”…`
        )
      );
      article.append(synchronizationButton);
    } else if (!mission.scenePackage.motionPlan) {
      const motionButton = document.createElement("button");
      motionButton.className = "secondary mission-action";
      motionButton.type = "button";
      motionButton.textContent = "Materializar movimento e transições";
      motionButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package/motion-transitions",
          `Materializando movimento e transições de “${mission.title}”…`
        )
      );
      article.append(motionButton);
    } else if (!mission.scenePackage.integratedExecutionPlan) {
      const integratedPlanButton = document.createElement("button");
      integratedPlanButton.className = "secondary mission-action";
      integratedPlanButton.type = "button";
      integratedPlanButton.textContent = "Validar plano integrado de cenas";
      integratedPlanButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package/integrated-plan",
          `Validando o plano integrado de cenas de “${mission.title}”…`
        )
      );
      article.append(integratedPlanButton);
    } else if (!mission.scenePackage.mediaRequirementsPlan) {
      const mediaRequirementsButton = document.createElement("button");
      mediaRequirementsButton.className = "secondary mission-action";
      mediaRequirementsButton.type = "button";
      mediaRequirementsButton.textContent = "Materializar requisitos de mídia";
      mediaRequirementsButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package/media-requirements",
          `Materializando requisitos de mídia de “${mission.title}”…`
        )
      );
      article.append(mediaRequirementsButton);
    } else if (!mission.scenePackage.audioLayerPlan) {
      const audioLayersButton = document.createElement("button");
      audioLayersButton.className = "secondary mission-action";
      audioLayersButton.type = "button";
      audioLayersButton.textContent = "Estruturar camadas de áudio";
      audioLayersButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package/audio-layers",
          `Estruturando camadas de áudio de “${mission.title}”…`
        )
      );
      article.append(audioLayersButton);
    } else if (!mission.scenePackage.compositionPlan) {
      const compositionButton = document.createElement("button");
      compositionButton.className = "secondary mission-action";
      compositionButton.type = "button";
      compositionButton.textContent = "Estruturar composição";
      compositionButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package/composition",
          `Estruturando a composição de “${mission.title}”…`
        )
      );
      article.append(compositionButton);
    } else if (!mission.scenePackage.renderPlan) {
      const renderPlanButton = document.createElement("button");
      renderPlanButton.className = "secondary mission-action";
      renderPlanButton.type = "button";
      renderPlanButton.textContent = "Planejar renderização local";
      renderPlanButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package/render-plan",
          `Planejando a renderização local de “${mission.title}”…`
        )
      );
      article.append(renderPlanButton);
    } else if (!mission.scenePackage.closure) {
      const closeScenePackageButton = document.createElement("button");
      closeScenePackageButton.className = "secondary mission-action";
      closeScenePackageButton.type = "button";
      closeScenePackageButton.textContent = "Validar e fechar pacote de cenas";
      closeScenePackageButton.addEventListener("click", () =>
        runScenePackageStep(
          mission,
          "scene-package/close",
          `Validando e fechando o pacote de cenas de “${mission.title}”…`
        )
      );
      article.append(closeScenePackageButton);
    }
  }

  if (mission.scenePackage?.closure?.readyForValidationSafety) {
    if (!mission.validationSafety) {
      const qualityMatrixButton = document.createElement("button");
      qualityMatrixButton.className = "secondary mission-action";
      qualityMatrixButton.type = "button";
      qualityMatrixButton.textContent = "Materializar matriz de qualidade";
      qualityMatrixButton.addEventListener("click", () =>
        runValidationSafetyStep(
          mission,
          "validation-safety/quality-matrix",
          `Materializando a matriz de qualidade de “${mission.title}”…`
        )
      );
      article.append(qualityMatrixButton);
    } else if (!mission.validationSafety.rightsInventory) {
      const rightsInventoryButton = document.createElement("button");
      rightsInventoryButton.className = "secondary mission-action";
      rightsInventoryButton.type = "button";
      rightsInventoryButton.textContent = "Criar bloqueio de direitos";
      rightsInventoryButton.addEventListener("click", () =>
        runValidationSafetyStep(
          mission,
          "validation-safety/rights-inventory",
          `Criando o inventário de direitos de “${mission.title}”…`
        )
      );
      article.append(rightsInventoryButton);
    } else if (!mission.validationSafety.contentSafetyValidation) {
      const contentSafetyButton = document.createElement("button");
      contentSafetyButton.className = "secondary mission-action";
      contentSafetyButton.type = "button";
      contentSafetyButton.textContent = "Validar conteúdo e origem";
      contentSafetyButton.addEventListener("click", () =>
        runValidationSafetyStep(
          mission,
          "validation-safety/content-safety",
          `Validando conteúdo e origem de “${mission.title}”…`
        )
      );
      article.append(contentSafetyButton);
    } else if (!mission.validationSafety.operationalLocks) {
      const operationalLocksButton = document.createElement("button");
      operationalLocksButton.className = "secondary mission-action";
      operationalLocksButton.type = "button";
      operationalLocksButton.textContent = "Validar bloqueios operacionais";
      operationalLocksButton.addEventListener("click", () =>
        runValidationSafetyStep(
          mission,
          "validation-safety/operational-locks",
          `Validando os bloqueios operacionais de “${mission.title}”…`
        )
      );
      article.append(operationalLocksButton);
    } else if (!mission.validationSafety.integratedReport) {
      const validationReportButton = document.createElement("button");
      validationReportButton.className = "secondary mission-action";
      validationReportButton.type = "button";
      validationReportButton.textContent = "Consolidar relatório integrado";
      validationReportButton.addEventListener("click", () =>
        runValidationSafetyStep(
          mission,
          "validation-safety/integrated-report",
          `Consolidando o relatório integrado de “${mission.title}”…`
        )
      );
      article.append(validationReportButton);
    } else if (!mission.validationSafety.integritySnapshot) {
      const integrityButton = document.createElement("button");
      integrityButton.className = "secondary mission-action";
      integrityButton.type = "button";
      integrityButton.textContent = "Selar integridade das fontes";
      integrityButton.addEventListener("click", () =>
        runValidationSafetyStep(
          mission,
          "validation-safety/integrity-snapshot",
          `Selando a integridade das fontes de “${mission.title}”…`
        )
      );
      article.append(integrityButton);
    } else if (!mission.validationSafety.rightsReadinessGate) {
      const rightsReadinessButton = document.createElement("button");
      rightsReadinessButton.className = "secondary mission-action";
      rightsReadinessButton.type = "button";
      rightsReadinessButton.textContent = "Avaliar liberação de direitos";
      rightsReadinessButton.addEventListener("click", () =>
        runValidationSafetyStep(
          mission,
          "validation-safety/rights-readiness",
          `Avaliando a liberação de direitos de “${mission.title}”…`
        )
      );
      article.append(rightsReadinessButton);
    } else if (!mission.validationSafety.enforcementPolicy) {
      const enforcementPolicyButton = document.createElement("button");
      enforcementPolicyButton.className = "secondary mission-action";
      enforcementPolicyButton.type = "button";
      enforcementPolicyButton.textContent = "Ativar política de bloqueio";
      enforcementPolicyButton.addEventListener("click", () =>
        runValidationSafetyStep(
          mission,
          "validation-safety/enforcement-policy",
          `Ativando a política local de bloqueio de “${mission.title}”…`
        )
      );
      article.append(enforcementPolicyButton);
    } else if (!mission.validationSafety.completeValidation) {
      const completeValidationButton = document.createElement("button");
      completeValidationButton.className = "secondary mission-action";
      completeValidationButton.type = "button";
      completeValidationButton.textContent = "Validar estágio completo";
      completeValidationButton.addEventListener("click", () =>
        runValidationSafetyStep(
          mission,
          "validation-safety/complete-validation",
          `Validando o estágio completo de “${mission.title}”…`
        )
      );
      article.append(completeValidationButton);
    } else if (!mission.validationSafety.closure) {
      const closeValidationSafetyButton = document.createElement("button");
      closeValidationSafetyButton.className = "secondary mission-action";
      closeValidationSafetyButton.type = "button";
      closeValidationSafetyButton.textContent = "Fechar validação e segurança";
      closeValidationSafetyButton.addEventListener("click", () =>
        runValidationSafetyStep(
          mission,
          "validation-safety/close",
          `Fechando validação e segurança de “${mission.title}”…`
        )
      );
      article.append(closeValidationSafetyButton);
    }
  }

  if (mission.validationSafety?.closure?.readyForAuditCheckpoints) {
    if (!mission.auditCheckpoints) {
      const auditLedgerButton = document.createElement("button");
      auditLedgerButton.className = "secondary mission-action";
      auditLedgerButton.type = "button";
      auditLedgerButton.textContent = "Materializar livro-razão de auditoria";
      auditLedgerButton.addEventListener("click", () =>
        runAuditCheckpointsStep(
          mission,
          "audit-checkpoints/ledger",
          `Materializando o livro-razão de “${mission.title}”…`
        )
      );
      article.append(auditLedgerButton);
    } else if (!mission.auditCheckpoints.checkpointPolicy) {
      const checkpointPolicyButton = document.createElement("button");
      checkpointPolicyButton.className = "secondary mission-action";
      checkpointPolicyButton.type = "button";
      checkpointPolicyButton.textContent = "Ativar política de checkpoints";
      checkpointPolicyButton.addEventListener("click", () =>
        runAuditCheckpointsStep(
          mission,
          "audit-checkpoints/checkpoint-policy",
          `Ativando a política de checkpoints de “${mission.title}”…`
        )
      );
      article.append(checkpointPolicyButton);
    } else if (!mission.auditCheckpoints.exportManifest) {
      const exportManifestButton = document.createElement("button");
      exportManifestButton.className = "secondary mission-action";
      exportManifestButton.type = "button";
      exportManifestButton.textContent = "Materializar manifesto seguro";
      exportManifestButton.addEventListener("click", () =>
        runAuditCheckpointsStep(
          mission,
          "audit-checkpoints/safe-export-manifest",
          `Materializando o manifesto seguro de “${mission.title}”…`
        )
      );
      article.append(exportManifestButton);
    } else if (!mission.auditCheckpoints.trailValidation) {
      const auditValidationButton = document.createElement("button");
      auditValidationButton.className = "secondary mission-action";
      auditValidationButton.type = "button";
      auditValidationButton.textContent = "Validar trilha de auditoria";
      auditValidationButton.addEventListener("click", () =>
        runAuditCheckpointsStep(
          mission,
          "audit-checkpoints/validate",
          `Validando a trilha de auditoria de “${mission.title}”…`
        )
      );
      article.append(auditValidationButton);
    } else if (!mission.auditCheckpoints.readinessReport) {
      const auditReportButton = document.createElement("button");
      auditReportButton.className = "secondary mission-action";
      auditReportButton.type = "button";
      auditReportButton.textContent = "Consolidar relatório de auditoria";
      auditReportButton.addEventListener("click", () =>
        runAuditCheckpointsStep(
          mission,
          "audit-checkpoints/readiness-report",
          `Consolidando o relatório de auditoria de “${mission.title}”…`
        )
      );
      article.append(auditReportButton);
    } else if (!mission.auditCheckpoints.structuralExportBundle) {
      const structuralExportButton = document.createElement("button");
      structuralExportButton.className = "secondary mission-action";
      structuralExportButton.type = "button";
      structuralExportButton.textContent = "Materializar exportação estrutural";
      structuralExportButton.addEventListener("click", () =>
        runAuditCheckpointsStep(
          mission,
          "audit-checkpoints/structural-export",
          `Materializando a exportação estrutural de “${mission.title}”…`
        )
      );
      article.append(structuralExportButton);
    } else if (!mission.auditCheckpoints.exportIntegritySeal) {
      const exportIntegrityButton = document.createElement("button");
      exportIntegrityButton.className = "secondary mission-action";
      exportIntegrityButton.type = "button";
      exportIntegrityButton.textContent = "Selar integridade da exportação";
      exportIntegrityButton.addEventListener("click", () =>
        runAuditCheckpointsStep(
          mission,
          "audit-checkpoints/export-integrity",
          `Selando a integridade da exportação de “${mission.title}”…`
        )
      );
      article.append(exportIntegrityButton);
    } else if (!mission.auditCheckpoints.restoreVerification) {
      const restoreVerificationButton = document.createElement("button");
      restoreVerificationButton.className = "secondary mission-action";
      restoreVerificationButton.type = "button";
      restoreVerificationButton.textContent = "Verificar restauração estrutural";
      restoreVerificationButton.addEventListener("click", () =>
        runAuditCheckpointsStep(
          mission,
          "audit-checkpoints/restore-verification",
          `Verificando a restauração estrutural de “${mission.title}”…`
        )
      );
      article.append(restoreVerificationButton);
    } else if (!mission.auditCheckpoints.completeValidation) {
      const completeAuditValidationButton = document.createElement("button");
      completeAuditValidationButton.className = "secondary mission-action";
      completeAuditValidationButton.type = "button";
      completeAuditValidationButton.textContent = "Validar auditoria completa";
      completeAuditValidationButton.addEventListener("click", () =>
        runAuditCheckpointsStep(
          mission,
          "audit-checkpoints/complete-validation",
          `Validando audit-checkpoints de “${mission.title}”…`
        )
      );
      article.append(completeAuditValidationButton);
    } else if (!mission.auditCheckpoints.closure) {
      const closeAuditCheckpointsButton = document.createElement("button");
      closeAuditCheckpointsButton.className = "secondary mission-action";
      closeAuditCheckpointsButton.type = "button";
      closeAuditCheckpointsButton.textContent = "Fechar auditoria e checkpoints";
      closeAuditCheckpointsButton.addEventListener("click", () =>
        runAuditCheckpointsStep(
          mission,
          "audit-checkpoints/close",
          `Fechando auditoria e checkpoints de “${mission.title}”…`
        )
      );
      article.append(closeAuditCheckpointsButton);
    }
  }

  if (mission.auditCheckpoints?.closure?.readyForAndroidExperience) {
    if (!mission.androidExperience) {
      const capabilityButton = document.createElement("button");
      capabilityButton.className = "secondary mission-action";
      capabilityButton.type = "button";
      capabilityButton.textContent = "Materializar perfil Android local";
      capabilityButton.addEventListener("click", () =>
        runAndroidExperienceStep(
          mission,
          "android-experience/capability-profile",
          `Materializando o perfil Android de “${mission.title}”…`
        )
      );
      article.append(capabilityButton);
    } else if (!mission.androidExperience.ergonomicsContract) {
      const ergonomicsButton = document.createElement("button");
      ergonomicsButton.className = "secondary mission-action";
      ergonomicsButton.type = "button";
      ergonomicsButton.textContent = "Aplicar ergonomia móvel";
      ergonomicsButton.addEventListener("click", () =>
        runAndroidExperienceStep(
          mission,
          "android-experience/ergonomics",
          `Aplicando ergonomia móvel em “${mission.title}”…`
        )
      );
      article.append(ergonomicsButton);
    } else if (!mission.androidExperience.installabilityPackage) {
      const installabilityButton = document.createElement("button");
      installabilityButton.className = "secondary mission-action";
      installabilityButton.type = "button";
      installabilityButton.textContent = "Preparar operação offline local";
      installabilityButton.addEventListener("click", () =>
        runAndroidExperienceStep(
          mission,
          "android-experience/offline-installability",
          `Preparando a operação offline local de “${mission.title}”…`
        )
      );
      article.append(installabilityButton);
    } else if (!mission.androidExperience.completeValidation) {
      const validationButton = document.createElement("button");
      validationButton.className = "secondary mission-action";
      validationButton.type = "button";
      validationButton.textContent = "Validar experiência Android";
      validationButton.addEventListener("click", () =>
        runAndroidExperienceStep(
          mission,
          "android-experience/validate",
          `Validando a experiência Android de “${mission.title}”…`
        )
      );
      article.append(validationButton);
    } else if (!mission.androidExperience.closure) {
      const closeButton = document.createElement("button");
      closeButton.className = "secondary mission-action";
      closeButton.type = "button";
      closeButton.textContent = "Fechar prontidão Android";
      closeButton.addEventListener("click", () =>
        runAndroidExperienceStep(
          mission,
          "android-experience/close",
          `Fechando a prontidão Android de “${mission.title}”…`
        )
      );
      article.append(closeButton);
    }
  }

  if (mission.androidExperience?.closure?.readyForFieldConnections) {
    if (!mission.fieldConnections) {
      const registryButton = document.createElement("button");
      registryButton.className = "secondary mission-action";
      registryButton.type = "button";
      registryButton.textContent = "Preparar catálogo de conectores";
      registryButton.addEventListener("click", () =>
        runFieldConnectionsStep(
          mission,
          "field-connections/registry",
          `Preparando o catálogo de conectores de “${mission.title}”…`
        )
      );
      article.append(registryButton);
    } else if (!mission.fieldConnections.oauthContract) {
      const oauthButton = document.createElement("button");
      oauthButton.className = "secondary mission-action";
      oauthButton.type = "button";
      oauthButton.textContent = "Preparar contrato Google e YouTube";
      oauthButton.addEventListener("click", () =>
        runFieldConnectionsStep(
          mission,
          "field-connections/oauth-contract",
          `Preparando o contrato OAuth de “${mission.title}”…`
        )
      );
      article.append(oauthButton);
    } else if (!mission.fieldConnections.channelConnectionPlan) {
      const channelPlanButton = document.createElement("button");
      channelPlanButton.className = "secondary mission-action";
      channelPlanButton.type = "button";
      channelPlanButton.textContent = "Preparar plano dos dois canais";
      channelPlanButton.addEventListener("click", () =>
        runFieldConnectionsStep(
          mission,
          "field-connections/channel-plan",
          `Preparando os dois canais de “${mission.title}”…`
        )
      );
      article.append(channelPlanButton);
    } else if (!mission.fieldConnections.internalHandoff) {
      const handoffButton = document.createElement("button");
      handoffButton.className = "secondary mission-action";
      handoffButton.type = "button";
      handoffButton.textContent = "Concluir preparação interna";
      handoffButton.addEventListener("click", () =>
        runFieldConnectionsStep(
          mission,
          "field-connections/internal-handoff",
          `Concluindo a preparação interna de “${mission.title}”…`
        )
      );
      article.append(handoffButton);
    } else {
      const manualGate = document.createElement("section");
      manualGate.className = "field-manual-gate";
      manualGate.setAttribute("aria-label", "Próxima ação manual protegida");
      const manualTitle = document.createElement("strong");
      manualTitle.textContent = "Ponto 100 protegido";
      const manualCopy = document.createElement("p");
      manualCopy.textContent =
        "A próxima etapa exige Anderson. O A conduzirá uma tela por vez, com print, sem pedir senhas ou segredos no chat.";
      manualGate.append(manualTitle, manualCopy);
      article.append(manualGate);
    }
  }

  if (mission.status === "paused") {
    const resumeButton = document.createElement("button");
    resumeButton.className = "secondary mission-action";
    resumeButton.type = "button";
    resumeButton.textContent = "Retomar missão";
    resumeButton.addEventListener("click", async () => {
      setStatus(`Retomando “${mission.title}”…`);
      try {
        const response = await fetch(`/api/missions/${mission.id}/resume`, {
          method: "POST"
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error ?? "Não foi possível retomar a missão.");
        }
        setStatus(`Missão “${result.mission.title}” retomada.`, "success");
        await loadMissions();
      } catch (error) {
        setStatus(error.message, "error");
      }
    });
    article.append(resumeButton);
  }
  return article;
}

function createProjectCard(project) {
  const article = document.createElement("article");
  article.className = "project-card";
  article.dataset.permissionMode = getProjectPermissionMode(project);

  const heading = document.createElement("h3");
  heading.textContent = project.name;

  const metadata = document.createElement("div");
  metadata.className = "mission-meta";

  const status = document.createElement("span");
  status.textContent = project.status === "archived" ? "Projeto arquivado" : "Projeto ativo";

  const permission = document.createElement("p");
  permission.className = "project-permission";
  const isReadOnly = getProjectPermissionMode(project) === "read_only";
  permission.textContent = isReadOnly
    ? "Permissão local: somente leitura"
    : "Permissão local: leitura e alteração";

  const date = document.createElement("time");
  date.dateTime = project.createdAt;
  date.textContent = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(project.createdAt));

  metadata.append(status, date);
  article.append(heading, permission, metadata);

  const permissionButton = document.createElement("button");
  permissionButton.className = "secondary mission-action";
  permissionButton.type = "button";
  permissionButton.textContent = isReadOnly
    ? "Permitir alterações locais"
    : "Proteger como somente leitura";
  permissionButton.addEventListener("click", async () => {
    const mode = isReadOnly ? "read_write" : "read_only";
    setStatus(`Atualizando a permissão de “${project.name}”…`);
    try {
      const response = await fetch(`/api/projects/${project.id}/permissions`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível atualizar a permissão local.");
      }
      setStatus(`Permissão local de “${result.project.name}” atualizada.`, "success");
      await Promise.all([loadProjects(), loadMissions()]);
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
  article.append(permissionButton);

  if (project.status === "active") {
    const archiveButton = document.createElement("button");
    archiveButton.className = "secondary mission-action";
    archiveButton.type = "button";
    archiveButton.textContent = "Arquivar projeto";
    archiveButton.addEventListener("click", async () => {
      setStatus(`Arquivando “${project.name}”…`);
      try {
        const response = await fetch(`/api/projects/${project.id}/archive`, {
          method: "POST"
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error ?? "Não foi possível arquivar o projeto.");
        }
        setStatus(`Projeto “${result.project.name}” arquivado sem apagar dados.`, "success");
        await loadProjects();
      } catch (error) {
        setStatus(error.message, "error");
      }
    });
    article.append(archiveButton);
  }
  return article;
}

async function loadChannels() {
  const response = await fetch("/api/channels");
  if (!response.ok) {
    throw new Error("Não foi possível carregar os canais piloto.");
  }

  const { channels } = await response.json();
  channelSelect.replaceChildren(new Option("Escolha um canal", ""));
  for (const channel of channels) {
    channelSelect.add(new Option(channel.name, channel.id));
  }
}

async function loadMissions() {
  missionList.textContent = "Carregando…";
  const response = await fetch("/api/missions");
  if (!response.ok) {
    throw new Error("Não foi possível abrir as missões salvas.");
  }

  const { missions } = await response.json();
  missionList.replaceChildren();

  if (missions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Nenhuma missão foi criada ainda.";
    missionList.append(empty);
    return;
  }

  for (const mission of missions) {
    missionList.append(createMissionCard(mission));
  }
}

async function loadProgress() {
  const response = await fetch("/api/progress");
  if (!response.ok) {
    throw new Error("Não foi possível verificar o progresso do software.");
  }

  const progress = await response.json();
  progressValue.textContent = String(progress.percentage);
  progressTrack.setAttribute("aria-valuenow", String(progress.percentage));
  progressFill.style.width = `${progress.percentage}%`;
  progressNext.textContent = progress.next
    ? `Próximo: ${progress.next.label} (+${progress.next.remainingPoints ?? progress.next.points} pontos).`
    : "Software concluído e validado.";
}

async function loadCoreValidation() {
  coreValidationStatus.textContent = "Validando projetos, missões e vínculos locais…";
  coreValidationStatus.dataset.kind = "";
  validateCoreButton.disabled = true;

  try {
    const response = await fetch("/api/core/validation");
    if (!response.ok) {
      throw new Error("Não foi possível validar o núcleo local.");
    }

    const report = await response.json();
    coreValidationStatus.dataset.kind = report.valid ? "success" : "error";
    coreValidationStatus.textContent = report.valid
      ? `Núcleo íntegro: ${report.counts.projects} projeto(s), ${report.counts.missions} missão(ões) e ${report.counts.assignedBrains} cérebro(s) aplicado(s).`
      : `Validação encontrou ${report.counts.issues} inconsistência(s) local(is).`;
  } finally {
    validateCoreButton.disabled = false;
  }
}

async function loadProjects() {
  projectList.textContent = "Carregando…";
  const response = await fetch("/api/projects");
  if (!response.ok) {
    throw new Error("Não foi possível abrir os projetos preservados.");
  }

  const { projects } = await response.json();
  projectList.replaceChildren();
  const selectedProjectId = projectSelect.value;
  projectSelect.replaceChildren(new Option("Escolha um projeto", ""));

  const activeProjects = projects.filter(
    (project) =>
      project.status === "active" && getProjectPermissionMode(project) === "read_write"
  );
  for (const project of activeProjects) {
    projectSelect.add(new Option(project.name, project.id));
  }

  if (activeProjects.some((project) => project.id === selectedProjectId)) {
    projectSelect.value = selectedProjectId;
  }

  if (activeProjects.length === 0) {
    projectSelect.options[0].textContent = "Nenhum projeto preservado";
  }

  if (projects.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Nenhum projeto foi cadastrado ainda.";
    projectList.append(empty);
    return;
  }

  for (const project of projects) {
    projectList.append(createProjectCard(project));
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Salvando missão…");

  try {
    const response = await fetch("/api/missions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: titleInput.value,
        projectId: projectSelect.value,
        channelId: channelSelect.value
      })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error ?? "Não foi possível salvar a missão.");
    }

    form.reset();
    setStatus(`Missão “${result.mission.title}” salva.`, "success");
    await loadMissions();
    titleInput.focus();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

refreshButton.addEventListener("click", () => {
  loadMissions().catch((error) => setStatus(error.message, "error"));
});

refreshProjectsButton.addEventListener("click", () => {
  loadProjects().catch((error) => setStatus(error.message, "error"));
});

validateCoreButton.addEventListener("click", () => {
  loadCoreValidation().catch((error) => {
    coreValidationStatus.textContent = error.message;
    coreValidationStatus.dataset.kind = "error";
  });
});

function updateConnectionStatus() {
  const online = navigator.onLine;
  localStatus.dataset.offline = String(!online);
  localStatus.textContent = online
    ? "Núcleo local"
    : "Shell offline · alterações bloqueadas";
}

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
updateConnectionStatus();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch(() => {
    localStatus.dataset.offline = "true";
    localStatus.textContent = "Instalação local pendente";
  });
}

Promise.all([
  loadChannels(),
  loadMissions(),
  loadProjects(),
  loadProgress(),
  loadCoreValidation()
]).catch((error) => setStatus(error.message, "error"));


createStarterProjectButton?.addEventListener("click", () => {
  if (!window.IAAChromeRuntime?.createStarterProject) {
    setStatus("O modo Chrome não está disponível.", "error");
    return;
  }
  window.IAAChromeRuntime.createStarterProject();
});
