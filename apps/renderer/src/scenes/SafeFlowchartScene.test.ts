import {describe,expect,it} from "vitest";
import {getFlowchartLabelWidth} from "./SafeFlowchartScene";

describe("flowchart layout safety",()=>{
  it("gives descriptive edge labels enough room",()=>{
    expect(getFlowchartLabelWidth("in")).toBe(96);
    expect(getFlowchartLabelWidth("handelen in")).toBeGreaterThan(140);
    expect(getFlowchartLabelWidth("een veel langere relatieomschrijving")).toBeLessThanOrEqual(280);
  });
});
