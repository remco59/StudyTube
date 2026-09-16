import {
  parseStudyTubeProject,
  type StudyTubeProject,
  type StudyTubeScene,
} from "@studytube/schema";
import type { NarrationManifest } from "./captions";

export const DEFAULT_FPS = 30;
export const DEFAULT_SCENE_PADDING_SECONDS = 0.35;
export const DEFAULT_ESTIMATED_WORDS_PER_MINUTE = 155;
export const MINIMUM_ESTIMATED_NARRATION_SECONDS = 2.25;
export const DEFAULT_MULTIPLE_CHOICE_THINKING_SECONDS = 5;
export const MULTIPLE_CHOICE_ANSWER_HOLD_SECONDS = 2;

export type NarrationDurationProvider = (
  scene: StudyTubeScene,
) => number | Promise<number>;

export type NormalizeProjectOptions = {
  fps?: number;
  scenePaddingSeconds?: number;
  narrationDurationProvider?: NarrationDurationProvider;
};

export type NormalizedScene = {
  scene: StudyTubeScene;
  chapterId: string;
  chapterIndex: number;
  sceneIndex: number;
  globalSceneIndex: number;
  startFrame: number;
  endFrameExclusive: number;
  durationInFrames: number;
  narrationDurationSeconds: number;
  durationSeconds: number;
};

export type NormalizedChapter = {
  id: string;
  title: string;
  chapterIndex: number;
  startFrame: number;
  endFrameExclusive: number;
  durationInFrames: number;
  durationSeconds: number;
  scenes: NormalizedScene[];
};

export type NormalizedStudyTubeProject = {
  project: StudyTubeProject;
  fps: number;
  startFrame: 0;
  endFrameExclusive: number;
  totalFrames: number;
  totalDurationSeconds: number;
  chapters: NormalizedChapter[];
};

export class StudyTubeTimingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudyTubeTimingError";
  }
}

export const secondsToFrames = (seconds: number, fps = DEFAULT_FPS): number => {
  assertPositiveFiniteNumber(seconds, "seconds");
  assertPositiveFiniteNumber(fps, "fps");
  return Math.max(1, Math.ceil(seconds * fps));
};

export const framesToSeconds = (frames: number, fps = DEFAULT_FPS): number => {
  if (!Number.isInteger(frames) || frames < 0) {
    throw new StudyTubeTimingError("frames must be a non-negative integer");
  }
  assertPositiveFiniteNumber(fps, "fps");
  return frames / fps;
};

export const estimateNarrationDurationSeconds = (
  narration: string,
  wordsPerMinute = DEFAULT_ESTIMATED_WORDS_PER_MINUTE,
): number => {
  assertPositiveFiniteNumber(wordsPerMinute, "wordsPerMinute");
  const wordCount = narration.trim().split(/\s+/u).filter(Boolean).length;
  const spokenSeconds = (wordCount / wordsPerMinute) * 60;
  return Math.max(MINIMUM_ESTIMATED_NARRATION_SECONDS, spokenSeconds);
};

const countWords = (value: string): number =>
  value.trim().split(/\s+/u).filter(Boolean).length;

export const resolveMultipleChoiceThinkingSeconds = (
  scene: StudyTubeScene,
): number => {
  if (scene.type !== "multipleChoice") return 0;

  const questionWords = countWords(scene.visual.question);
  const optionWords = scene.visual.options.reduce(
    (total, option) => total + countWords(option.label),
    0,
  );
  const optionCharacters = scene.visual.options.reduce(
    (total, option) => total + option.label.length,
    0,
  );
  const averageOptionCharacters = optionCharacters / scene.visual.options.length;

  let automaticThinkingSeconds = DEFAULT_MULTIPLE_CHOICE_THINKING_SECONDS;
  if (questionWords > 16 || scene.visual.question.length > 100) {
    automaticThinkingSeconds += 1;
  }
  if (scene.visual.options.length >= 4) {
    automaticThinkingSeconds += 1;
  }
  if (optionWords > 28 || averageOptionCharacters > 45) {
    automaticThinkingSeconds += 1;
  }

  return Math.max(
    automaticThinkingSeconds,
    scene.visual.revealAfterSeconds ?? 0,
  );
};

export const estimatedNarrationDurationProvider: NarrationDurationProvider = (
  scene,
) => estimateNarrationDurationSeconds(scene.narration);

