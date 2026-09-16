import {describe, expect, it} from "vitest";
import {
  parseStudyTubeJson,
  safeParseStudyTubeProject,
  STUDYTUBE_SCHEMA_VERSION,
  StudyTubeValidationError,
} from "./index";

const validProject = {
  version: STUDYTUBE_SCHEMA_VERSION,
  metadata: {
    title: "Design Science uitgelegd",
    language: "nl-NL",
    targetDuration: 900,
    style: "educational-explainer" as const,
  },
  chapters: [
    {
      id: "intro",
      title: "Waarom Design Science?",
      scenes: [
        {
          id: "intro-01",
          type: "kineticText" as const,
          narration: "Onderzoek hoeft niet alleen uit te leggen hoe de wereld werkt.",
          visual: {text: "ONDERZOEK"},
        },
      ],
    },
  ],
};

describe("studyTubeProjectSchema", () => {
  it("accepts a valid project", () => {
    const result = safeParseStudyTubeProject(validProject);
    expect(result.success).toBe(true);
  });

  it("accepts every design-system style preset", () => {
    for (const style of ["educational-explainer", "midnight-focus"]) {
      const result = safeParseStudyTubeProject({...validProject, metadata: {...validProject.metadata, style}});
      expect(result.success).toBe(true);
    }
  });

  it("rejects a style that isn't a defined design-system preset", () => {
    const result = safeParseStudyTubeProject({...validProject, metadata: {...validProject.metadata, style: "cyberpunk"}});
    expect(result.success).toBe(false);
  });

  it("rejects unsupported schema versions", () => {
    const result = safeParseStudyTubeProject({...validProject, version: "2.0"});
    expect(result.success).toBe(false);
  });

  it("rejects unsupported scene types", () => {
    const project = structuredClone(validProject) as Record<string, unknown>;
    const chapters = project.chapters as Array<{scenes: Array<Record<string, unknown>>}>;
    chapters[0].scenes[0].type = "magicScene";

    const result = safeParseStudyTubeProject(project);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate scene ids", () => {
    const project = structuredClone(validProject);
    project.chapters[0].scenes.push({...project.chapters[0].scenes[0]});

    const result = safeParseStudyTubeProject(project);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("Duplicate scene id"))).toBe(true);
    }
  });

  it("rejects missing asset references", () => {
    const project = structuredClone(validProject) as any;
    project.chapters[0].scenes = [
      {
        id: "image-01",
        type: "image",
        narration: "Dit is de afbeelding waar we naar kijken.",
        visual: {assetId: "missing-image"},
      },
    ];

    const result = safeParseStudyTubeProject(project);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === "Unknown asset: missing-image")).toBe(true);
    }
  });

  it("keeps legacy image scenes valid without an explicit variant", () => {
    const project = structuredClone(validProject) as any;
    project.assets = {hero: {type: "image", path: "assets/hero.png", alt: "Hero image"}};
    project.chapters[0].scenes = [
      {
        id: "image-legacy",
        type: "image",
        narration: "Een bestaande image scene blijft werken.",
        visual: {assetId: "hero", fit: "cover", caption: "Legacy layout"},
      },
    ];

    expect(safeParseStudyTubeProject(project).success).toBe(true);
  });

  it("accepts split-text image scenes", () => {
    const project = structuredClone(validProject) as any;
    project.assets = {hero: {type: "image", path: "assets/hero.png", alt: "Hero image"}};
    project.chapters[0].scenes = [
      {
        id: "image-split-text",
        type: "image",
        narration: "De afbeelding en uitleg staan naast elkaar.",
        visual: {
          assetId: "hero",
          variant: "split-text",
          layout: "image-left",
          splitRatio: "60/40",
          fit: "contain",
          title: "Design science",
          text: "Een visuele uitleg naast de bronafbeelding.",
        },
      },
    ];

    expect(safeParseStudyTubeProject(project).success).toBe(true);
  });

  it("requires text content for split-text image scenes", () => {
    const project = structuredClone(validProject) as any;
    project.assets = {hero: {type: "image", path: "assets/hero.png"}};
    project.chapters[0].scenes = [
      {
        id: "image-split-text-empty",
        type: "image",
        narration: "Deze split scene mist tekst.",
        visual: {assetId: "hero", variant: "split-text"},
      },
    ];

    const result = safeParseStudyTubeProject(project);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("split-text image scenes require"))).toBe(true);
    }
  });

  it("accepts split-image scenes and validates the second asset", () => {
    const project = structuredClone(validProject) as any;
    project.assets = {
      left: {type: "image", path: "assets/left.png"},
      right: {type: "image", path: "assets/right.png"},
    };
    project.chapters[0].scenes = [
      {
        id: "image-split-image",
        type: "image",
        narration: "Twee beelden worden naast elkaar vergeleken.",
        visual: {
          assetId: "left",
          variant: "split-image",
          secondaryAssetId: "right",
          splitRatio: "50/50",
          fit: "contain",
          secondaryFit: "contain",
        },
      },
    ];

    expect(safeParseStudyTubeProject(project).success).toBe(true);

    project.chapters[0].scenes[0].visual.secondaryAssetId = "missing-right";
    const missingResult = safeParseStudyTubeProject(project);
    expect(missingResult.success).toBe(false);
    if (!missingResult.success) {
      expect(missingResult.error.issues.some((issue) => issue.message === "Unknown asset: missing-right")).toBe(true);
    }
  });

  it("reports JSON syntax errors as StudyTube validation errors", () => {
    expect(() => parseStudyTubeJson("{ definitely not json }")).toThrow(StudyTubeValidationError);
  });
});