import {
  parseStudyTubeProject,
  type StudyTubeProject,
  type StudyTubeScene,
} from "@studytube/schema";

export const DEFAULT_FPS = 30;
export const DEFAULT_SCENE_PADDING_SECONDS = 0.35;
export const DEFAULT_ESTIMATED_WORDS_PER_MINUTE = 155;
export const MINIMUM_ESTIMATED_NARRATION_SECONDS = 2.25;

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

      const requestedDurationSeconds =
        narrationDurationSeconds + scenePaddingSeconds;
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
