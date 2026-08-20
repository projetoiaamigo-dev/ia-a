import { randomUUID } from "./crypto-browser.js";
import { inspectTextPackage } from "./text-package.js";

const STAGE_IDS = Object.freeze([
  "opening",
  "progression",
  "reengagement",
  "closing"
]);

export class ScenePackageValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ScenePackageValidationError";
  }
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function stageAssets(textPackage) {
  return [
    textPackage.openingAsset,
    textPackage.progressionAsset,
    textPackage.reengagementAsset,
    textPackage.closingAsset
  ];
}

function countWords(text) {
  return String(text).trim().split(/\s+/u).filter(Boolean).length;
}

function estimateNarrationDurationMs(text) {
  const wordsPerMinute = 150;
  return Math.max(2_000, Math.ceil((countWords(text) / wordsPerMinute) * 60_000));
}

function allocateEstimatedWindows(units, durationMs, startMs) {
  return units.map((unit, index) => {
    const unitStartMs = startMs + Math.floor((durationMs * index) / units.length);
    const unitEndMs =
      startMs + Math.floor((durationMs * (index + 1)) / units.length);
    return {
      id: `${unit.id}-duration`,
      sceneUnitId: unit.id,
      estimatedStartMs: unitStartMs,
      estimatedEndMs: unitEndMs,
      estimatedDurationMs: unitEndMs - unitStartMs,
      exactStartMs: null,
      exactEndMs: null,
      exactDurationMs: null,
      timingStatus: "local_estimate_without_audio"
    };
  });
}

function expectedSceneUnitInputs(scenePackage) {
  if (!scenePackage.visualMap) return [];
  return scenePackage.visualMap.stagePlans.flatMap((stagePlan, stageIndex) => {
    const narrationSegment = scenePackage.narrationAsset.segments[stageIndex];
    const captionCue = scenePackage.captionPlan.cues[stageIndex];
    return stagePlan.visualBeats.map((visualBeat, beatIndex) => ({
      stagePlan,
      stageIndex,
      narrationSegment,
      captionCue,
      visualBeat,
      beatIndex
    }));
  });
}

function assertTextPackageReady(mission) {
  const textInspection = inspectTextPackage(mission);
  const textPackage = mission?.textPackage;
  if (
    !textInspection.valid ||
    textPackage?.status !== "ready_for_scene_package" ||
    textPackage.closure?.status !== "closed" ||
    textPackage.closure?.readyForScenePackage !== true ||
    textPackage.closure?.nextStage !== "scene_package" ||
    textPackage.packageValidation?.status !== "valid"
  ) {
    throw new ScenePackageValidationError(
      "O pacote textual precisa estar fechado, íntegro e pronto para scene-package."
    );
  }
  return textPackage;
}

function expectedSource(mission) {
  const textPackage = mission.textPackage;
  return {
    textPackageId: textPackage.id,
    textPackageClosureId: textPackage.closure.id,
    finalScriptAssetId: textPackage.finalScriptAsset.id,
    packageValidationId: textPackage.packageValidation.id,
    theme: textPackage.sourceContext.theme,
    themeClassification: textPackage.sourceContext.themeClassification,
    channelId: mission.channel.id,
    brainId: mission.brain.id,
    brainProfileVersion: mission.brain.profileVersion
  };
}

