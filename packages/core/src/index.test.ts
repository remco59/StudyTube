import {describe, expect, it} from "vitest";
import {
  estimateNarrationDurationSeconds,
  framesToSeconds,
  normalizeStudyTubeProject,
  resolveMultipleChoiceThinkingSeconds,
  secondsToFrames,
  StudyTubeTimingError,
} from "./index";

const project = {
  version: "1.0",
  metadata: {
    title: "Timing test",
    language: "nl-NL",
    targetDuration: 120,
    style: "educational-explainer",
  },
  chapters: [
    {
      id: "one",
      title: "One",
      scenes: [
        {
          id: "one-a",
          type: "kineticText",
          narration: "Dit is de eerste scene.",
          visual: {text: "Eerste scene"},
        },
        {
          id: "one-b",
          type: "question",
          narration: "En wat gebeurt er daarna?",
          visual: {question: "Wat nu?"},
        },
      ],
    },
    {
      id: "two",
      title: "Two",
      scenes: [
        {
          id: "two-a",
          type: "recap",
          narration: "Dan vatten we alles samen.",
          visual: {points: ["Een", "Twee"]},
        },
      ],
    },
  ],
};

const quizProject = {
  version: "1.0",
  metadata: {
    title: "Quiz timing test",
    language: "nl-NL",
    targetDuration: 30,
    style: "educational-explainer",
  },
  chapters: [
    {
      id: "quiz",
      title: "Quiz",
      scenes: [
        {
          id: "quiz-simple",
          type: "multipleChoice",
          narration: "Welke optie is juist?",
          visual: {
            question: "Welke optie is juist?",
            options: [{label: "Optie A"}, {label: "Optie B"}],
            correctIndex: 1,
            revealAfterSeconds: 3,
          },
        },
        {
          id: "quiz-complex",
          type: "multipleChoice",
          narration: "Kies de beste verklaring.",
          visual: {
            question:
              "Welke verklaring past het beste wanneer meerdere factoren tegelijk veranderen en je de onderlinge relaties moet beoordelen?",
            options: [
              {label: "Een korte maar onvolledige verklaring zonder onderbouwing"},
              {label: "Een verklaring die slechts één factor los van de rest bekijkt"},
              {label: "Een verklaring die de relevante factoren en hun samenhang meeweegt"},
              {label: "Een verklaring die uitsluitend naar de laatste waarneming kijkt"},
            ],
            correctIndex: 2,
          },
        },
      ],
    },
  ],
};

describe("frame helpers", () => {
  it("rounds duration up to a complete frame", () => {
    expect(secondsToFrames(1.01, 30)).toBe(31);
    expect(framesToSeconds(45, 30)).toBe(1.5);
  });

  it("rejects invalid timing values", () => {
    expect(() => secondsToFrames(0, 30)).toThrow(StudyTubeTimingError);
    expect(() => framesToSeconds(-1, 30)).toThrow(StudyTubeTimingError);
  });
});

describe("narration estimates", () => {
  it("always returns a useful minimum estimate", () => {
    expect(estimateNarrationDurationSeconds("Kort.")).toBeGreaterThanOrEqual(2.25);
  });
});

describe("normalizeStudyTubeProject", () => {
  it("assigns deterministic contiguous frame ranges", async () => {
    const normalized = await normalizeStudyTubeProject(project, {
      fps: 30,
      scenePaddingSeconds: 0.5,
      narrationDurationProvider: () => 2,
    });

    expect(normalized.totalFrames).toBe(225);
    expect(normalized.chapters[0].startFrame).toBe(0);
    expect(normalized.chapters[0].endFrameExclusive).toBe(150);
    expect(normalized.chapters[1].startFrame).toBe(150);

    const scenes = normalized.chapters.flatMap((chapter) => chapter.scenes);
    expect(scenes.map((scene) => scene.startFrame)).toEqual([0, 75, 150]);
    expect(scenes.map((scene) => scene.endFrameExclusive)).toEqual([75, 150, 225]);
    expect(scenes.map((scene) => scene.globalSceneIndex)).toEqual([0, 1, 2]);
  });

  it("adds thinking time and a visible-answer hold after quiz narration", async () => {
    const normalized = await normalizeStudyTubeProject(quizProject, {
      fps: 30,
      scenePaddingSeconds: 0.5,
      narrationDurationProvider: () => 2,
    });
    const [simpleQuiz] = normalized.chapters[0].scenes;

    expect(resolveMultipleChoiceThinkingSeconds(simpleQuiz.scene)).toBe(5);
    expect(simpleQuiz.durationSeconds).toBe(9.5);
    expect(simpleQuiz.durationInFrames).toBe(285);
  });

  it("automatically gives complex quiz questions more thinking time", async () => {
    const normalized = await normalizeStudyTubeProject(quizProject, {
      fps: 30,
      scenePaddingSeconds: 0.5,
      narrationDurationProvider: () => 2,
    });
    const complexQuiz = normalized.chapters[0].scenes[1];

    expect(resolveMultipleChoiceThinkingSeconds(complexQuiz.scene)).toBeGreaterThan(5);
    expect(complexQuiz.durationSeconds).toBeGreaterThan(9.5);
  });

  it("rejects invalid duration-provider output", async () => {
    await expect(
      normalizeStudyTubeProject(project, {
        narrationDurationProvider: () => Number.NaN,
      }),
    ).rejects.toThrow(StudyTubeTimingError);
  });
});