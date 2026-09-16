import {describe,expect,it} from "vitest";
import {isCompactVersusLabel} from "./SafeComparisonScene";

describe("comparison layout safety",()=>{
  it("keeps short connector labels in the middle column",()=>{
    expect(isCompactVersusLabel("VS")).toBe(true);
    expect(isCompactVersusLabel("of juist")).toBe(true);
  });

  it("moves descriptive connector text out of the narrow middle column",()=>{
    expect(isCompactVersusLabel("begrijpen vs. veranderen")).toBe(false);
    expect(isCompactVersusLabel("verklaren en verbeteren")).toBe(false);
  });
});