function collectScenePackageIssues(mission) {
  const scenePackage = mission?.scenePackage;
  if (!scenePackage) return [];

  const issues = [];
  let textPackage;
  try {
    textPackage = assertTextPackageReady(mission);
  } catch {
    return ["scene_source_text_package_invalid"];
  }

  const source = expectedSource(mission);
  if (
    scenePackage.missionId !== mission.id ||
    scenePackage.mode !== "local_scene_planning_only" ||
    scenePackage.externalConnections !== false ||
    scenePackage.classification !== "implementation_new_reconstruction"
  ) {
    issues.push("scene_package_identity_invalid");
  }
  if (
    Object.entries(source).some(
      ([key, value]) => scenePackage.source?.[key] !== value
    )
  ) {
    issues.push("scene_package_source_invalid");
  }
  if (
    scenePackage.safety?.singleStaticImageAllowed !== false ||
    scenePackage.safety?.dynamicVisualRequired !== true ||
    scenePackage.safety?.publishesContent !== false ||
    scenePackage.safety?.connectsAccount !== false ||
    scenePackage.safety?.requestsCredentials !== false ||
    scenePackage.safety?.createsCharge !== false ||
    scenePackage.safety?.requiresRightsClearedMedia !== true
  ) {
    issues.push("scene_package_safety_invalid");
  }

  const assets = stageAssets(textPackage);
  const storyboard = scenePackage.storyboard;
  const transitions = textPackage.transitionMapAsset.transitions;
  if (
    storyboard &&
    (storyboard.kind !== "scene_storyboard" ||
      storyboard.status !== "structured" ||
      storyboard.scenePackageId !== scenePackage.id ||
      storyboard.finalScriptAssetId !== textPackage.finalScriptAsset.id ||
      !arraysEqual(storyboard.order, STAGE_IDS) ||
      !Array.isArray(storyboard.segments) ||
      storyboard.segments.length !== STAGE_IDS.length ||
      STAGE_IDS.some((stageId, index) => {
        const segment = storyboard.segments[index];
        return (
          segment?.sequence !== index + 1 ||
          segment?.stageId !== stageId ||
          segment?.textAssetId !== assets[index]?.id ||
          segment?.text !== assets[index]?.text ||
          segment?.retentionObjective !==
            mission.retentionPlan.stages[index]?.objective ||
          segment?.incomingTransitionId !==
            (index === 0 ? null : transitions[index - 1]?.id) ||
          segment?.outgoingTransitionId !==
            (index === STAGE_IDS.length - 1 ? null : transitions[index]?.id) ||
          segment?.dynamicVisualRequired !== true ||
          segment?.minimumVisualBeats !== 2
        );
      }) ||
      storyboard.safety?.addsClaims !== false ||
      storyboard.safety?.altersScriptText !== false ||
      storyboard.externalConnections !== false)
  ) {
    issues.push("scene_storyboard_invalid");
  }

  const narration = scenePackage.narrationAsset;
  if (narration && !storyboard) {
    issues.push("scene_narration_before_storyboard");
  }
  if (
    narration &&
    (narration.kind !== "narration_script" ||
      narration.status !== "materialized" ||
      narration.storyboardId !== storyboard?.id ||
      narration.language !== "pt-BR" ||
      narration.voiceExecution !== "not_started" ||
      narration.audioFile !== null ||
      !Array.isArray(narration.segments) ||
      narration.segments.length !== STAGE_IDS.length ||
      STAGE_IDS.some((stageId, index) => {
        const narrationSegment = narration.segments[index];
        const storyboardSegment = storyboard?.segments?.[index];
        return (
          narrationSegment?.sequence !== index + 1 ||
          narrationSegment?.stageId !== stageId ||
          narrationSegment?.storyboardSegmentId !== storyboardSegment?.id ||
          narrationSegment?.textAssetId !== storyboardSegment?.textAssetId ||
          narrationSegment?.text !== storyboardSegment?.text
        );
      }) ||
      narration.safety?.verbatimValidatedScript !== true ||
      narration.safety?.addsClaims !== false ||
      narration.externalConnections !== false)
  ) {
    issues.push("scene_narration_invalid");
  }

  const captions = scenePackage.captionPlan;
  if (captions && !narration) {
    issues.push("scene_captions_before_narration");
  }
  if (
    captions &&
    (captions.kind !== "caption_plan" ||
      captions.status !== "structured" ||
      captions.narrationAssetId !== narration?.id ||
      captions.language !== "pt-BR" ||
      captions.timingStatus !== "pending_scene_timing" ||
      !Array.isArray(captions.cues) ||
      captions.cues.length !== STAGE_IDS.length ||
      STAGE_IDS.some((stageId, index) => {
        const cue = captions.cues[index];
        const narrationSegment = narration?.segments?.[index];
        return (
          cue?.sequence !== index + 1 ||
          cue?.stageId !== stageId ||
          cue?.narrationSegmentId !== narrationSegment?.id ||
          cue?.text !== narrationSegment?.text ||
          cue?.timingStatus !== "pending_scene_timing" ||
          cue?.synchronizationBasis !== "narration_segment_sequence"
        );
      }) ||
      captions.safety?.addsText !== false ||
      captions.externalConnections !== false)
  ) {
    issues.push("scene_caption_plan_invalid");
  }

  const visualMap = scenePackage.visualMap;
  if (visualMap && !captions) {
    issues.push("scene_visual_map_before_captions");
  }
  if (
    visualMap &&
    (visualMap.kind !== "dynamic_visual_map" ||
      visualMap.status !== "validated" ||
      visualMap.storyboardId !== storyboard?.id ||
      visualMap.captionPlanId !== captions?.id ||
      visualMap.singleStaticImageAllowed !== false ||
      !Array.isArray(visualMap.stagePlans) ||
      visualMap.stagePlans.length !== STAGE_IDS.length ||
      STAGE_IDS.some((stageId, index) => {
        const plan = visualMap.stagePlans[index];
        const storyboardSegment = storyboard?.segments?.[index];
        return (
          plan?.sequence !== index + 1 ||
          plan?.stageId !== stageId ||
          plan?.storyboardSegmentId !== storyboardSegment?.id ||
          plan?.textAssetId !== storyboardSegment?.textAssetId ||
          !Array.isArray(plan?.visualBeats) ||
          plan.visualBeats.length < 2 ||
          plan.visualBeats.some(
            (beat, beatIndex) =>
              beat.sequence !== beatIndex + 1 ||
              beat.source !== "structural_visual_placeholder" ||
              beat.motionRequired !== true ||
              beat.stillOnly !== false ||
              beat.externalAssetId !== null ||
              beat.rightsStatus !== "required_before_use"
          )
        );
      }) ||
      visualMap.safety?.addsClaims !== false ||
      visualMap.safety?.requiresRightsClearedMedia !== true ||
      visualMap.externalConnections !== false ||
      scenePackage.continuation?.externalConnections !== false)
  ) {
    issues.push("scene_visual_map_invalid");
  }

  const sceneUnitPlan = scenePackage.sceneUnitPlan;
  if (sceneUnitPlan && !visualMap) {
    issues.push("scene_units_before_visual_map");
  }
  const expectedUnitInputs = expectedSceneUnitInputs(scenePackage);
  if (
    sceneUnitPlan &&
    (sceneUnitPlan.kind !== "local_scene_unit_plan" ||
      sceneUnitPlan.status !== "materialized" ||
      sceneUnitPlan.visualMapId !== visualMap?.id ||
      sceneUnitPlan.storyboardId !== storyboard?.id ||
      sceneUnitPlan.narrationAssetId !== narration?.id ||
      sceneUnitPlan.captionPlanId !== captions?.id ||
      !arraysEqual(sceneUnitPlan.order, STAGE_IDS) ||
      !Array.isArray(sceneUnitPlan.units) ||
      sceneUnitPlan.units.length !== expectedUnitInputs.length ||
      expectedUnitInputs.some((input, index) => {
        const unit = sceneUnitPlan.units[index];
        return (
          unit?.sequence !== index + 1 ||
          unit?.stageSequence !== input.stageIndex + 1 ||
          unit?.stageId !== input.stagePlan.stageId ||
          unit?.visualBeatSequence !== input.beatIndex + 1 ||
          unit?.visualBeatId !== input.visualBeat.id ||
          unit?.storyboardSegmentId !== input.stagePlan.storyboardSegmentId ||
          unit?.narrationSegmentId !== input.narrationSegment.id ||
          unit?.captionCueId !== input.captionCue.id ||
          unit?.textAssetId !== input.stagePlan.textAssetId ||
          unit?.narrationText !== input.narrationSegment.text ||
          unit?.captionText !== input.captionCue.text ||
          unit?.source !== "local_structural_scene_unit" ||
          unit?.motionRequired !== true ||
          unit?.stillOnly !== false ||
          unit?.externalAssetId !== null ||
          unit?.rightsStatus !== "required_before_use"
        );
      }) ||
      sceneUnitPlan.safety?.retrievesMedia !== false ||
      sceneUnitPlan.safety?.generatesMedia !== false ||
      sceneUnitPlan.safety?.singleStaticCompositionAllowed !== false ||
      sceneUnitPlan.externalConnections !== false)
  ) {
    issues.push("scene_unit_plan_invalid");
  }

  const durationPlan = scenePackage.durationPlan;
  if (durationPlan && !sceneUnitPlan) {
    issues.push("scene_duration_before_units");
  }
  let expectedDurationStartMs = 0;
  if (
    durationPlan &&
    (durationPlan.kind !== "local_duration_allocation_plan" ||
      durationPlan.status !== "estimated" ||
      durationPlan.classification !== "local_estimate_without_audio" ||
      durationPlan.sceneUnitPlanId !== sceneUnitPlan?.id ||
      durationPlan.narrationAssetId !== narration?.id ||
      durationPlan.basis?.type !== "narration_word_count" ||
      durationPlan.basis?.wordsPerMinute !== 150 ||
      durationPlan.basis?.audioAvailable !== false ||
      durationPlan.basis?.exactTiming !== false ||
      !Array.isArray(durationPlan.stageAllocations) ||
      durationPlan.stageAllocations.length !== STAGE_IDS.length ||
      STAGE_IDS.some((stageId, stageIndex) => {
        const allocation = durationPlan.stageAllocations[stageIndex];
        const narrationSegment = narration?.segments?.[stageIndex];
        const units = sceneUnitPlan?.units?.filter(
          (unit) => unit.stageId === stageId
        ) ?? [];
        const estimatedDurationMs = estimateNarrationDurationMs(
          narrationSegment?.text ?? ""
        );
        const expectedWindows = allocateEstimatedWindows(
          units,
          estimatedDurationMs,
          expectedDurationStartMs
        );
        const invalid =
          allocation?.sequence !== stageIndex + 1 ||
          allocation?.stageId !== stageId ||
          allocation?.narrationSegmentId !== narrationSegment?.id ||
          allocation?.wordCount !== countWords(narrationSegment?.text ?? "") ||
          allocation?.estimatedStartMs !== expectedDurationStartMs ||
          allocation?.estimatedEndMs !==
            expectedDurationStartMs + estimatedDurationMs ||
          allocation?.estimatedDurationMs !== estimatedDurationMs ||
          allocation?.exactDurationMs !== null ||
          allocation?.timingStatus !== "local_estimate_without_audio" ||
          !Array.isArray(allocation?.unitAllocations) ||
          allocation.unitAllocations.length !== expectedWindows.length ||
          expectedWindows.some((window, index) => {
            const unitAllocation = allocation.unitAllocations[index];
            return Object.entries(window).some(
              ([key, value]) => unitAllocation?.[key] !== value
            );
          });
        expectedDurationStartMs += estimatedDurationMs;
        return invalid;
      }) ||
      durationPlan.totalEstimatedDurationMs !== expectedDurationStartMs ||
      durationPlan.exactTotalDurationMs !== null ||
      durationPlan.externalConnections !== false)
  ) {
    issues.push("scene_duration_plan_invalid");
  }

  const synchronizationPlan = scenePackage.synchronizationPlan;
  if (synchronizationPlan && !durationPlan) {
    issues.push("scene_sync_before_duration");
  }
  const durationUnitAllocations =
    durationPlan?.stageAllocations?.flatMap(
      (allocation) => allocation.unitAllocations
    ) ?? [];
  if (
    synchronizationPlan &&
    (synchronizationPlan.kind !== "structural_scene_synchronization" ||
      synchronizationPlan.status !== "structurally_synchronized" ||
      synchronizationPlan.timingStatus !== "exact_timing_pending" ||
      synchronizationPlan.sceneUnitPlanId !== sceneUnitPlan?.id ||
      synchronizationPlan.durationPlanId !== durationPlan?.id ||
      synchronizationPlan.narrationAssetId !== narration?.id ||
      synchronizationPlan.captionPlanId !== captions?.id ||
      !Array.isArray(synchronizationPlan.units) ||
      synchronizationPlan.units.length !== sceneUnitPlan?.units?.length ||
      sceneUnitPlan?.units?.some((sceneUnit, index) => {
        const synchronizedUnit = synchronizationPlan.units[index];
        const duration = durationUnitAllocations[index];
        return (
          synchronizedUnit?.sequence !== index + 1 ||
          synchronizedUnit?.stageId !== sceneUnit.stageId ||
          synchronizedUnit?.sceneUnitId !== sceneUnit.id ||
          synchronizedUnit?.narrationSegmentId !== sceneUnit.narrationSegmentId ||
          synchronizedUnit?.captionCueId !== sceneUnit.captionCueId ||
          synchronizedUnit?.narrationText !== sceneUnit.narrationText ||
          synchronizedUnit?.captionText !== sceneUnit.captionText ||
          synchronizedUnit?.durationAllocationId !== duration?.id ||
          synchronizedUnit?.estimatedStartMs !== duration?.estimatedStartMs ||
          synchronizedUnit?.estimatedEndMs !== duration?.estimatedEndMs ||
          synchronizedUnit?.exactStartMs !== null ||
          synchronizedUnit?.exactEndMs !== null ||
          synchronizedUnit?.timingStatus !== "estimated_structure_only" ||
          synchronizedUnit?.synchronizationBasis !==
            "stage_and_scene_unit_sequence"
        );
      }) ||
      synchronizationPlan.safety?.altersNarrationText !== false ||
      synchronizationPlan.safety?.altersCaptionText !== false ||
      synchronizationPlan.safety?.claimsExactTiming !== false ||
      synchronizationPlan.externalConnections !== false)
  ) {
    issues.push("scene_synchronization_plan_invalid");
  }

  const motionPlan = scenePackage.motionPlan;
  if (motionPlan && !synchronizationPlan) {
    issues.push("scene_motion_before_sync");
  }
  if (
    motionPlan &&
    (motionPlan.kind !== "local_motion_transition_plan" ||
      motionPlan.status !== "materialized" ||
      motionPlan.sceneUnitPlanId !== sceneUnitPlan?.id ||
      motionPlan.synchronizationPlanId !== synchronizationPlan?.id ||
      motionPlan.singleStaticCompositionAllowed !== false ||
      !Array.isArray(motionPlan.instructions) ||
      motionPlan.instructions.length !== synchronizationPlan?.units?.length ||
      synchronizationPlan?.units?.some((synchronizedUnit, index) => {
        const instruction = motionPlan.instructions[index];
        const nextUnit = synchronizationPlan.units[index + 1] ?? null;
        const transition = instruction?.transitionToNext;
        return (
          instruction?.sequence !== index + 1 ||
          instruction?.stageId !== synchronizedUnit.stageId ||
          instruction?.sceneUnitId !== synchronizedUnit.sceneUnitId ||
          instruction?.synchronizationUnitId !== synchronizedUnit.id ||
          instruction?.motionInstruction !== "required_dynamic_motion" ||
          instruction?.motionRequired !== true ||
          instruction?.stillOnly !== false ||
          instruction?.executionStatus !== "not_started" ||
          (nextUnit === null
            ? transition !== null
            : transition?.fromSceneUnitId !== synchronizedUnit.sceneUnitId ||
              transition?.toSceneUnitId !== nextUnit.sceneUnitId ||
              transition?.relationship !==
                (synchronizedUnit.stageId === nextUnit.stageId
                  ? "within_stage"
                  : "between_stages") ||
              transition?.instruction !== "structural_transition_required" ||
              transition?.timingStatus !== "pending_real_media_timing" ||
              transition?.executionStatus !== "not_started")
        );
      }) ||
      motionPlan.safety?.singleStaticCompositionBlocked !== true ||
      motionPlan.safety?.requiresRightsClearedMedia !== true ||
      motionPlan.externalConnections !== false)
  ) {
    issues.push("scene_motion_plan_invalid");
  }

  const integratedPlan = scenePackage.integratedExecutionPlan;
  if (integratedPlan && !motionPlan) {
    issues.push("scene_integrated_plan_before_motion");
  }
  if (
    integratedPlan &&
    (integratedPlan.kind !== "integrated_scene_execution_plan" ||
      integratedPlan.status !== "validated" ||
      integratedPlan.executionStatus !== "not_started" ||
      integratedPlan.timingClassification !==
        "local_estimate_without_real_audio_or_media" ||
      integratedPlan.exactTimingAvailable !== false ||
      integratedPlan.source?.sceneUnitPlanId !== sceneUnitPlan?.id ||
      integratedPlan.source?.durationPlanId !== durationPlan?.id ||
      integratedPlan.source?.synchronizationPlanId !== synchronizationPlan?.id ||
      integratedPlan.source?.motionPlanId !== motionPlan?.id ||
      integratedPlan.source?.textPackageClosureId !== textPackage.closure.id ||
      !arraysEqual(integratedPlan.order, STAGE_IDS) ||
      !Array.isArray(integratedPlan.units) ||
      integratedPlan.units.length !== motionPlan?.instructions?.length ||
      motionPlan?.instructions?.some((instruction, index) => {
        const integratedUnit = integratedPlan.units[index];
        const synchronizedUnit = synchronizationPlan.units[index];
        const sceneUnit = sceneUnitPlan.units[index];
        return (
          integratedUnit?.sequence !== index + 1 ||
          integratedUnit?.stageId !== sceneUnit.stageId ||
          integratedUnit?.sceneUnitId !== sceneUnit.id ||
          integratedUnit?.durationAllocationId !==
            synchronizedUnit.durationAllocationId ||
          integratedUnit?.synchronizationUnitId !== synchronizedUnit.id ||
          integratedUnit?.motionInstructionId !== instruction.id ||
          integratedUnit?.estimatedStartMs !== synchronizedUnit.estimatedStartMs ||
          integratedUnit?.estimatedEndMs !== synchronizedUnit.estimatedEndMs ||
          integratedUnit?.exactStartMs !== null ||
          integratedUnit?.exactEndMs !== null ||
          integratedUnit?.motionRequired !== true ||
          integratedUnit?.externalAssetId !== null ||
          integratedUnit?.rightsStatus !== "required_before_use"
        );
      }) ||
      integratedPlan.validation?.status !== "valid" ||
      Object.values(integratedPlan.validation?.checks ?? {}).some(
        (value) => value !== true
      ) ||
      integratedPlan.safety?.publishesContent !== false ||
      integratedPlan.safety?.connectsAccount !== false ||
      integratedPlan.safety?.requestsCredentials !== false ||
      integratedPlan.safety?.createsCharge !== false ||
      integratedPlan.externalConnections !== false ||
      !Number.isInteger(scenePackage.continuation?.lastCompletedPoint) ||
      scenePackage.continuation.lastCompletedPoint < 65 ||
      scenePackage.continuation.lastCompletedPoint > 70 ||
      scenePackage.continuation?.nextPoint !==
        scenePackage.continuation.lastCompletedPoint + 1 ||
      !["scene_package_continuation", "validation-safety"].includes(
        scenePackage.continuation?.nextStage
      ) ||
      scenePackage.continuation?.externalConnections !== false)
  ) {
    issues.push("scene_integrated_execution_plan_invalid");
  }

  const mediaRequirementsPlan = scenePackage.mediaRequirementsPlan;
  if (mediaRequirementsPlan && !integratedPlan) {
    issues.push("scene_media_requirements_before_integrated_plan");
  }
  if (
    mediaRequirementsPlan &&
    (mediaRequirementsPlan.kind !== "local_media_requirements_plan" ||
      mediaRequirementsPlan.status !== "materialized" ||
      mediaRequirementsPlan.integratedExecutionPlanId !== integratedPlan?.id ||
      mediaRequirementsPlan.singleStaticAssetAcrossVideoAllowed !== false ||
      mediaRequirementsPlan.minimumRequirementsPerStage !== 2 ||
      !Array.isArray(mediaRequirementsPlan.requirements) ||
      mediaRequirementsPlan.requirements.length !== integratedPlan?.units?.length ||
      integratedPlan?.units?.some((integratedUnit, index) => {
        const requirement = mediaRequirementsPlan.requirements[index];
        const sceneUnit = sceneUnitPlan.units[index];
        return (
          requirement?.sequence !== index + 1 ||
          requirement?.stageId !== integratedUnit.stageId ||
          requirement?.integratedUnitId !== integratedUnit.id ||
          requirement?.sceneUnitId !== integratedUnit.sceneUnitId ||
          requirement?.visualBeatId !== sceneUnit.visualBeatId ||
          requirement?.requirementType !== "dynamic_visual_media" ||
          requirement?.selectionStatus !== "not_started" ||
          requirement?.assetId !== null ||
          requirement?.motionRequired !== true ||
          requirement?.stillOnly !== false ||
          requirement?.reuseAsSingleVideoAssetAllowed !== false ||
          requirement?.rightsStatus !== "required_before_use"
        );
      }) ||
      STAGE_IDS.some(
        (stageId) =>
          mediaRequirementsPlan.requirements.filter(
            (requirement) => requirement.stageId === stageId
          ).length < 2
      ) ||
      mediaRequirementsPlan.safety?.retrievesMedia !== false ||
      mediaRequirementsPlan.safety?.generatesMedia !== false ||
      mediaRequirementsPlan.safety?.requiresRightsClearedMedia !== true ||
      mediaRequirementsPlan.externalConnections !== false)
  ) {
    issues.push("scene_media_requirements_plan_invalid");
  }

  const audioLayerPlan = scenePackage.audioLayerPlan;
  if (audioLayerPlan && !mediaRequirementsPlan) {
    issues.push("scene_audio_layers_before_media_requirements");
  }
  const narrationTrack = audioLayerPlan?.tracks?.narration;
  const musicTrack = audioLayerPlan?.tracks?.backgroundMusic;
  const effectsTrack = audioLayerPlan?.tracks?.soundEffects;
  const expectedTransitions = motionPlan?.instructions
    ?.map((instruction) => instruction.transitionToNext)
    .filter(Boolean) ?? [];
  if (
    audioLayerPlan &&
    (audioLayerPlan.kind !== "local_audio_layer_plan" ||
      audioLayerPlan.status !== "structured" ||
      audioLayerPlan.classification !== "local_plan_without_audio_files" ||
      audioLayerPlan.integratedExecutionPlanId !== integratedPlan?.id ||
      audioLayerPlan.durationPlanId !== durationPlan?.id ||
      audioLayerPlan.exactTimingAvailable !== false ||
      narrationTrack?.kind !== "narration" ||
      narrationTrack?.required !== true ||
      narrationTrack?.audioAssetId !== null ||
      narrationTrack?.executionStatus !== "not_started" ||
      !Array.isArray(narrationTrack?.segments) ||
      narrationTrack.segments.length !== narration?.segments?.length ||
      narration?.segments?.some((segment, index) => {
        const trackSegment = narrationTrack.segments[index];
        const allocation = durationPlan.stageAllocations[index];
        return (
          trackSegment?.sequence !== index + 1 ||
          trackSegment?.stageId !== segment.stageId ||
          trackSegment?.narrationSegmentId !== segment.id ||
          trackSegment?.text !== segment.text ||
          trackSegment?.estimatedStartMs !== allocation.estimatedStartMs ||
          trackSegment?.estimatedEndMs !== allocation.estimatedEndMs ||
          trackSegment?.exactStartMs !== null ||
          trackSegment?.exactEndMs !== null ||
          trackSegment?.voiceExecution !== "not_started"
        );
      }) ||
      musicTrack?.kind !== "background_music" ||
      musicTrack?.required !== true ||
      musicTrack?.audioAssetId !== null ||
      musicTrack?.selectionStatus !== "not_started" ||
      musicTrack?.rightsStatus !== "required_before_use" ||
      effectsTrack?.kind !== "sound_effects" ||
      effectsTrack?.required !== true ||
      !Array.isArray(effectsTrack?.cues) ||
      effectsTrack.cues.length !== expectedTransitions.length ||
      expectedTransitions.some((transition, index) => {
        const cue = effectsTrack.cues[index];
        const synchronizedUnit = synchronizationPlan.units[index];
        return (
          cue?.sequence !== index + 1 ||
          cue?.transitionId !== transition.id ||
          cue?.estimatedOffsetMs !== synchronizedUnit.estimatedEndMs ||
          cue?.exactOffsetMs !== null ||
          cue?.audioAssetId !== null ||
          cue?.selectionStatus !== "not_started" ||
          cue?.rightsStatus !== "required_before_use"
        );
      }) ||
      audioLayerPlan.mixing?.status !== "planned" ||
      audioLayerPlan.mixing?.narrationPriority !== true ||
      audioLayerPlan.mixing?.exactLevelsPending !== true ||
      audioLayerPlan.safety?.altersNarrationText !== false ||
      audioLayerPlan.safety?.requiresRightsClearedAudio !== true ||
      audioLayerPlan.safety?.createsAudio !== false ||
      audioLayerPlan.externalConnections !== false)
  ) {
    issues.push("scene_audio_layer_plan_invalid");
  }

  const compositionPlan = scenePackage.compositionPlan;
  if (compositionPlan && !audioLayerPlan) {
    issues.push("scene_composition_before_audio_layers");
  }
  if (
    compositionPlan &&
    (compositionPlan.kind !== "local_composition_timeline_plan" ||
      compositionPlan.status !== "structured" ||
      compositionPlan.integratedExecutionPlanId !== integratedPlan?.id ||
      compositionPlan.mediaRequirementsPlanId !== mediaRequirementsPlan?.id ||
      compositionPlan.audioLayerPlanId !== audioLayerPlan?.id ||
      compositionPlan.timingClassification !==
        "local_estimate_without_real_audio_or_media" ||
      compositionPlan.singleStaticCompositionAllowed !== false ||
      !arraysEqual(compositionPlan.layerOrder, [
        "visual",
        "caption",
        "narration",
        "music",
        "effects"
      ]) ||
      !Array.isArray(compositionPlan.units) ||
      compositionPlan.units.length !== integratedPlan?.units?.length ||
      integratedPlan?.units?.some((integratedUnit, index) => {
        const compositionUnit = compositionPlan.units[index];
        const requirement = mediaRequirementsPlan.requirements[index];
        const synchronizedUnit = synchronizationPlan.units[index];
        const instruction = motionPlan.instructions[index];
        const effectCue = audioLayerPlan.tracks.soundEffects.cues[index] ?? null;
        return (
          compositionUnit?.sequence !== index + 1 ||
          compositionUnit?.stageId !== integratedUnit.stageId ||
          compositionUnit?.integratedUnitId !== integratedUnit.id ||
          compositionUnit?.mediaRequirementId !== requirement.id ||
          compositionUnit?.synchronizationUnitId !== synchronizedUnit.id ||
          compositionUnit?.motionInstructionId !== instruction.id ||
          compositionUnit?.captionCueId !== synchronizedUnit.captionCueId ||
          compositionUnit?.narrationSegmentId !==
            synchronizedUnit.narrationSegmentId ||
          compositionUnit?.captionText !== synchronizedUnit.captionText ||
          compositionUnit?.narrationText !== synchronizedUnit.narrationText ||
          compositionUnit?.estimatedStartMs !== integratedUnit.estimatedStartMs ||
          compositionUnit?.estimatedEndMs !== integratedUnit.estimatedEndMs ||
          compositionUnit?.exactStartMs !== null ||
          compositionUnit?.exactEndMs !== null ||
          compositionUnit?.backgroundMusicTrackId !== musicTrack.id ||
          compositionUnit?.soundEffectCueId !== effectCue?.id &&
            !(compositionUnit?.soundEffectCueId === null && effectCue === null)
        );
      }) ||
      compositionPlan.safety?.altersText !== false ||
      compositionPlan.safety?.rendersMedia !== false ||
      compositionPlan.safety?.singleStaticCompositionBlocked !== true ||
      compositionPlan.externalConnections !== false)
  ) {
    issues.push("scene_composition_plan_invalid");
  }

  const renderPlan = scenePackage.renderPlan;
  if (renderPlan && !compositionPlan) {
    issues.push("scene_render_plan_before_composition");
  }
  if (
    renderPlan &&
    (renderPlan.kind !== "local_render_preparation_plan" ||
      renderPlan.status !== "planned_blocked_until_real_assets" ||
      renderPlan.compositionPlanId !== compositionPlan?.id ||
      renderPlan.mediaRequirementsPlanId !== mediaRequirementsPlan?.id ||
      renderPlan.audioLayerPlanId !== audioLayerPlan?.id ||
      renderPlan.target?.experience !== "android_priority" ||
      renderPlan.target?.format !== mission.strategyBriefing.constraints.format ||
      renderPlan.target?.resolutionStatus !==
        "pending_local_capability_validation" ||
      renderPlan.target?.codecStatus !== "pending_local_capability_validation" ||
      renderPlan.inputs?.visualMedia?.status !== "not_materialized" ||
      renderPlan.inputs?.visualMedia?.requirements !==
        mediaRequirementsPlan?.requirements?.length ||
      renderPlan.inputs?.narrationAudio?.status !== "not_materialized" ||
      renderPlan.inputs?.narrationAudio?.segments !== narration?.segments?.length ||
      renderPlan.inputs?.backgroundMusic?.status !== "not_selected" ||
      renderPlan.inputs?.soundEffects?.status !== "not_selected" ||
      renderPlan.inputs?.soundEffects?.cues !== effectsTrack?.cues?.length ||
      renderPlan.inputs?.captions?.status !== "structural_ready" ||
      !arraysEqual(renderPlan.blockers, [
        "rights_cleared_visual_media_missing",
        "narration_audio_missing",
        "rights_cleared_background_music_missing",
        "rights_cleared_sound_effects_missing"
      ]) ||
      renderPlan.renderAllowed !== false ||
      renderPlan.executionStatus !== "not_started" ||
      renderPlan.outputFile !== null ||
      renderPlan.validation?.sourceLinksValid !== true ||
      renderPlan.validation?.renderBlockedSafely !== true ||
      renderPlan.validation?.estimatesClassified !== true ||
      renderPlan.validation?.externalConnectionsDisabled !== true ||
      renderPlan.safety?.publishesContent !== false ||
      renderPlan.safety?.connectsAccount !== false ||
      renderPlan.safety?.requestsCredentials !== false ||
      renderPlan.safety?.createsCharge !== false ||
      renderPlan.externalConnections !== false)
  ) {
    issues.push("scene_render_preparation_plan_invalid");
  }

  const packageValidation = scenePackage.scenePackageValidation;
  const closure = scenePackage.closure;
  if ((packageValidation || closure) && !renderPlan) {
    issues.push("scene_closure_before_render_plan");
  }
  if (
    packageValidation &&
    (packageValidation.kind !== "scene_package_validation" ||
      packageValidation.status !== "valid" ||
      packageValidation.scenePackageId !== scenePackage.id ||
      packageValidation.renderPlanId !== renderPlan?.id ||
      Object.keys(packageValidation.checks ?? {}).length !== 10 ||
      Object.values(packageValidation.checks ?? {}).some((value) => value !== true) ||
      packageValidation.externalConnections !== false)
  ) {
    issues.push("scene_package_complete_validation_invalid");
  }
  if (
    closure &&
    (!packageValidation ||
      closure.kind !== "scene_package_closure" ||
      closure.status !== "closed" ||
      closure.scenePackageId !== scenePackage.id ||
      closure.validationId !== packageValidation.id ||
      closure.structuralPackageComplete !== true ||
      closure.realMediaExecutionPending !== true ||
      closure.readyForValidationSafety !== true ||
      closure.nextStage !== "validation-safety" ||
      closure.renderExecuted !== false ||
      closure.published !== false ||
      closure.externalConnections !== false)
  ) {
    issues.push("scene_package_closure_invalid");
  }

  if (integratedPlan) {
    const expectedContinuation = closure
      ? ["closed", "validation-safety", 70, 71]
      : renderPlan
        ? ["open", "scene_package_continuation", 69, 70]
        : compositionPlan
          ? ["open", "scene_package_continuation", 68, 69]
          : audioLayerPlan
            ? ["open", "scene_package_continuation", 67, 68]
            : mediaRequirementsPlan
              ? ["open", "scene_package_continuation", 66, 67]
              : ["open", "scene_package_continuation", 65, 66];
    if (
      scenePackage.continuation?.status !== expectedContinuation[0] ||
      scenePackage.continuation?.nextStage !== expectedContinuation[1] ||
      scenePackage.continuation?.lastCompletedPoint !== expectedContinuation[2] ||
      scenePackage.continuation?.nextPoint !== expectedContinuation[3] ||
      scenePackage.continuation?.externalConnections !== false
    ) {
      issues.push("scene_package_continuation_invalid");
    }
  }

  const expectedStatus = closure
    ? "ready_for_validation_safety"
    : renderPlan
      ? "render_preparation_planned"
      : compositionPlan
        ? "composition_timeline_structured"
        : audioLayerPlan
          ? "audio_layers_structured"
          : mediaRequirementsPlan
            ? "media_requirements_materialized"
            : integratedPlan
              ? "integrated_scene_plan_validated"
              : motionPlan
                ? "motion_transitions_materialized"
                : synchronizationPlan
                  ? "structure_synchronized"
                  : durationPlan
                    ? "duration_allocation_estimated"
                    : sceneUnitPlan
                      ? "scene_units_materialized"
                      : visualMap
                        ? "visual_map_validated"
                        : captions
                          ? "caption_plan_created"
                          : narration
                            ? "narration_materialized"
                            : storyboard
                              ? "storyboard_structured"
                              : "modeled";
  if (scenePackage.status !== expectedStatus) {
    issues.push("scene_package_status_invalid");
  }

  return issues;
}

