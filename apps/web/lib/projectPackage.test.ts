import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {zipSync} from "fflate";
import {afterEach,describe,expect,it} from "vitest";
import {parseProjectPackage,safeRelativePath,stageProjectPackage,STUDYTUBE_PROJECT_JSON,StudyTubePackageError,summarizeProjectPackage} from "./projectPackage";

const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map((root)=>rm(root,{recursive:true,force:true})));});
const makeRoot=async()=>{const root=await mkdtemp(join(tmpdir(),"studytube-web-package-"));roots.push(root);return root;};

const project=(assets:Record<string,Record<string,unknown>> ={})=>({
  version:"1.0",
  metadata:{title:"Package Test",language:"nl-NL",targetDuration:30,style:"educational-explainer"},
  assets,
  chapters:[{id:"intro",title:"Intro",scenes:[{id:"one",type:"kineticText",narration:"Dit is een korte test scene.",visual:{text:"Hallo"}}]}],
});

const jsonFile=(name:string,data:unknown)=>new File([JSON.stringify(data)],name,{type:"application/json"});
const zipFile=(name:string,entries:Record<string,Uint8Array>)=>new File([zipSync(entries)],name,{type:"application/zip"});

describe("safeRelativePath",()=>{
  it("accepts normal relative paths",()=>{
    expect(safeRelativePath("assets/diagram.svg")).toBe("assets/diagram.svg");
    expect(safeRelativePath("./assets/diagram.svg")).toBe("assets/diagram.svg");
  });

  it("rejects traversal, absolute paths, backslashes and drive letters",()=>{
    for(const input of ["../secret.txt","assets/../../secret.txt","/etc/passwd","assets\\diagram.svg","C:/Windows/system32"]){
      expect(()=>safeRelativePath(input)).toThrow(StudyTubePackageError);
    }
  });
});

describe("parseProjectPackage",()=>{
  it("parses a plain JSON project with no assets",async()=>{
    const parsed=await parseProjectPackage(jsonFile("plain.studytube.json",project()));
    expect(parsed.packageType).toBe("json");
    expect(parsed.project.metadata.title).toBe("Package Test");
  });

  it("allows JSON projects whose assets are stock resolver requests",async()=>{
    const stockProject={
      ...project({clip:{type:"stockVideo",query:"aerial wind turbines",provider:"auto"}}),
      chapters:[{id:"intro",title:"Intro",scenes:[{id:"clip-01",type:"video",narration:"Windenergie in beeld.",visual:{assetId:"clip"}}]}],
    };
    const parsed=await parseProjectPackage(jsonFile("stock.studytube.json",stockProject));
    expect(parsed.packageType).toBe("json");
    expect(parsed.project.assets?.clip.type).toBe("stockVideo");
  });

  it("rejects a JSON upload that references packaged assets",async()=>{
    const withAsset=project({diagram:{type:"image",path:"assets/diagram.svg",alt:"Diagram"}});
    await expect(parseProjectPackage(jsonFile("with-assets.studytube.json",withAsset))).rejects.toThrow(/must use \.studytube\.zip/);
  });

  it("rejects uploads with an unsupported extension",async()=>{
    await expect(parseProjectPackage(new File(["{}"],"project.txt"))).rejects.toThrow(/Upload a \.studytube\.json/);
  });

  it("parses a ZIP package and exposes its asset entries",async()=>{
    const withAsset=project({diagram:{type:"image",path:"assets/diagram.svg",alt:"Diagram"}});
    const zip=zipFile("package.studytube.zip",{
      [STUDYTUBE_PROJECT_JSON]:new TextEncoder().encode(JSON.stringify(withAsset)),
      "assets/diagram.svg":new TextEncoder().encode("<svg></svg>"),
    });
    const parsed=await parseProjectPackage(zip);
    expect(parsed.packageType).toBe("zip");
    expect(parsed.assetEntries.has("assets/diagram.svg")).toBe(true);
    const summary=await summarizeProjectPackage(parsed);
    expect(summary.summary.assets).toBe(1);
    expect(summary.summary.estimatedDurationSeconds).toBeGreaterThan(0);
    expect(summary.preview.chapters).toHaveLength(1);
    expect(summary.preview.chapters[0]?.scenes).toHaveLength(1);
    expect(summary.preview.chapters[0]?.scenes[0]?.id).toBe("one");
  });

  it("accepts a ZIP containing only stock resolver requests plus project JSON",async()=>{
    const stockProject={
      ...project({photo:{type:"stockImage",query:"students studying",provider:"auto"}}),
      chapters:[{id:"intro",title:"Intro",scenes:[{id:"photo-01",type:"image",narration:"Studenten werken samen.",visual:{assetId:"photo"}}]}],
    };
    const zip=zipFile("stock.studytube.zip",{[STUDYTUBE_PROJECT_JSON]:new TextEncoder().encode(JSON.stringify(stockProject))});
    const parsed=await parseProjectPackage(zip);
    expect(parsed.packageType).toBe("zip");
    expect(parsed.assetEntries.size).toBe(0);
  });

  it("rejects a ZIP that is missing the project.studytube.json entry",async()=>{
    const zip=zipFile("bad.studytube.zip",{"assets/diagram.svg":new TextEncoder().encode("<svg></svg>")});
    await expect(parseProjectPackage(zip)).rejects.toThrow(new RegExp(STUDYTUBE_PROJECT_JSON.replace(".","\\.")));
  });

  it("rejects a ZIP whose project has no assets",async()=>{
    const zip=zipFile("empty.studytube.zip",{[STUDYTUBE_PROJECT_JSON]:new TextEncoder().encode(JSON.stringify(project()))});
    await expect(parseProjectPackage(zip)).rejects.toThrow(/has no assets/);
  });

  it("rejects a ZIP that is missing an asset referenced by the project",async()=>{
    const withAsset=project({diagram:{type:"image",path:"assets/diagram.svg",alt:"Diagram"}});
    const zip=zipFile("missing-asset.studytube.zip",{[STUDYTUBE_PROJECT_JSON]:new TextEncoder().encode(JSON.stringify(withAsset))});
    await expect(parseProjectPackage(zip)).rejects.toThrow(/Missing packaged asset/);
  });
});

describe("stageProjectPackage",()=>{
  it("writes the project JSON and every referenced asset under the target root",async()=>{
    const root=await makeRoot();
    const withAsset=project({diagram:{type:"image",path:"assets/diagram.svg",alt:"Diagram"}});
    const zip=zipFile("package.studytube.zip",{
      [STUDYTUBE_PROJECT_JSON]:new TextEncoder().encode(JSON.stringify(withAsset)),
      "assets/diagram.svg":new TextEncoder().encode("<svg>content</svg>"),
    });
    const parsed=await parseProjectPackage(zip);
    const projectPath=await stageProjectPackage(parsed,root);
    expect(JSON.parse(await readFile(projectPath,"utf8")).metadata.title).toBe("Package Test");
    expect(await readFile(join(root,"assets","diagram.svg"),"utf8")).toBe("<svg>content</svg>");
  });
});