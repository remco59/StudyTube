import {describe, expect, it} from "vitest";
import {
  getAdaptiveGridColumns,
  getFlowchartPositions,
  getOrbitPositions,
} from "./structuredLayout";

describe("getAdaptiveGridColumns", () => {
  it("keeps small sets on one row and balances larger sets", () => {
    expect(getAdaptiveGridColumns(2)).toBe(2);
    expect(getAdaptiveGridColumns(4)).toBe(4);
    expect(getAdaptiveGridColumns(5)).toBe(3);
    expect(getAdaptiveGridColumns(8)).toBe(4);
  });
});

describe("getFlowchartPositions", () => {
  it("keeps all supported node counts inside the canvas", () => {
    for (let count = 2; count <= 12; count += 1) {
      const positions = getFlowchartPositions(count, 1500, 500);
      expect(positions).toHaveLength(count);
      for (const point of positions) {
        expect(point.x).toBeGreaterThanOrEqual(150);
        expect(point.x).toBeLessThanOrEqual(1350);
        expect(point.y).toBeGreaterThanOrEqual(70);
        expect(point.y).toBeLessThanOrEqual(430);
      }
    }
  });
});

describe("getOrbitPositions", () => {
  it("places items around, not on top of, the center", () => {
    const center = {x: 725, y: 280};
    const positions = getOrbitPositions(8, center, 500, 190);
    expect(positions).toHaveLength(8);
    expect(new Set(positions.map((point) => `${point.x.toFixed(1)}:${point.y.toFixed(1)}`)).size).toBe(8);
    for (const point of positions) {
      expect(Math.abs(point.x - center.x) + Math.abs(point.y - center.y)).toBeGreaterThan(150);
    }
  });
});