export function inspectScenePackage(mission) {
  const issues = collectScenePackageIssues(mission);
  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze([...issues])
  });
}

function requireScenePackage(mission) {
  if (!mission?.scenePackage) {
    throw new ScenePackageValidationError(
      "Modele o pacote de cenas antes de criar seus ativos."
    );
  }
  const inspection = inspectScenePackage(mission);
  if (!inspection.valid) {
    throw new ScenePackageValidationError(
      `O pacote de cenas preservado é inválido: ${inspection.issues.join(", ")}.`
    );
  }
  return mission.scenePackage;
}

function updateScenePackage(scenePackage, changes, status, now) {
  return Object.freeze({
    ...scenePackage,
    ...changes,
    status,
    updatedAt: now.toISOString()
  });
}

function assertCandidate(mission, scenePackage) {
  const inspection = inspectScenePackage({ ...mission, scenePackage });
  if (!inspection.valid) {
    throw new ScenePackageValidationError(
      `A evolução do pacote de cenas é inválida: ${inspection.issues.join(", ")}.`
    );
  }
  return scenePackage;
}

export function createScenePackage({
  mission,
  id = randomUUID(),
  now = new Date()
}) {
  assertTextPackageReady(mission);
  if (mission.scenePackage) {
    throw new ScenePackageValidationError(
      "A missão já possui um pacote de cenas preservado."
    );
  }
  const timestamp = now.toISOString();
  return Object.freeze({
    schemaVersion: 1,
    id,
    missionId: mission.id,
    mode: "local_scene_planning_only",
    externalConnections: false,
    classification: "implementation_new_reconstruction",
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "modeled",
    source: Object.freeze(expectedSource(mission)),
    safety: Object.freeze({
      singleStaticImageAllowed: false,
      dynamicVisualRequired: true,
      publishesContent: false,
      connectsAccount: false,
      requestsCredentials: false,
      createsCharge: false,
      requiresRightsClearedMedia: true
    })
  });
}

