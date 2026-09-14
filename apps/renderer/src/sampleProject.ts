import type {NormalizedStudyTubeProject} from "@studytube/core";

const project = {
  version: "1.0" as const,
  metadata: {
    title: "StudyTube composition demo",
    language: "nl-NL",
    targetDuration: 60,
    style: "educational-explainer" as const,
    description: "Developer fixture for the composition shell.",
  },
  chapters: [
    {
      id: "intro",
      title: "Waarom StudyTube?",
      scenes: [
        {
          id: "intro-title",
          type: "title" as const,
          narration: "Van studiemateriaal naar een video zonder handmatige montage.",
          motion: "scale" as const,
          visual: {
            eyebrow: "StudyTube",
            title: "Leren als een YouTube-video",
            subtitle: "Automatisch opgebouwd uit gestructureerde scenes.",
          },
        },
        {
          id: "intro-text",
          type: "kineticText" as const,
          narration: "Elke scene krijgt een duidelijke rol, timing en gecontroleerde beweging.",
          motion: "slide" as const,
          visual: {
            text: "Inhoud → scenes → video",
            emphasis: ["scenes", "video"],
          },
        },
        {
          id: "intro-compare",
          type: "comparison" as const,
          narration: "De renderer scheidt de inhoud van de uiteindelijke visuele uitvoering.",
          motion: "cameraPush" as const,
          visual: {
            left: {title: "JSON", body: "Wat moet worden verteld"},
            right: {title: "Renderer", body: "Hoe het in beeld verschijnt"},
            versusLabel: "→",
          },
        },
      ],
    },
  ],
};

export const SAMPLE_NORMALIZED_PROJECT: NormalizedStudyTubeProject = {
  project,
  fps: 30,
  startFrame: 0,
  endFrameExclusive: 390,
  totalFrames: 390,
  totalDurationSeconds: 13,
  chapters: [
    {
      id: "intro",
      title: "Waarom StudyTube?",
      chapterIndex: 0,
      startFrame: 0,
      endFrameExclusive: 390,
      durationInFrames: 390,
      durationSeconds: 13,
      scenes: [
        {
          scene: project.chapters[0].scenes[0],
          chapterId: "intro",
          chapterIndex: 0,
          sceneIndex: 0,
          globalSceneIndex: 0,
          startFrame: 0,
          endFrameExclusive: 120,
          durationInFrames: 120,
          narrationDurationSeconds: 3.65,
          durationSeconds: 4,
        },
        {
          scene: project.chapters[0].scenes[1],
          chapterId: "intro",
          chapterIndex: 0,
          sceneIndex: 1,
          globalSceneIndex: 1,
          startFrame: 120,
          endFrameExclusive: 255,
          durationInFrames: 135,
          narrationDurationSeconds: 4.15,
          durationSeconds: 4.5,
        },
        {
          scene: project.chapters[0].scenes[2],
          chapterId: "intro",
          chapterIndex: 0,
          sceneIndex: 2,
          globalSceneIndex: 2,
          startFrame: 255,
          endFrameExclusive: 390,
          durationInFrames: 135,
          narrationDurationSeconds: 4.15,
          durationSeconds: 4.5,
        },
      ],
    },
  ],
};
