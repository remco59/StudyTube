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

  it("reports JSON syntax errors as StudyTube validation errors", () => {
    expect(() => parseStudyTubeJson("{ definitely not json }")).toThrow(StudyTubeValidationError);
  });
});