export function structureSceneStoryboard({
  mission,
  storyboardId = randomUUID(),
  now = new Date()
}) {
  const scenePackage = requireScenePackage(mission);
  if (scenePackage.status !== "modeled") {
    throw new ScenePackageValidationError(
      "Estruture o storyboard somente depois de modelar o pacote de cenas."
    );
  }
  const textPackage = mission.textPackage;
  const assets = stageAssets(textPackage);
  const transitions = textPackage.transitionMapAsset.transitions;
  const storyboard = Object.freeze({
    schemaVersion: 1,
    id: storyboardId,
    kind: "scene_storyboard",
    status: "structured",
    createdAt: now.toISOString(),
    scenePackageId: scenePackage.id,
    finalScriptAssetId: textPackage.finalScriptAsset.id,
    order: Object.freeze([...STAGE_IDS]),
    segments: Object.freeze(
      STAGE_IDS.map((stageId, index) =>
        Object.freeze({
          id: `${storyboardId}-${stageId}`,
          sequence: index + 1,
          stageId,
          textAssetId: assets[index].id,
          text: assets[index].text,
          retentionObjective: mission.retentionPlan.stages[index].objective,
          incomingTransitionId: index === 0 ? null : transitions[index - 1].id,
          outgoingTransitionId:
            index === STAGE_IDS.length - 1 ? null : transitions[index].id,
          dynamicVisualRequired: true,
          minimumVisualBeats: 2
        })
      )
    ),
    safety: Object.freeze({
      addsClaims: false,
      altersScriptText: false,
      guaranteedOutcome: false
    }),
    externalConnections: false
  });
  const updated = updateScenePackage(
    scenePackage,
    { storyboard },
    "storyboard_structured",
    now
  );
  return assertCandidate(mission, updated);
}

