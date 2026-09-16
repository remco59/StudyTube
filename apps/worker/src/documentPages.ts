import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {access,copyFile,mkdir,readFile} from "node:fs/promises";
import {dirname,extname,join,resolve} from "node:path";
import {promisify} from "node:util";
import type {NormalizedStudyTubeProject} from "@studytube/core";
import {normalizeRelativeProjectPath,resolveInside} from "./pathSafety";

export type DocumentPageManifest=Record<string,string>;
export type PdfPageRasterizer=(sourcePath:string,page:number,destinationPath:string,dpi:number)=>Promise<void>;

const execFileAsync=promisify(execFile);
const DEFAULT_DPI=160;

export const documentPageKey=(assetId:string,page:number)=>`${assetId}:${page}`;

const exists=async(path:string)=>{try{await access(path);return true;}catch{return false;}};

const defaultRasterize:PdfPageRasterizer=async(sourcePath,page,destinationPath,dpi)=>{
  const outputBase=destinationPath.replace(/\.png$/u,"");
  await execFileAsync("pdftoppm",[
    "-f",String(page),
    "-l",String(page),
    "-singlefile",
    "-png",
    "-r",String(dpi),
    sourcePath,
    outputBase,
  ]);
};

type DocumentPageRequest={assetId:string;page:number;path:string};

export const collectDocumentPageRequests=(project:NormalizedStudyTubeProject):DocumentPageRequest[]=>{
  const requests=new Map<string,DocumentPageRequest>();
  for(const chapter of project.chapters){
    for(const normalizedScene of chapter.scenes){
      const scene=normalizedScene.scene;
      if(scene.type!=="document"&&scene.type!=="documentHighlight")continue;
      const page=scene.visual.page??1;
      const asset=project.project.assets?.[scene.visual.assetId];
      if(!asset||asset.type!=="document"||extname(asset.path).toLowerCase()!==".pdf")continue;
      const key=documentPageKey(scene.visual.assetId,page);
      requests.set(key,{assetId:scene.visual.assetId,page,path:asset.path});
    }
  }
  return [...requests.values()];
};

export const prepareDocumentPages=async(
  project:NormalizedStudyTubeProject,
  publicDir:string,
  options:{dpi?:number;cacheDir?:string;rasterize?:PdfPageRasterizer}={},
):Promise<DocumentPageManifest>=>{
  const requests=collectDocumentPageRequests(project);
  if(requests.length===0)return {};

  const dpi=options.dpi??DEFAULT_DPI;
  const rasterize=options.rasterize??defaultRasterize;
  const configuredDataDir=process.env.STUDYTUBE_DATA_DIR?.trim();
  const cacheDir=resolve(options.cacheDir??(configuredDataDir?join(configuredDataDir,"cache","document-pages"):join(publicDir,".studytube","document-page-cache")));
  await mkdir(cacheDir,{recursive:true});

  const manifest:DocumentPageManifest={};
  const documentHashes=new Map<string,Promise<string>>();

  for(const request of requests){
    const relativeSource=normalizeRelativeProjectPath(request.path);
    const sourcePath=resolveInside(publicDir,relativeSource);
    let hashPromise=documentHashes.get(relativeSource);
    if(!hashPromise){
      hashPromise=readFile(sourcePath).then((content)=>createHash("sha256").update(content).digest("hex"));
      documentHashes.set(relativeSource,hashPromise);
    }

    try{
      const documentHash=await hashPromise;
      const pageHash=createHash("sha256").update(`${documentHash}:${request.page}:${dpi}`).digest("hex").slice(0,24);
      const cachePath=join(cacheDir,`${pageHash}.png`);
      const relativeDestination=`.studytube/document-pages/${pageHash}.png`;
      const destinationPath=resolveInside(publicDir,relativeDestination);
      await mkdir(dirname(destinationPath),{recursive:true});

      if(!(await exists(destinationPath))){
        if(!(await exists(cachePath))){
          await rasterize(sourcePath,request.page,cachePath,dpi);
        }
        await copyFile(cachePath,destinationPath);
      }

      manifest[documentPageKey(request.assetId,request.page)]=relativeDestination;
    }catch(error){
      console.warn(`Could not rasterize PDF page ${request.page} for asset ${request.assetId}; using document fallback.`,error);
    }
  }

  return manifest;
};
