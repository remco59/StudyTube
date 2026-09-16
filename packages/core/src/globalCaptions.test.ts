import {describe, expect, it} from "vitest";
import {
  buildGlobalCaptionCues,
  captionCuesToSrt,
  captionCuesToVtt,
  formatSrtTimestamp,
  formatVttTimestamp,
  normalizeStudyTubeProject,
  type NarrationManifest,
} from "./index";

const project = {
  version: "1.0",
  metadata: {
    title: "Caption export test",
    language: "nl-NL",
    targetDuration: 120,
    style: "educational-explainer",
  },
  chapters: [
    {
      id: "one",
      title: "One",
      scenes: [
        {id: "one-a", type: "kineticText", narration: "Dit is de eerste scene.", visual: {text: "Eerste scene"}},
        {id: "one-b", type: "question", narration: "En wat gebeurt er daarna?", visual: {question: "Wat nu?"}},
      ],
    },
  ],
};

describe("buildGlobalCaptionCues", () => {
  it("offsets each scene's local caption frames by its global start frame", async () => {
    const normalized = await normalizeStudyTubeProject(project, {
      fps: 30,
      scenePaddingSeconds: 0.5,
      narrationDurationProvider: () => 2,
    });
    const narration: NarrationManifest = {
      "one-a": {
        sourcePath: "audio/one-a.wav",
        durationSeconds: 2,
        captions: [{text: "Dit is de eerste scene.", startFrame: 0, endFrameExclusive: 60, durationInFrames: 60}],
      },
      "one-b": {
        sourcePath: "audio/one-b.wav",
        durationSeconds: 2,
        captions: [{text: "En wat gebeurt er daarna?", startFrame: 0, endFrameExclusive: 60, durationInFrames: 60}],
      },
    };

    const cues = buildGlobalCaptionCues(normalized, narration);
    expect(cues).toEqual([
      {text: "Dit is de eerste scene.", startSeconds: 0, endSeconds: 2},
      {text: "En wat gebeurt er daarna?", startSeconds: 2.5, endSeconds: 4.5},
    ]);
  });

  it("skips scenes with no narration track", async () => {
    const normalized = await normalizeStudyTubeProject(project, {narrationDurationProvider: () => 2});
    expect(buildGlobalCaptionCues(normalized, {})).toEqual([]);
  });
});

describe("caption timestamp formatting", () => {
  it("formats SRT timestamps with a comma millisecond separator", () => {
    expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
    expect(formatSrtTimestamp(65.5)).toBe("00:01:05,500");
    expect(formatSrtTimestamp(3725.001)).toBe("01:02:05,001");
  });

  it("formats VTT timestamps with a dot millisecond separator", () => {
    expect(formatVttTimestamp(65.5)).toBe("00:01:05.500");
  });
});

describe("caption export formats", () => {
  const cues = [
    {text: "Hello there.", startSeconds: 0, endSeconds: 1.2},
    {text: "Second line.", startSeconds: 1.2, endSeconds: 2.75},
  ];

  it("produces a numbered SRT document", () => {
    expect(captionCuesToSrt(cues)).toBe(
      "1\n00:00:00,000 --> 00:00:01,200\nHello there.\n\n2\n00:00:01,200 --> 00:00:02,750\nSecond line.\n",
    );
  });

  it("produces a WEBVTT document", () => {
    expect(captionCuesToVtt(cues)).toBe(
      "WEBVTT\n\n00:00:00.000 --> 00:00:01.200\nHello there.\n\n00:00:01.200 --> 00:00:02.750\nSecond line.\n",
    );
  });
});