export function materializeNarrationAsset({
  mission,
  assetId = randomUUID(),
  now = new Date()
}) {
  const scenePackage = requireScenePackage(mission);
  if (scenePackage.status !== "storyboard_structured") {
    throw new ScenePackageValidationError(
      "Materialize a narração somente depois do storyboard."
    );
  }
  const narrationAsset = Object.freeze({
    schemaVersion: 1,
    id: assetId,
    kind: "narration_script",
    status: "materialized",
    createdAt: now.toISOString(),
    storyboardId: scenePackage.storyboard.id,
    language: "pt-BR",
    voiceExecution: "not_started",
    audioFile: null,
    segments: Object.freeze(
      scenePackage.storyboard.segments.map((segment) =>
        Object.freeze({
          id: `${assetId}-${segment.stageId}`,
          sequence: segment.sequence,
          stageId: segment.stageId,
          storyboardSegmentId: segment.id,
          textAssetId: segment.textAssetId,
          text: segment.text
        })
      )
    ),
    safety: Object.freeze({
      verbatimValidatedScript: true,
      addsClaims: false,
      guaranteedOutcome: false
    }),
    externalConnections: false
  });
  const updated = updateScenePackage(
    scenePackage,
    { narrationAsset },
    "narration_materialized",
    now
  );
  return assertCandidate(mission, updated);
}

export function createCaptionPlan({
  mission,
  planId = randomUUID(),
  now = new Date()
}) {
  const scenePackage = requireScenePackage(mission);
  if (scenePackage.status !== "narration_materialized") {
    throw new ScenePackageValidationError(
      "Crie o plano de legendas somente depois da narração textual."
    );
  }
  const captionPlan = Object.freeze({
    schemaVersion: 1,
    id: planId,
    kind: "caption_plan",
    status: "structured",
    createdAt: now.toISOString(),
    narrationAssetId: scenePackage.narrationAsset.id,
    language: "pt-BR",
    timingStatus: "pending_scene_timing",
    cues: Object.freeze(
      scenePackage.narrationAsset.segments.map((segment) =>
        Object.freeze({
          id: `${planId}-cue-${segment.sequence}`,
          sequence: segment.sequence,
          stageId: segment.stageId,
          narrationSegmentId: segment.id,
          text: segment.text,
          timingStatus: "pending_scene_timing",
          synchronizationBasis: "narration_segment_sequence"
        })
      )
    ),
    safety: Object.freeze({
      addsText: false,
      guaranteedOutcome: false
    }),
    externalConnections: false
  });
  const updated = updateScenePackage(
    scenePackage,
    { captionPlan },
    "caption_plan_created",
    now
  );
  return assertCandidate(mission, updated);
}

