import {randomUUID} from "node:crypto";
import {mkdir,rm,writeFile} from "node:fs/promises";
import {extname,join} from "node:path";
import {StudyTubeValidationError} from "@studytube/schema";
import {resolveTtsProviderKind,type TtsJobSettings} from "@studytube/worker";
import {parseRenderEngine,requireRenderEngine} from "@studytube/worker/render-engine";
import {registerActiveJob,unregisterActiveJob} from "@/lib/activeJobs";
import {getGoogleChirpUsage,type GoogleChirpUsage} from "@/lib/googleChirpUsage";
import {assertJobId,getDataDir,listJobStatuses,pruneOldRenders} from "@/lib/jobs";
import {parseProjectPackage,stageProjectPackage,StudyTubePackageError} from "@/lib/projectPackage";
import {persistQueuedJobRecovery} from "@/lib/queuedJobRecovery";
import {enqueueRenderJob,getAvailableQueueSlots,RenderQueueFullError,withQueuePosition} from "@/lib/renderQueue";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const MAX_PROJECTS_PER_REQUEST=8;

export async function GET(){
  try{
    const statuses=await listJobStatuses();
    return Response.json({jobs:statuses.map(withQueuePosition)},{headers:{"cache-control":"no-store"}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Could not load jobs"},{status:500});}
}

export async function POST(request:Request){
  const uploadRoots:string[]=[];
  try{
    await pruneOldRenders();
    const form=await request.formData();
    const projectParts=form.getAll("project").filter((part):part is File=>part instanceof File);
    if(projectParts.length===0)return Response.json({error:"Upload one or more .studytube.json or .studytube.zip projects"},{status:400});
    if(projectParts.length>MAX_PROJECTS_PER_REQUEST)return Response.json({error:`Upload at most ${MAX_PROJECTS_PER_REQUEST} projects in one batch`},{status:413});

    const availableQueueSlots=getAvailableQueueSlots();
    if(projectParts.length>availableQueueSlots){
      return Response.json({error:`Render queue does not have enough capacity for this batch (${availableQueueSlots} pending slot${availableQueueSlots===1?"":"s"} available)`},{status:429});
    }

    const renderEngine=parseRenderEngine(form.get("renderEngine"));
    await requireRenderEngine(renderEngine);
    const ttsProvider=resolveTtsProviderKind(typeof form.get("ttsProvider")==="string"?String(form.get("ttsProvider")):undefined);
    if(ttsProvider==="synthetic")throw new Error("Synthetic TTS is only available for development renders");
    const chirpUsage=await requireCloudTtsConfigured(ttsProvider);
    const baseTtsSettings=parseTtsSettings(form.get("ttsSettings"));
    const baseJobIdInput=optionalText(form.get("baseJobId"),120,"Base job id");
    if(baseJobIdInput)assertJobId(baseJobIdInput);
    if(baseJobIdInput&&projectParts.length>1)throw new Error("A base render can only be reused for a single project, not a batch upload");

    const reference=form.get("ttsReference");
    let referenceBytes:Uint8Array|undefined;
    if((ttsProvider==="omnivoice"||ttsProvider==="chatterbox"||ttsProvider==="xtts")&&reference instanceof File&&reference.size>0){
      if(reference.size>20_000_000)return Response.json({error:"TTS reference audio is too large (max 20 MB)"},{status:413});
      referenceBytes=new Uint8Array(await reference.arrayBuffer());
    }

    const dataDir=getDataDir();
    const created:{jobId:string;projectTitle:string}[]=[];
    const failed:{fileName:string;error:string}[]=[];

    for(const projectPart of projectParts){
      let uploadRoot:string|undefined;
      let jobRoot:string|undefined;
      try{
        const parsed=await parseProjectPackage(projectPart);
        const project=parsed.project;
        let projectedChirpCharacters=0;
        if(ttsProvider==="google-chirp"&&chirpUsage&&!baseJobIdInput){
          projectedChirpCharacters=countProjectNarrationCharacters(project);
          if(projectedChirpCharacters>chirpUsage.remainingCharacters){
            throw new Error(`Google Chirp free-tier guard blocked this render: the project contains ${projectedChirpCharacters.toLocaleString("en-US")} narration characters, but only ${chirpUsage.remainingCharacters.toLocaleString("en-US")} of ${chirpUsage.limitCharacters.toLocaleString("en-US")} tracked characters remain this month. Choose another TTS provider or shorten the narration.`);
          }
        }

        const jobId=`web-${Date.now()}-${randomUUID().slice(0,8)}`;
        uploadRoot=join(dataDir,"uploads",jobId);
        uploadRoots.push(uploadRoot);
        const projectPath=await stageProjectPackage(parsed,uploadRoot);

        const ttsSettings:TtsJobSettings={...baseTtsSettings};
        if(referenceBytes){
          const extension=safeAudioExtension(reference instanceof File?reference.name:"");
          const referencePath=join(uploadRoot,`tts-reference${extension}`);
          await writeFile(referencePath,referenceBytes);
          if(ttsProvider==="omnivoice")ttsSettings.omnivoice={...ttsSettings.omnivoice,referenceAudioPath:referencePath};
          if(ttsProvider==="chatterbox")ttsSettings.chatterbox={...ttsSettings.chatterbox,referenceAudioPath:referencePath};
          if(ttsProvider==="xtts")ttsSettings.xtts={...ttsSettings.xtts,referenceAudioPath:referencePath};
        }

        const createdAt=new Date().toISOString();
        jobRoot=join(dataDir,"jobs",jobId);
        await mkdir(jobRoot,{recursive:true});
        await writeFile(join(jobRoot,"status.json"),`${JSON.stringify({jobId,state:"queued",progress:0,createdAt,updatedAt:createdAt,projectTitle:project.metadata.title,renderEngine,ttsProvider,...(baseJobIdInput?{baseJobId:baseJobIdInput}:{})},null,2)}\n`,`utf8`);
        await persistQueuedJobRecovery(jobId,{projectPath,dataDir,uploadRoot,renderEngine,ttsProvider,ttsSettings,baseJobId:baseJobIdInput});

        const signal=registerActiveJob(jobId);
        try{
          enqueueRenderJob({jobId,projectPath,dataDir,uploadRoot,renderEngine,ttsProvider,ttsSettings,baseJobId:baseJobIdInput,signal});
        }catch(error){
          unregisterActiveJob(jobId);
          throw error;
        }
        if(chirpUsage&&projectedChirpCharacters>0){
          chirpUsage.remainingCharacters=Math.max(0,chirpUsage.remainingCharacters-projectedChirpCharacters);
          chirpUsage.usedCharacters=Math.min(chirpUsage.limitCharacters,chirpUsage.usedCharacters+projectedChirpCharacters);
          chirpUsage.exhausted=chirpUsage.remainingCharacters===0;
        }
        created.push({jobId,projectTitle:project.metadata.title});
      }catch(error){
        if(uploadRoot)await rm(uploadRoot,{recursive:true,force:true}).catch((cleanupError)=>{console.error(`StudyTube upload ${uploadRoot}: failed to remove after rejected request`,cleanupError);});
        if(jobRoot)await rm(jobRoot,{recursive:true,force:true}).catch((cleanupError)=>{console.error(`StudyTube job ${jobRoot}: failed to remove after rejected request`,cleanupError);});
        if(projectParts.length===1)throw error;
        const message=error instanceof StudyTubeValidationError?"Invalid StudyTube project":error instanceof StudyTubePackageError||error instanceof Error?error.message:"Could not start render";
        failed.push({fileName:projectPart.name,error:message});
      }
    }

    if(created.length===0)return Response.json({error:"Could not start any of the uploaded projects",failed},{status:400});
    if(projectParts.length===1&&created.length===1){
      return Response.json({jobId:created[0].jobId,renderEngine,ttsProvider,...(baseJobIdInput?{baseJobId:baseJobIdInput}:{})},{status:202});
    }
    return Response.json({jobs:created,failed,renderEngine,ttsProvider},{status:202});
  }catch(error){
    await Promise.all(uploadRoots.map((uploadRoot)=>rm(uploadRoot,{recursive:true,force:true}).catch((cleanupError)=>{console.error(`StudyTube upload ${uploadRoot}: failed to remove after rejected request`,cleanupError);})));
    if(error instanceof RenderQueueFullError)return Response.json({error:error.message},{status:429});
    if(error instanceof StudyTubeValidationError)return Response.json({error:"Invalid StudyTube project",issues:error.issues},{status:422});
    if(error instanceof StudyTubePackageError)return Response.json({error:error.message},{status:error.status});
    return Response.json({error:error instanceof Error?error.message:"Could not start render"},{status:400});
  }
}

const requireCloudTtsConfigured=async(provider:string):Promise<GoogleChirpUsage|undefined>=>{
  if(provider!=="google-chirp"&&provider!=="azure")return undefined;
  const label=provider==="google-chirp"?"Google Chirp 3 HD":"Azure Speech";
  const baseUrl=(process.env.CLOUD_TTS_URL??"http://cloud-tts:5070").replace(/\/$/u,"");
  let response:Response;
  try{
    response=await fetch(`${baseUrl}/health`,{cache:"no-store",signal:AbortSignal.timeout(4000)});
  }catch{
    throw new Error(`${label} is unavailable. Open Settings and check the cloud TTS configuration.`);
  }
  if(!response.ok)throw new Error(`${label} is unavailable. Open Settings and check the cloud TTS configuration.`);
  const status=await response.json() as {googleConfigured?:unknown;azureConfigured?:unknown};
  const configured=provider==="google-chirp"?status.googleConfigured===true:status.azureConfigured===true;
  if(!configured)throw new Error(`${label} is not configured. Open Settings and add the required credentials before rendering.`);
  if(provider!=="google-chirp")return undefined;

  const usage=await getGoogleChirpUsage();
  if(usage.exhausted){
    throw new Error(`Google Chirp free monthly allowance is exhausted for ${usage.period} (${usage.usedCharacters.toLocaleString("en-US")}/${usage.limitCharacters.toLocaleString("en-US")} tracked characters used). Choose another TTS provider or wait for the monthly reset.`);
  }
  return usage;
};

const countProjectNarrationCharacters=(project:{chapters:{scenes:{narration:string}[]}[]})=>project.chapters.reduce((total,chapter)=>total+chapter.scenes.reduce((chapterTotal,scene)=>chapterTotal+scene.narration.length,0),0);

const parseTtsSettings=(value:FormDataEntryValue|null):TtsJobSettings=>{
  if(typeof value!=="string"||!value.trim())return {};
  const input=JSON.parse(value) as Record<string,unknown>;
  if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("TTS settings must be an object");
  const result:TtsJobSettings={};

  const edge=asRecord(input.edge);
  if(edge){const voice=optionalText(edge.voice,120,"Edge TTS voice");const rate=optionalText(edge.rate,12,"Edge TTS rate");if(rate&&!/^[+-]\d{1,3}%$/u.test(rate))throw new Error("Edge TTS rate must look like +0%, -5% or +10%");result.edge={voice,rate};}

  const piper=asRecord(input.piper);
  if(piper)result.piper={voice:optionalText(piper.voice,120,"Piper voice"),lengthScale:optionalNumber(piper.lengthScale,.4,3,"Piper length scale")};

  const omnivoice=asRecord(input.omnivoice);
  if(omnivoice){const steps=optionalNumber(omnivoice.numSteps,8,64,"OmniVoice steps");if(steps!==undefined&&!Number.isInteger(steps))throw new Error("OmniVoice steps must be an integer");result.omnivoice={speed:optionalNumber(omnivoice.speed,.4,3,"OmniVoice speed"),numSteps:steps,instruction:optionalText(omnivoice.instruction,300,"OmniVoice voice instruction"),normalizeText:typeof omnivoice.normalizeText==="boolean"?omnivoice.normalizeText:undefined,referenceText:optionalText(omnivoice.referenceText,1200,"OmniVoice reference transcript")};}

  const chatterbox=asRecord(input.chatterbox);
  if(chatterbox){const model=optionalText(chatterbox.t3Model,8,"Chatterbox model");if(model&&model!=="v2"&&model!=="v3")throw new Error("Chatterbox model must be v2 or v3");result.chatterbox={t3Model:model as "v2"|"v3"|undefined,exaggeration:optionalNumber(chatterbox.exaggeration,0,2,"Chatterbox exaggeration"),cfgWeight:optionalNumber(chatterbox.cfgWeight,0,1,"Chatterbox CFG weight"),temperature:optionalNumber(chatterbox.temperature,.05,5,"Chatterbox temperature")};}

  const xtts=asRecord(input.xtts);
  if(xtts)result.xtts={speaker:optionalText(xtts.speaker,120,"XTTS speaker"),speed:optionalNumber(xtts.speed,.4,3,"XTTS speed")};

  const googleChirp=asRecord(input.googleChirp);
  if(googleChirp)result.googleChirp={voice:optionalText(googleChirp.voice,160,"Google Chirp voice")};

  const azure=asRecord(input.azure);
  if(azure)result.azure={voice:optionalText(azure.voice,160,"Azure voice")};
  return result;
};

const asRecord=(value:unknown):Record<string,unknown>|undefined=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
const optionalText=(value:unknown,max:number,label:string)=>{if(value===undefined||value===null||value==="")return undefined;if(typeof value!=="string")throw new Error(`${label} must be text`);const trimmed=value.trim();if(trimmed.length>max)throw new Error(`${label} is too long`);return trimmed||undefined;};
const optionalNumber=(value:unknown,min:number,max:number,label:string)=>{if(value===undefined||value===null||value==="")return undefined;const parsed=typeof value==="number"?value:Number(value);if(!Number.isFinite(parsed)||parsed<min||parsed>max)throw new Error(`${label} must be between ${min} and ${max}`);return parsed;};
const safeAudioExtension=(name:string)=>{const extension=extname(name).toLowerCase();return [".wav",".mp3",".m4a",".flac",".ogg",".webm"].includes(extension)?extension:".wav";};
