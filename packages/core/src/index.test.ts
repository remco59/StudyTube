import {describe, expect, it} from "vitest";
import {
  estimateNarrationDurationSeconds,
  framesToSeconds,
  normalizeStudyTubeProject,
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

  it("rejects invalid duration-provider output", async () => {
    await expect(
      normalizeStudyTubeProject(project, {
        narrationDurationProvider: () => Number.NaN,
      }),
    ).rejects.toThrow(StudyTubeTimingError);
  });
});