export function createDynamicVisualMap({
  mission,
  mapId = randomUUID(),
  now = new Date()
}) {
  const scenePackage = requireScenePackage(mission);
  if (scenePackage.status !== "caption_plan_created") {
    throw new ScenePackageValidationError(
      "Crie o mapa visual somente depois do plano de legendas."
    );
  }
  const visualMap = Object.freeze({
    schemaVersion: 1,
    id: mapId,
    kind: "dynamic_visual_map",
    status: "validated",
    createdAt: now.toISOString(),
    storyboardId: scenePackage.storyboard.id,
    captionPlanId: scenePackage.captionPlan.id,
    singleStaticImageAllowed: false,
    stagePlans: Object.freeze(
      scenePackage.storyboard.segments.map((segment) =>
        Object.freeze({
          sequence: segment.sequence,
          stageId: segment.stageId,
          storyboardSegmentId: segment.id,
          textAssetId: segment.textAssetId,
          retentionObjective: segment.retentionObjective,
          visualBeats: Object.freeze(
            ["stage_entry", "stage_development"].map((purpose, index) =>
              Object.freeze({
                id: `${mapId}-${segment.stageId}-beat-${index + 1}`,
                sequence: index + 1,
                purpose,
                source: "structural_visual_placeholder",
                motionRequired: true,
                stillOnly: false,
                externalAssetId: null,
                rightsStatus: "required_before_use"
              })
            )
          )
        })
      )
    ),
    safety: Object.freeze({
      addsClaims: false,
      requiresRightsClearedMedia: true,
      guaranteedOutcome: false
    }),
    externalConnections: false
  });
  const continuation = Object.freeze({
    status: "open",
    nextStage: "scene_package_continuation",
    externalConnections: false
  });
  const updated = updateScenePackage(
    scenePackage,
    { visualMap, continuation },
    "visual_map_validated",
    now
  );
  return assertCandidate(mission, updated);
}

export function materializeLocalSceneUnits({
  mission,
  planId = randomUUID(),
  now = new Date()
}) {
  const scenePackage = requireScenePackage(mission);
  if (scenePackage.status !== "visual_map_validated") {
    throw new ScenePackageValidationError(
      "Materialize as unidades de cena somente depois do mapa visual validado."
    );
  }
  const inputs = expectedSceneUnitInputs(scenePackage);
  const sceneUnitPlan = Object.freeze({
    schemaVersion: 1,
    id: planId,
    kind: "local_scene_unit_plan",
    status: "materialized",
    createdAt: now.toISOString(),
    visualMapId: scenePackage.visualMap.id,
    storyboardId: scenePackage.storyboard.id,
    narrationAssetId: scenePackage.narrationAsset.id,
    captionPlanId: scenePackage.captionPlan.id,
    order: Object.freeze([...STAGE_IDS]),
    units: Object.freeze(
      inputs.map((input, index) =>
        Object.freeze({
          id: `${planId}-${input.stagePlan.stageId}-unit-${input.beatIndex + 1}`,
          sequence: index + 1,
          stageSequence: input.stageIndex + 1,
          stageId: input.stagePlan.stageId,
          visualBeatSequence: input.beatIndex + 1,
          visualBeatId: input.visualBeat.id,
          storyboardSegmentId: input.stagePlan.storyboardSegmentId,
          narrationSegmentId: input.narrationSegment.id,
          captionCueId: input.captionCue.id,
          textAssetId: input.stagePlan.textAssetId,
          narrationText: input.narrationSegment.text,
          captionText: input.captionCue.text,
          source: "local_structural_scene_unit",
          motionRequired: true,
          stillOnly: false,
          externalAssetId: null,
          rightsStatus: "required_before_use"
        })
      )
    ),
    safety: Object.freeze({
      retrievesMedia: false,
      generatesMedia: false,
      singleStaticCompositionAllowed: false,
      requiresRightsClearedMedia: true
    }),
    externalConnections: false
  });
  const updated = updateScenePackage(
    scenePackage,
    { sceneUnitPlan },
    "scene_units_materialized",
    now
  );
  return assertCandidate(mission, updated);
}

export function createLocalDurationAllocationPlan({
  mission,
  planId = randomUUID(),
  now = new Date()
}) {
  const scenePackage = requireScenePackage(mission);
  if (scenePackage.status !== "scene_units_materialized") {
    throw new ScenePackageValidationError(
      "Crie a estimativa de duração somente depois das unidades de cena."
    );
  }
  let estimatedStartMs = 0;
  const stageAllocations = scenePackage.narrationAsset.segments.map(
    (segment, stageIndex) => {
      const units = scenePackage.sceneUnitPlan.units.filter(
        (unit) => unit.stageId === segment.stageId
      );
      const estimatedDurationMs = estimateNarrationDurationMs(segment.text);
      const allocation = Object.freeze({
        sequence: stageIndex + 1,
        stageId: segment.stageId,
        narrationSegmentId: segment.id,
        wordCount: countWords(segment.text),
        estimatedStartMs,
        estimatedEndMs: estimatedStartMs + estimatedDurationMs,
        estimatedDurationMs,
        exactDurationMs: null,
        timingStatus: "local_estimate_without_audio",
        unitAllocations: Object.freeze(
          allocateEstimatedWindows(units, estimatedDurationMs, estimatedStartMs).map(
            (allocationWindow) => Object.freeze(allocationWindow)
          )
        )
      });
      estimatedStartMs += estimatedDurationMs;
      return allocation;
    }
  );
  const durationPlan = Object.freeze({
    schemaVersion: 1,
    id: planId,
    kind: "local_duration_allocation_plan",
    status: "estimated",
    classification: "local_estimate_without_audio",
    createdAt: now.toISOString(),
    sceneUnitPlanId: scenePackage.sceneUnitPlan.id,
    narrationAssetId: scenePackage.narrationAsset.id,
    basis: Object.freeze({
      type: "narration_word_count",
      wordsPerMinute: 150,
      audioAvailable: false,
      exactTiming: false
    }),
    stageAllocations: Object.freeze(stageAllocations),
    totalEstimatedDurationMs: estimatedStartMs,
    exactTotalDurationMs: null,
    externalConnections: false
  });
  const updated = updateScenePackage(
    scenePackage,
    { durationPlan },
    "duration_allocation_estimated",
    now
  );
  return assertCandidate(mission, updated);
}

export function synchronizeSceneStructure({
  mission,
  planId = randomUUID(),
  now = new Date()
}) {
  const scenePackage = requireScenePackage(mission);
  if (scenePackage.status !== "duration_allocation_estimated") {
    throw new ScenePackageValidationError(
      "Sincronize a estrutura somente depois da estimativa local de duração."
    );
  }
  const durationAllocations = scenePackage.durationPlan.stageAllocations.flatMap(
    (allocation) => allocation.unitAllocations
  );
  const synchronizationPlan = Object.freeze({
    schemaVersion: 1,
    id: planId,
    kind: "structural_scene_synchronization",
    status: "structurally_synchronized",
    timingStatus: "exact_timing_pending",
    createdAt: now.toISOString(),
    sceneUnitPlanId: scenePackage.sceneUnitPlan.id,
    durationPlanId: scenePackage.durationPlan.id,
    narrationAssetId: scenePackage.narrationAsset.id,
    captionPlanId: scenePackage.captionPlan.id,
    units: Object.freeze(
      scenePackage.sceneUnitPlan.units.map((unit, index) => {
        const duration = durationAllocations[index];
        return Object.freeze({
          id: `${planId}-unit-${index + 1}`,
          sequence: index + 1,
          stageId: unit.stageId,
          sceneUnitId: unit.id,
          narrationSegmentId: unit.narrationSegmentId,
          captionCueId: unit.captionCueId,
          narrationText: unit.narrationText,
          captionText: unit.captionText,
          durationAllocationId: duration.id,
          estimatedStartMs: duration.estimatedStartMs,
          estimatedEndMs: duration.estimatedEndMs,
          exactStartMs: null,
          exactEndMs: null,
          timingStatus: "estimated_structure_only",
          synchronizationBasis: "stage_and_scene_unit_sequence"
        });
      })
    ),
    safety: Object.freeze({
      altersNarrationText: false,
      altersCaptionText: false,
      claimsExactTiming: false
    }),
    externalConnections: false
  });
  const updated = updateScenePackage(
    scenePackage,
    { synchronizationPlan },
    "structure_synchronized",
    now
  );
  return assertCandidate(mission, updated);
}

