import {describe,expect,it} from "vitest";
import {
  getCompactVersusColumnWidth,
  getCompactVersusFontSize,
  isCompactVersusLabel,
} from "./SafeComparisonScene";

describe("comparison layout safety",()=>{
  it("keeps short connector labels in the middle column",()=>{
    expect(isCompactVersusLabel("VS")).toBe(true);
    expect(isCompactVersusLabel("of juist")).toBe(true);
    expect(isCompactVersusLabel("contrast")).toBe(true);
  });

  it("gives longer compact labels enough horizontal room",()=>{
    expect(getCompactVersusColumnWidth("VS")).toBe(130);
    expect(getCompactVersusColumnWidth("contrast")).toBeGreaterThanOrEqual(220);
    expect(getCompactVersusFontSize("contrast")).toBeLessThan(50);
  });

  it("moves descriptive connector text out of the narrow middle column",()=>{
    expect(isCompactVersusLabel("begrijpen vs. veranderen")).toBe(false);
    expect(isCompactVersusLabel("verklaren en verbeteren")).toBe(false);
  });
});
