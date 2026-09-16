import {randomUUID} from "node:crypto";
import {mkdir,rm,writeFile} from "node:fs/promises";
import {extname,join} from "node:path";
import {StudyTubeValidationError} from "@studytube/schema";
import {resolveTtsProviderKind,runStudyTubeJob,type TtsJobSettings} from "@studytube/worker";
import {parseRenderEngine,requireRenderEngine} from "@studytube/worker/render-engine";
import {registerActiveJob,unregisterActiveJob} from "@/lib/activeJobs";
import {assertJobId,cleanupCancelledJobWorkingData,cleanupExpiredJobs,getDataDir,listJobStatuses} from "@/lib/jobs";
import {parseProjectPackage,stageProjectPackage,StudyTubePackageError} from "@/lib/projectPackage";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  try{return Response.json({jobs:await listJobStatuses()},{headers:{"cache-control":"no-store"}});}
  catch(error){return Response.json({error:error instanceof Error?error.message:"Could not load jobs"},{status:500});}
}

export async function POST(request:Request){
  let uploadRoot:string|undefined;
  try{
    await cleanupExpiredJobs();
    const form=await request.formData();
    const projectPart=form.get("project");
    if(!(projectPart instanceof File))return Response.json({error:"Upload a .studytube.json or .studytube.zip project"},{status:400});

    const renderEngine=parseRenderEngine(form.get("renderEngine"));
    await requireRenderEngine(renderEngine);
    const ttsProvider=resolveTtsProviderKind(typeof form.get("ttsProvider")==="string"?String(form.get("ttsProvider")):undefined);
    if(ttsProvider==="synthetic")throw new Error("Synthetic TTS is only available for development renders");
    const ttsSettings=parseTtsSettings(form.get("ttsSettings"));
    const baseJobIdInput=optionalText(form.get("baseJobId"),120,"Base job id");
    if(baseJobIdInput)assertJobId(baseJobIdInput);

    const parsed=await parseProjectPackage(projectPart);
    const project=parsed.project;
    const jobId=`web-${Date.now()}-${randomUUID().slice(0,8)}`;
    const dataDir=getDataDir();
    uploadRoot=join(dataDir,"uploads",jobId);
    const projectPath=await stageProjectPackage(parsed,uploadRoot);

    if(ttsProvider==="omnivoice"||ttsProvider==="chatterbox"||ttsProvider==="xtts"){
      const reference=form.get("ttsReference");
      if(reference instanceof File&&reference.size>0){
        if(reference.size>20_000_000)return Response.json({error:"TTS reference audio is too large (max 20 MB)"},{status:413});
        const extension=safeAudioExtension(reference.name);
        const referencePath=join(uploadRoot,`tts-reference${extension}`);
        await writeFile(referencePath,new Uint8Array(await reference.arrayBuffer()));
        if(ttsProvider==="omnivoice")ttsSettings.omnivoice={...ttsSettings.omnivoice,referenceAudioPath:referencePath};
        if(ttsProvider==="chatterbox")ttsSettings.chatterbox={...ttsSettings.chatterbox,referenceAudioPath:referencePath};
        if(ttsProvider==="xtts")ttsSettings.xtts={...ttsSettings.xtts,referenceAudioPath:referencePath};
      }
    }

    const createdAt=new Date().toISOString();
    const jobRoot=join(dataDir,"jobs",jobId);
    await mkdir(jobRoot,{recursive:true});
    await writeFile(join(jobRoot,"status.json"),`${JSON.stringify({jobId,state:"queued",progress:0,createdAt,updatedAt:createdAt,projectTitle:project.metadata.title,renderEngine,ttsProvider,...(baseJobIdInput?{baseJobId:baseJobIdInput}:{})},null,2)}\n`,`utf8`);

    const signal=registerActiveJob(jobId);
    void runStudyTubeJob({projectPath,dataDir,jobId,signal,renderEngine,ttsProvider,ttsSettings,baseJobId:baseJobIdInput})
      .catch(()=>undefined)
      .finally(async()=>{
        unregisterActiveJob(jobId);
        await rm(uploadRoot!,{recursive:true,force:true}).catch((error)=>{console.error(`StudyTube job ${jobId}: failed to remove upload directory`,error);});
        await cleanupCancelledJobWorkingData(jobId).catch((error)=>{console.error(`StudyTube job ${jobId}: failed to clean up cancelled job data`,error);});
      });

    return Response.json({jobId,renderEngine,ttsProvider,...(baseJobIdInput?{baseJobId:baseJobIdInput}:{})},{status:202});
  }catch(error){
    if(uploadRoot)await rm(uploadRoot,{recursive:true,force:true}).catch((cleanupError)=>{console.error(`StudyTube upload ${uploadRoot}: failed to remove after rejected request`,cleanupError);});
    if(error instanceof StudyTubeValidationError)return Response.json({error:"Invalid StudyTube project",issues:error.issues},{status:422});
    if(error instanceof StudyTubePackageError)return Response.json({error:error.message},{status:error.status});
    return Response.json({error:error instanceof Error?error.message:"Could not start render"},{status:400});
  }
}

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