export function materializeMotionTransitionInstructions({
  mission,
  planId = randomUUID(),
  now = new Date()
}) {
  const scenePackage = requireScenePackage(mission);
  if (scenePackage.status !== "structure_synchronized") {
    throw new ScenePackageValidationError(
      "Materialize movimento e transições somente depois da sincronização estrutural."
    );
  }
  const synchronizedUnits = scenePackage.synchronizationPlan.units;
  const motionPlan = Object.freeze({
    schemaVersion: 1,
    id: planId,
    kind: "local_motion_transition_plan",
    status: "materialized",
    createdAt: now.toISOString(),
    sceneUnitPlanId: scenePackage.sceneUnitPlan.id,
    synchronizationPlanId: scenePackage.synchronizationPlan.id,
    singleStaticCompositionAllowed: false,
    instructions: Object.freeze(
      synchronizedUnits.map((unit, index) => {
        const nextUnit = synchronizedUnits[index + 1] ?? null;
        return Object.freeze({
          id: `${planId}-instruction-${index + 1}`,
          sequence: index + 1,
          stageId: unit.stageId,
          sceneUnitId: unit.sceneUnitId,
          synchronizationUnitId: unit.id,
          motionInstruction: "required_dynamic_motion",
          motionRequired: true,
          stillOnly: false,
          executionStatus: "not_started",
          transitionToNext: nextUnit
            ? Object.freeze({
                id: `${planId}-transition-${index + 1}`,
                fromSceneUnitId: unit.sceneUnitId,
                toSceneUnitId: nextUnit.sceneUnitId,
                relationship:
                  unit.stageId === nextUnit.stageId
                    ? "within_stage"
                    : "between_stages",
                instruction: "structural_transition_required",
                timingStatus: "pending_real_media_timing",
                executionStatus: "not_started"
              })
            : null
        });
      })
    ),
    safety: Object.freeze({
      singleStaticCompositionBlocked: true,
      requiresRightsClearedMedia: true,
      retrievesMedia: false,
      generatesMedia: false
    }),
    externalConnections: false
  });
  const updated = updateScenePackage(
    scenePackage,
    { motionPlan },
    "motion_transitions_materialized",
    now
  );
  return assertCandidate(mission, updated);
}

export function validateIntegratedSceneExecutionPlan({
  mission,
  planId = randomUUID(),
  now = new Date()
}) {
  const scenePackage = requireScenePackage(mission);
  if (scenePackage.status !== "motion_transitions_materialized") {
    throw new ScenePackageValidationError(
      "Integre o plano de execução somente depois das instruções de movimento."
    );
  }
  const integratedExecutionPlan = Object.freeze({
    schemaVersion: 1,
    id: planId,
    kind: "integrated_scene_execution_plan",
    status: "validated",
    createdAt: now.toISOString(),
    executionStatus: "not_started",
    timingClassification: "local_estimate_without_real_audio_or_media",
    exactTimingAvailable: false,
    source: Object.freeze({
      sceneUnitPlanId: scenePackage.sceneUnitPlan.id,
      durationPlanId: scenePackage.durationPlan.id,
      synchronizationPlanId: scenePackage.synchronizationPlan.id,
      motionPlanId: scenePackage.motionPlan.id,
      textPackageClosureId: mission.textPackage.closure.id
    }),
    order: Object.freeze([...STAGE_IDS]),
    units: Object.freeze(
      scenePackage.motionPlan.instructions.map((instruction, index) => {
        const synchronizedUnit = scenePackage.synchronizationPlan.units[index];
        const sceneUnit = scenePackage.sceneUnitPlan.units[index];
        return Object.freeze({
          id: `${planId}-unit-${index + 1}`,
          sequence: index + 1,
          stageId: sceneUnit.stageId,
          sceneUnitId: sceneUnit.id,
          durationAllocationId: synchronizedUnit.durationAllocationId,
          synchronizationUnitId: synchronizedUnit.id,
          motionInstructionId: instruction.id,
          estimatedStartMs: synchronizedUnit.estimatedStartMs,
          estimatedEndMs: synchronizedUnit.estimatedEndMs,
          exactStartMs: null,
          exactEndMs: null,
          motionRequired: true,
          externalAssetId: null,
          rightsStatus: "required_before_use"
        });
      })
    ),
    validation: Object.freeze({
      status: "valid",
      checks: Object.freeze({
        sourceLinksValid: true,
        stageOrderValid: true,
        textPreserved: true,
        dynamicMotionRequired: true,
        singleStaticCompositionBlocked: true,
        estimatesClassified: true,
        externalConnectionsDisabled: true,
        rightsRequiredBeforeUse: true
      })
    }),
    safety: Object.freeze({
      publishesContent: false,
      connectsAccount: false,
      requestsCredentials: false,
      createsCharge: false,
      requiresRightsClearedMedia: true
    }),
    externalConnections: false
  });
  const continuation = Object.freeze({
    ...scenePackage.continuation,
    status: "open",
    nextStage: "scene_package_continuation",
    lastCompletedPoint: 65,
    nextPoint: 66,
    externalConnections: false
  });
  const updated = updateScenePackage(
    scenePackage,
    { integratedExecutionPlan, continuation },
    "integrated_scene_plan_validated",
    now
  );
  return assertCandidate(mission, updated);
}

export function materializeMediaRequirementsPlan({
  mission,
  planId = randomUUID(),
  now = new Date()
}) {
  const scenePackage = requireScenePackage(mission);
  if (scenePackage.status !== "integrated_scene_plan_validated") {
    throw new ScenePackageValidationError(
      "Materialize os requisitos de mídia somente depois do plano integrado validado."
    );
  }
  const mediaRequirementsPlan = Object.freeze({
    schemaVersion: 1,
    id: planId,
    kind: "local_media_requirements_plan",
    status: "materialized",
    createdAt: now.toISOString(),
    integratedExecutionPlanId: scenePackage.integratedExecutionPlan.id,
    singleStaticAssetAcrossVideoAllowed: false,
    minimumRequirementsPerStage: 2,
    requirements: Object.freeze(
      scenePackage.integratedExecutionPlan.units.map((integratedUnit, index) => {
        const sceneUnit = scenePackage.sceneUnitPlan.units[index];
        return Object.freeze({
          id: `${planId}-requirement-${index + 1}`,
          sequence: index + 1,
          stageId: integratedUnit.stageId,
          integratedUnitId: integratedUnit.id,
          sceneUnitId: integratedUnit.sceneUnitId,
          visualBeatId: sceneUnit.visualBeatId,
          requirementType: "dynamic_visual_media",
          selectionStatus: "not_started",
          assetId: null,
          motionRequired: true,
          stillOnly: false,
          reuseAsSingleVideoAssetAllowed: false,
          rightsStatus: "required_before_use"
        });
      })
    ),
    safety: Object.freeze({
      retrievesMedia: false,
      generatesMedia: false,
      requiresRightsClearedMedia: true,
      singleStaticCompositionBlocked: true
    }),
    externalConnections: false
  });
  const continuation = Object.freeze({
    ...scenePackage.continuation,
    status: "open",
    nextStage: "scene_package_continuation",
    lastCompletedPoint: 66,
    nextPoint: 67,
    externalConnections: false
  });
  const updated = updateScenePackage(
    scenePackage,
    { mediaRequirementsPlan, continuation },
    "media_requirements_materialized",
    now
  );
  return assertCandidate(mission, updated);
}

export function structureLocalAudioLayerPlan({
  mission,
  planId = randomUUID(),
  now = new Date()
}) {
  const scenePackage = requireScenePackage(mission);
  if (scenePackage.status !== "media_requirements_materialized") {
    throw new ScenePackageValidationError(
      "Estruture as camadas de áudio somente depois dos requisitos de mídia."
    );
  }
  const transitions = scenePackage.motionPlan.instructions
    .map((instruction) => instruction.transitionToNext)
    .filter(Boolean);
  const narrationTrackId = `${planId}-narration`;
  const musicTrackId = `${planId}-music`;
  const effectsTrackId = `${planId}-effects`;
  const audioLayerPlan = Object.freeze({
    schemaVersion: 1,
    id: planId,
    kind: "local_audio_layer_plan",
    status: "structured",
    classification: "local_plan_without_audio_files",
    createdAt: now.toISOString(),
    integratedExecutionPlanId: scenePackage.integratedExecutionPlan.id,
    durationPlanId: scenePackage.durationPlan.id,
    exactTimingAvailable: false,
    tracks: Object.freeze({
      narration: Object.freeze({
        id: narrationTrackId,
        kind: "narration",
        required: true,
        audioAssetId: null,
        executionStatus: "not_started",
        segments: Object.freeze(
          scenePackage.narrationAsset.segments.map((segment, index) => {
            const allocation = scenePackage.durationPlan.stageAllocations[index];
            return Object.freeze({
              id: `${narrationTrackId}-segment-${index + 1}`,
              sequence: index + 1,
              stageId: segment.stageId,
              narrationSegmentId: segment.id,
              text: segment.text,
              estimatedStartMs: allocation.estimatedStartMs,
              estimatedEndMs: allocation.estimatedEndMs,
              exactStartMs: null,
              exactEndMs: null,
              voiceExecution: "not_started"
            });
          })
        )
      }),
      backgroundMusic: Object.freeze({
        id: musicTrackId,
        kind: "background_music",
        required: true,
        audioAssetId: null,
        selectionStatus: "not_started",
        rightsStatus: "required_before_use"
      }),
      soundEffects: Object.freeze({
        id: effectsTrackId,
        kind: "sound_effects",
        required: true,
        cues: Object.freeze(
          transitions.map((transition, index) =>
            Object.freeze({
              id: `${effectsTrackId}-cue-${index + 1}`,
              sequence: index + 1,
              transitionId: transition.id,
              estimatedOffsetMs:
                scenePackage.synchronizationPlan.units[index].estimatedEndMs,
              exactOffsetMs: null,
              audioAssetId: null,
              selectionStatus: "not_started",
              rightsStatus: "required_before_use"
            })
          )
        )
      })
    }),
    mixing: Object.freeze({
      status: "planned",
      narrationPriority: true,
      exactLevelsPending: true
    }),
    safety: Object.freeze({
      altersNarrationText: false,
      requiresRightsClearedAudio: true,
      createsAudio: false
    }),
    externalConnections: false
  });
  const continuation = Object.freeze({
    ...scenePackage.continuation,
    lastCompletedPoint: 67,
    nextPoint: 68
  });
  const updated = updateScenePackage(
    scenePackage,
    { audioLayerPlan, continuation },
    "audio_layers_structured",
    now
  );
  return assertCandidate(mission, updated);
}

