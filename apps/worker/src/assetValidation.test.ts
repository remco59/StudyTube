import {mkdir,mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach,describe,expect,it} from "vitest";
import {StudyTubeAssetValidationError,validateProjectAssets} from "./assetValidation";

const roots:string[]=[];
const makeRoot=async()=>{const root=await mkdtemp(join(tmpdir(),"studytube-asset-validation-"));roots.push(root);return root;};
afterEach(async()=>{await Promise.all(roots.splice(0).map((root)=>rm(root,{recursive:true,force:true})));});

const project=(assets:Record<string,{type:"image"|"document";path:string}>)=>({
  version:"1.0",
  metadata:{title:"Asset validation test",language:"nl-NL",targetDuration:30,style:"educational-explainer"},
  assets,
  chapters:[{id:"intro",title:"Intro",scenes:[{id:"one",type:"kineticText",narration:"Hallo daar.",visual:{text:"Hallo"}}]}],
} as never);

describe("validateProjectAssets",()=>{
  it("passes when every asset exists and matches its declared type",async()=>{
    const root=await makeRoot();
    await writeFile(join(root,"diagram.svg"),"<svg></svg>");
    await writeFile(join(root,"paper.pdf"),"%PDF-1.4");
    await expect(validateProjectAssets(project({
      diagram:{type:"image",path:"diagram.svg"},
      paper:{type:"document",path:"paper.pdf"},
    }),root)).resolves.toBeUndefined();
  });

  it("reports a missing asset file",async()=>{
    const root=await makeRoot();
    await expect(validateProjectAssets(project({diagram:{type:"image",path:"missing.svg"}}),root))
      .rejects.toSatisfy((error:unknown)=>error instanceof StudyTubeAssetValidationError&&error.issues.length===1&&error.issues[0].includes("file not found"));
  });

  it("reports an image asset whose file extension doesn't look like an image",async()=>{
    const root=await makeRoot();
    await writeFile(join(root,"diagram.txt"),"not an image");
    await expect(validateProjectAssets(project({diagram:{type:"image",path:"diagram.txt"}}),root))
      .rejects.toSatisfy((error:unknown)=>error instanceof StudyTubeAssetValidationError&&error.issues[0].includes("expected an image file"));
  });

  it("does not enforce an extension for document assets",async()=>{
    const root=await makeRoot();
    await writeFile(join(root,"notes"),"plain text notes");
    await expect(validateProjectAssets(project({notes:{type:"document",path:"notes"}}),root)).resolves.toBeUndefined();
  });

  it("rejects a path that escapes the project root",async()=>{
    const root=await makeRoot();
    await expect(validateProjectAssets(project({diagram:{type:"image",path:"../outside.svg"}}),root))
      .rejects.toSatisfy((error:unknown)=>error instanceof StudyTubeAssetValidationError&&error.issues[0].includes("Unsafe project-local path"));
  });

  it("rejects a directory used in place of a file",async()=>{
    const root=await makeRoot();
    await mkdir(join(root,"diagram.svg"));
    await expect(validateProjectAssets(project({diagram:{type:"image",path:"diagram.svg"}}),root))
      .rejects.toSatisfy((error:unknown)=>error instanceof StudyTubeAssetValidationError&&error.issues[0].includes("not a regular file"));
  });

  it("aggregates every issue into a single error",async()=>{
    const root=await makeRoot();
    await expect(validateProjectAssets(project({
      one:{type:"image",path:"missing-one.png"},
      two:{type:"image",path:"missing-two.png"},
    }),root)).rejects.toSatisfy((error:unknown)=>error instanceof StudyTubeAssetValidationError&&error.issues.length===2);
  });
});