export const normalizeStudyTubeProject = async (
  input: unknown,
  options: NormalizeProjectOptions = {},
): Promise<NormalizedStudyTubeProject> => {
  const project = parseStudyTubeProject(input);
  const fps = options.fps ?? DEFAULT_FPS;
  const scenePaddingSeconds =
    options.scenePaddingSeconds ?? DEFAULT_SCENE_PADDING_SECONDS;
  const durationProvider =
    options.narrationDurationProvider ?? estimatedNarrationDurationProvider;

  assertPositiveFiniteNumber(fps, "fps");
  if (!Number.isFinite(scenePaddingSeconds) || scenePaddingSeconds < 0) {
    throw new StudyTubeTimingError(
      "scenePaddingSeconds must be a finite number greater than or equal to zero",
    );
  }

  let cursorFrame = 0;
  let globalSceneIndex = 0;
  const chapters: NormalizedChapter[] = [];

  for (const [chapterIndex, chapter] of project.chapters.entries()) {
    const chapterStartFrame = cursorFrame;
    const normalizedScenes: NormalizedScene[] = [];

    for (const [sceneIndex, scene] of chapter.scenes.entries()) {
      const narrationDurationSeconds = await durationProvider(scene);
      assertPositiveFiniteNumber(
        narrationDurationSeconds,
        `narration duration for scene ${scene.id}`,
      );

      const quizTailSeconds =
        scene.type === "multipleChoice"
          ? resolveMultipleChoiceThinkingSeconds(scene) +
            MULTIPLE_CHOICE_ANSWER_HOLD_SECONDS
          : 0;
      const requestedDurationSeconds =
        narrationDurationSeconds + scenePaddingSeconds + quizTailSeconds;
      const durationInFrames = secondsToFrames(requestedDurationSeconds, fps);
      const durationSeconds = framesToSeconds(durationInFrames, fps);
      const startFrame = cursorFrame;
      const endFrameExclusive = startFrame + durationInFrames;

      normalizedScenes.push({
        scene,
        chapterId: chapter.id,
        chapterIndex,
        sceneIndex,
        globalSceneIndex,
        startFrame,
        endFrameExclusive,
        durationInFrames,
        narrationDurationSeconds,
        durationSeconds,
      });

      globalSceneIndex += 1;
      cursorFrame = endFrameExclusive;
    }

    const durationInFrames = cursorFrame - chapterStartFrame;
    chapters.push({
      id: chapter.id,
      title: chapter.title,
      chapterIndex,
      startFrame: chapterStartFrame,
      endFrameExclusive: cursorFrame,
      durationInFrames,
      durationSeconds: framesToSeconds(durationInFrames, fps),
      scenes: normalizedScenes,
    });
  }

  return {
    project,
    fps,
    startFrame: 0,
    endFrameExclusive: cursorFrame,
    totalFrames: cursorFrame,
    totalDurationSeconds: framesToSeconds(cursorFrame, fps),
    chapters,
  };
};

const assertPositiveFiniteNumber = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new StudyTubeTimingError(`${label} must be a finite number greater than zero`);
  }
};

export type GlobalCaptionCue = {
  text: string;
  startSeconds: number;
  endSeconds: number;
};

/**
 * Narration audio for each scene starts exactly at that scene's global
 * startFrame (see apps/renderer's StudyTubeComposition), so a scene's own
 * caption cues, which are timed relative to the start of its narration
 * track, can be placed on the whole video's timeline by adding that offset.
 */
export const buildGlobalCaptionCues = (
  normalizedProject: NormalizedStudyTubeProject,
  narration: NarrationManifest,
): GlobalCaptionCue[] => {
  const fps = normalizedProject.fps;
  const cues: GlobalCaptionCue[] = [];
  for (const chapter of normalizedProject.chapters) {
    for (const scene of chapter.scenes) {
      const track = narration[scene.scene.id];
      if (!track) continue;
      for (const cue of track.captions) {
        cues.push({
          text: cue.text,
          startSeconds: framesToSeconds(scene.startFrame + cue.startFrame, fps),
          endSeconds: framesToSeconds(scene.startFrame + cue.endFrameExclusive, fps),
        });
      }
    }
  }
  return cues;
};

const formatCaptionTimestamp = (seconds: number, millisecondsSeparator: string): string => {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(wholeSeconds)}${millisecondsSeparator}${pad(milliseconds, 3)}`;
};

export const formatSrtTimestamp = (seconds: number): string => formatCaptionTimestamp(seconds, ",");
export const formatVttTimestamp = (seconds: number): string => formatCaptionTimestamp(seconds, ".");

export const captionCuesToSrt = (cues: GlobalCaptionCue[]): string =>
  cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatSrtTimestamp(cue.startSeconds)} --> ${formatSrtTimestamp(cue.endSeconds)}\n${cue.text}\n`,
    )
    .join("\n");

export const captionCuesToVtt = (cues: GlobalCaptionCue[]): string =>
  `WEBVTT\n\n${cues
    .map((cue) => `${formatVttTimestamp(cue.startSeconds)} --> ${formatVttTimestamp(cue.endSeconds)}\n${cue.text}\n`)
    .join("\n")}`;

export * from "./captions";