export function structureCompositionTimelinePlan({
  mission,
  planId = randomUUID(),
  now = new Date()
}) {
  const scenePackage = requireScenePackage(mission);
  if (scenePackage.status !== "audio_layers_structured") {
    throw new ScenePackageValidationError(
      "Estruture a composição somente depois das camadas locais de áudio."
    );
  }
  const effects = scenePackage.audioLayerPlan.tracks.soundEffects.cues;
  const compositionPlan = Object.freeze({
    schemaVersion: 1,
    id: planId,
    kind: "local_composition_timeline_plan",
    status: "structured",
    createdAt: now.toISOString(),
    integratedExecutionPlanId: scenePackage.integratedExecutionPlan.id,
    mediaRequirementsPlanId: scenePackage.mediaRequirementsPlan.id,
    audioLayerPlanId: scenePackage.audioLayerPlan.id,
    timingClassification: "local_estimate_without_real_audio_or_media",
    singleStaticCompositionAllowed: false,
    layerOrder: Object.freeze([
      "visual",
      "caption",
      "narration",
      "music",
      "effects"
    ]),
    units: Object.freeze(
      scenePackage.integratedExecutionPlan.units.map((integratedUnit, index) => {
        const synchronizedUnit = scenePackage.synchronizationPlan.units[index];
        return Object.freeze({
          id: `${planId}-unit-${index + 1}`,
          sequence: index + 1,
          stageId: integratedUnit.stageId,
          integratedUnitId: integratedUnit.id,
          mediaRequirementId:
            scenePackage.mediaRequirementsPlan.requirements[index].id,
          synchronizationUnitId: synchronizedUnit.id,
          motionInstructionId: scenePackage.motionPlan.instructions[index].id,
          captionCueId: synchronizedUnit.captionCueId,
          narrationSegmentId: synchronizedUnit.narrationSegmentId,
          captionText: synchronizedUnit.captionText,
          narrationText: synchronizedUnit.narrationText,
          estimatedStartMs: integratedUnit.estimatedStartMs,
          estimatedEndMs: integratedUnit.estimatedEndMs,
          exactStartMs: null,
          exactEndMs: null,
          backgroundMusicTrackId:
            scenePackage.audioLayerPlan.tracks.backgroundMusic.id,
          soundEffectCueId: effects[index]?.id ?? null
        });
      })
    ),
    safety: Object.freeze({
      altersText: false,
      rendersMedia: false,
      singleStaticCompositionBlocked: true,
      requiresRightsClearedMedia: true
    }),
    externalConnections: false
  });
  const continuation = Object.freeze({
    ...scenePackage.continuation,
    lastCompletedPoint: 68,
    nextPoint: 69
  });
  const updated = updateScenePackage(
    scenePackage,
    { compositionPlan, continuation },
    "composition_timeline_structured",
    now
  );
  return assertCandidate(mission, updated);
}

export function createLocalRenderPreparationPlan({
  mission,
  planId = randomUUID(),
  now = new Date()
}) {
  const scenePackage = requireScenePackage(mission);
  if (scenePackage.status !== "composition_timeline_structured") {
    throw new ScenePackageValidationError(
      "Prepare a renderização somente depois da composição estrutural."
    );
  }
  const renderPlan = Object.freeze({
    schemaVersion: 1,
    id: planId,
    kind: "local_render_preparation_plan",
    status: "planned_blocked_until_real_assets",
    createdAt: now.toISOString(),
    compositionPlanId: scenePackage.compositionPlan.id,
    mediaRequirementsPlanId: scenePackage.mediaRequirementsPlan.id,
    audioLayerPlanId: scenePackage.audioLayerPlan.id,
    target: Object.freeze({
      experience: "android_priority",
      format: mission.strategyBriefing.constraints.format,
      resolutionStatus: "pending_local_capability_validation",
      codecStatus: "pending_local_capability_validation"
    }),
    inputs: Object.freeze({
      visualMedia: Object.freeze({
        status: "not_materialized",
        requirements: scenePackage.mediaRequirementsPlan.requirements.length
      }),
      narrationAudio: Object.freeze({
        status: "not_materialized",
        segments: scenePackage.narrationAsset.segments.length
      }),
      backgroundMusic: Object.freeze({ status: "not_selected" }),
      soundEffects: Object.freeze({
        status: "not_selected",
        cues: scenePackage.audioLayerPlan.tracks.soundEffects.cues.length
      }),
      captions: Object.freeze({ status: "structural_ready" })
    }),
    blockers: Object.freeze([
      "rights_cleared_visual_media_missing",
      "narration_audio_missing",
      "rights_cleared_background_music_missing",
      "rights_cleared_sound_effects_missing"
    ]),
    renderAllowed: false,
    executionStatus: "not_started",
    outputFile: null,
    validation: Object.freeze({
      sourceLinksValid: true,
      renderBlockedSafely: true,
      estimatesClassified: true,
      externalConnectionsDisabled: true
    }),
    safety: Object.freeze({
      publishesContent: false,
      connectsAccount: false,
      requestsCredentials: false,
      createsCharge: false
    }),
    externalConnections: false
  });
  const continuation = Object.freeze({
    ...scenePackage.continuation,
    lastCompletedPoint: 69,
    nextPoint: 70
  });
  const updated = updateScenePackage(
    scenePackage,
    { renderPlan, continuation },
    "render_preparation_planned",
    now
  );
  return assertCandidate(mission, updated);
}

export function closeValidatedScenePackage({
  mission,
  validationId = randomUUID(),
  closureId = randomUUID(),
  now = new Date()
}) {
  const scenePackage = requireScenePackage(mission);
  if (scenePackage.status !== "render_preparation_planned") {
    throw new ScenePackageValidationError(
      "Feche o pacote de cenas somente depois do plano local de renderização."
    );
  }
  const scenePackageValidation = Object.freeze({
    schemaVersion: 1,
    id: validationId,
    kind: "scene_package_validation",
    status: "valid",
    createdAt: now.toISOString(),
    scenePackageId: scenePackage.id,
    renderPlanId: scenePackage.renderPlan.id,
    checks: Object.freeze({
      sourceLinksValid: true,
      stageOrderValid: true,
      textPreserved: true,
      dynamicVisualStructureValid: true,
      audioLayersStructured: true,
      estimatesClearlyClassified: true,
      rightsRequiredBeforeUse: true,
      renderBlockedWithoutAssets: true,
      externalConnectionsDisabled: true,
      safetyRestrictionsPreserved: true
    }),
    externalConnections: false
  });
  const closure = Object.freeze({
    schemaVersion: 1,
    id: closureId,
    kind: "scene_package_closure",
    status: "closed",
    createdAt: now.toISOString(),
    scenePackageId: scenePackage.id,
    validationId: scenePackageValidation.id,
    structuralPackageComplete: true,
    realMediaExecutionPending: true,
    readyForValidationSafety: true,
    nextStage: "validation-safety",
    renderExecuted: false,
    published: false,
    externalConnections: false
  });
  const continuation = Object.freeze({
    ...scenePackage.continuation,
    status: "closed",
    nextStage: "validation-safety",
    lastCompletedPoint: 70,
    nextPoint: 71,
    externalConnections: false
  });
  const updated = updateScenePackage(
    scenePackage,
    { scenePackageValidation, closure, continuation },
    "ready_for_validation_safety",
    now
  );
  return assertCandidate(mission, updated);
}
