import {describe,expect,it} from "vitest";
import {safeParseStudyTubeProject} from "./index";

const baseProject={
  version:"1.0" as const,
  metadata:{title:"Versatile scenes",language:"nl-NL",targetDuration:180,style:"educational-explainer" as const},
  assets:{
    image1:{type:"image" as const,path:"assets/example.png",alt:"Example image"},
  },
};

describe("versatile scene pack",()=>{
  it("accepts every new scene type",()=>{
    const project={...baseProject,chapters:[{id:"chapter-1",title:"New scenes",scenes:[
      {id:"bullets",type:"bulletReveal",narration:"Progressive points.",visual:{title:"Points",points:["One","Two"]}},
      {id:"annotated",type:"annotatedImage",narration:"Image callouts.",visual:{assetId:"image1",annotations:[{label:"Callout",x:20,y:30,targetX:45,targetY:50}]}},
      {id:"chart",type:"dataChart",narration:"Numeric evidence.",visual:{chartType:"bar",data:[{label:"A",value:10},{label:"B",value:20}]}},
      {id:"matrix",type:"matrix",narration:"Two dimensions.",visual:{quadrants:{topLeft:{title:"TL"},topRight:{title:"TR"},bottomLeft:{title:"BL"},bottomRight:{title:"BR"}}}},
      {id:"cycle",type:"cycle",narration:"Repeating process.",visual:{steps:[{title:"Discover"},{title:"Build"},{title:"Test"}]}},
      {id:"quiz",type:"multipleChoice",narration:"Recall question.",visual:{question:"Which answer?",options:[{label:"A"},{label:"B",explanation:"Supported answer"}],correctIndex:1}},
      {id:"example",type:"workedExample",narration:"Apply the method.",visual:{problem:"Solve the case",steps:[{title:"Inspect",body:"Read the evidence"}],result:"Choose the supported conclusion"}},
      {id:"hierarchy",type:"hierarchy",narration:"Ordered levels.",visual:{levels:[{label:"Strategic"},{label:"Tactical"},{label:"Operational"}]}},
      {id:"quote",type:"quote",narration:"A direct quotation grounds the explanation in the literature.",visual:{quote:"Design is a way of changing existing situations into preferred ones.",author:"Example author",work:"Example work",locator:"p. 12",context:"Key idea from the literature"}},
    ]}]};
    expect(safeParseStudyTubeProject(project).success).toBe(true);
  });

  it("rejects an out-of-range multiple-choice answer",()=>{
    const project={...baseProject,chapters:[{id:"chapter-1",title:"Quiz",scenes:[
      {id:"quiz",type:"multipleChoice",narration:"Recall question.",visual:{question:"Which answer?",options:[{label:"A"},{label:"B"}],correctIndex:2}},
    ]}]};
    const result=safeParseStudyTubeProject(project);
    expect(result.success).toBe(false);
    if(!result.success) expect(result.error.issues.some((issue)=>issue.path.at(-1)==="correctIndex")).toBe(true);
  });

  it("requires annotated images to reference an image asset",()=>{
    const project={...baseProject,chapters:[{id:"chapter-1",title:"Image",scenes:[
      {id:"annotated",type:"annotatedImage",narration:"Image callouts.",visual:{assetId:"missing",annotations:[{label:"Callout",x:20,y:30}]}},
    ]}]};
    const result=safeParseStudyTubeProject(project);
    expect(result.success).toBe(false);
    if(!result.success) expect(result.error.issues.some((issue)=>issue.message.includes("Unknown asset"))).toBe(true);
  });
});
