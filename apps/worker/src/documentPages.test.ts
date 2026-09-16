import {mkdtemp,mkdir,readFile,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname,join} from "node:path";
import type {NormalizedStudyTubeProject} from "@studytube/core";
import {describe,expect,it,vi} from "vitest";
import {collectDocumentPageRequests,documentPageKey,prepareDocumentPages} from "./documentPages";

const project=(assetPath="documents/paper.pdf")=>({
  project:{assets:{paper:{type:"document",path:assetPath,title:"Paper"}}},
  chapters:[{scenes:[
    {scene:{id:"doc",type:"document",visual:{assetId:"paper",page:2}}},
    {scene:{id:"highlight",type:"documentHighlight",visual:{assetId:"paper",page:2,highlightText:"Important"}}},
  ]}],
}) as unknown as NormalizedStudyTubeProject;

const stagePdf=async(publicDir:string,path="documents/paper.pdf")=>{
  const destination=join(publicDir,...path.split("/"));
  await mkdir(dirname(destination),{recursive:true});
  await writeFile(destination,"%PDF-1.4\nshared-test-content");
};

describe("PDF document page preparation",()=>{
  it("collects each referenced PDF page only once",()=>{
    expect(collectDocumentPageRequests(project())).toEqual([{assetId:"paper",page:2,path:"documents/paper.pdf"}]);
  });

  it("rasterizes a PDF page, stages it for Remotion and reuses the content cache",async()=>{
    const root=await mkdtemp(join(tmpdir(),"studytube-pdf-pages-"));
    const cacheDir=join(root,"cache");
    const firstPublic=join(root,"job-a","public");
    const secondPublic=join(root,"job-b","public");
    await stagePdf(firstPublic);
    await stagePdf(secondPublic);

    const rasterize=vi.fn(async(_sourcePath:string,_page:number,destinationPath:string)=>{
      await mkdir(dirname(destinationPath),{recursive:true});
      await writeFile(destinationPath,"png-data");
    });

    const first=await prepareDocumentPages(project(),firstPublic,{cacheDir,rasterize});
    const second=await prepareDocumentPages(project(),secondPublic,{cacheDir,rasterize});
    const key=documentPageKey("paper",2);

    expect(rasterize).toHaveBeenCalledTimes(1);
    expect(first[key]).toMatch(/^\.studytube\/document-pages\/[a-f0-9]{24}\.png$/u);
    expect(second[key]).toBe(first[key]);
    expect(await readFile(join(secondPublic,...second[key].split("/")),"utf8")).toBe("png-data");
  });

  it("falls back cleanly when rasterization fails",async()=>{
    const root=await mkdtemp(join(tmpdir(),"studytube-pdf-fallback-"));
    const publicDir=join(root,"public");
    await stagePdf(publicDir);

    const manifest=await prepareDocumentPages(project(),publicDir,{
      cacheDir:join(root,"cache"),
      rasterize:async()=>{throw new Error("converter unavailable");},
    });

    expect(manifest).toEqual({});
  });
});
