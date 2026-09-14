import type {
  NormalizedChapter,
  NormalizedScene,
  NormalizedStudyTubeProject,
} from "@studytube/core";

const FPS = 30;

const project = {
  version: "1.0",
  metadata: {
    title: "StudyTube scene library demo",
    language: "nl-NL",
    targetDuration: 60,
    style: "educational-explainer",
    description: "Developer fixture demonstrating the first production scene set.",
  },
  chapters: [
    {
      id: "intro",
      title: "Waarom StudyTube?",
      scenes: [
        {
          id: "intro-title",
          type: "title",
          narration: "Van studiemateriaal naar een video zonder handmatige montage.",
          motion: "scale",
          visual: {
            eyebrow: "StudyTube",
            title: "Leren als een YouTube-video",
            subtitle: "Een renderer die inhoud omzet in een visueel verhaal.",
          },
        },
        {
          id: "intro-chapter",
          type: "chapterIntro",
          narration: "Eerst kijken we naar de bouwstenen van een goede explainervideo.",
          motion: "slide",
          visual: {
            chapterLabel: "Hoofdstuk 1",
            title: "Van theorie naar visueel verhaal",
            subtitle: "Niet iedere zin verdient dezelfde soort scene.",
          },
        },
        {
          id: "intro-kinetic",
          type: "kineticText",
          narration: "De kern is simpel: inhoud wordt scenes en scenes worden video.",
          motion: "reveal",
          visual: {
            text: "Inhoud wordt scenes. Scenes worden video.",
            emphasis: ["scenes", "video"],
          },
        },
        {
          id: "intro-definition",
          type: "definition",
          narration: "Een scene is één duidelijke visuele gedachte met een eigen doel.",
          motion: "fade",
          visual: {
            term: "Scene",
            definition: "Eén visuele gedachte die precies ondersteunt wat de voice-over op dat moment uitlegt.",
            example: "Een definitie, vergelijking, vraag of opvallend getal.",
          },
        },
      ],
    },
    {
      id: "visual-storytelling",
      title: "Visueel vertellen",
      scenes: [
        {
          id: "visual-number",
          type: "bigNumber",
          narration: "Een vijftien minuten video kan makkelijk meer dan honderd visuele momenten bevatten.",
          motion: "slam",
          visual: {
            value: "100+",
            label: "visuele momenten",
            context: "Snelle afwisseling voorkomt dat een uitlegvideo aanvoelt als een gesproken PowerPoint.",
          },
        },
        {
          id: "visual-comparison",
          type: "comparison",
          narration: "Dezelfde inhoud voelt totaal anders als je van slides naar visueel vertellen gaat.",
          motion: "cameraPush",
          visual: {
            left: {
              title: "Slides",
              body: "Veel tekst tegelijk. De kijker moet zelf bepalen waar de aandacht heen moet.",
              icon: "▤",
            },
            right: {
              title: "Storytelling",
              body: "Eén idee per moment. Beweging en hiërarchie sturen de aandacht.",
              icon: "▶",
            },
            versusLabel: "→",
          },
        },
        {
          id: "visual-question",
          type: "question",
          narration: "Maar welke informatie moet de kijker over tien minuten nog steeds onthouden?",
          motion: "scale",
          visual: {
            question: "Wat moet blijven hangen?",
            prompt: "Die vraag bepaalt welke beelden en herhaling de uitleg nodig heeft.",
          },
        },
        {
          id: "visual-recap",
          type: "recap",
          narration: "Kortom: maak het visueel, geef elk moment één functie en stuur de aandacht bewust.",
          motion: "fade",
          visual: {
            title: "Drie regels voor StudyTube",
            points: [
              "Eén duidelijke gedachte per scene",
              "Gebruik beweging om aandacht te sturen",
              "Laat de visual uitleggen in plaats van alleen versieren",
            ],
          },
        },
      ],
    },
  ],
} satisfies NormalizedStudyTubeProject["project"];

const durationBySceneId: Record<string, number> = {
  "intro-title": 150,
  "intro-chapter": 150,
  "intro-kinetic": 135,
  "intro-definition": 165,
  "visual-number": 135,
  "visual-comparison": 180,
  "visual-question": 150,
  "visual-recap": 180,
};

const buildSampleProject = (): NormalizedStudyTubeProject => {
  let cursor = 0;
  let globalSceneIndex = 0;

  const chapters: NormalizedChapter[] = project.chapters.map(
    (chapter, chapterIndex) => {
      const chapterStart = cursor;
      const scenes: NormalizedScene[] = chapter.scenes.map((scene, sceneIndex) => {
        const durationInFrames = durationBySceneId[scene.id];
        if (!durationInFrames) {
          throw new Error(`Missing sample duration for scene ${scene.id}`);
        }

        const startFrame = cursor;
        cursor += durationInFrames;
        const durationSeconds = durationInFrames / FPS;
        const normalizedScene: NormalizedScene = {
          scene,
          chapterId: chapter.id,
          chapterIndex,
          sceneIndex,
          globalSceneIndex,
          startFrame,
          endFrameExclusive: cursor,
          durationInFrames,
          narrationDurationSeconds: Math.max(0.1, durationSeconds - 0.35),
          durationSeconds,
        };
        globalSceneIndex += 1;
        return normalizedScene;
      });

      return {
        id: chapter.id,
        title: chapter.title,
        chapterIndex,
        startFrame: chapterStart,
        endFrameExclusive: cursor,
        durationInFrames: cursor - chapterStart,
        durationSeconds: (cursor - chapterStart) / FPS,
        scenes,
      };
    },
  );

  return {
    project,
    fps: FPS,
    startFrame: 0,
    endFrameExclusive: cursor,
    totalFrames: cursor,
    totalDurationSeconds: cursor / FPS,
    chapters,
  };
};

export const SAMPLE_NORMALIZED_PROJECT = buildSampleProject();
