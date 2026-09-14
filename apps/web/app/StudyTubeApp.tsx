"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {buildChatGptPrompt} from "../lib/chatgptPrompt";

type RequiredAsset={id:string;type:"image"|"document";path:string;fileName:string};
type ValidationResult={valid:true;summary:{title:string;language:string;targetDuration:number;chapters:number;scenes:number;assets:number};assets:RequiredAsset[]}|{valid:false;issues:{path:string;message:string}[]};
type JobStatus={jobId:string;state:string;progress:number;createdAt?:string;updatedAt?:string;projectTitle?:string;outputPath?:string;error?:string;downloadedAt?:string;expiresAt?:string};
type JobLogEntry={timestamp:string;event:string;message:string;data?:unknown};
type PromptLanguage="nl-NL"|"en-US";

export const StudyTubeApp=()=>{
  const [projectFile,setProjectFile]=useState<File|null>(null);
  const [assetFiles,setAssetFiles]=useState<File[]>([]);
  const [validation,setValidation]=useState<ValidationResult|null>(null);
  const [validating,setValidating]=useState(false);
  const [job,setJob]=useState<JobStatus|null>(null);
  const [jobs,setJobs]=useState<JobStatus[]>([]);
  const [logs,setLogs]=useState<JobLogEntry[]>([]);
  const [detailsOpen,setDetailsOpen]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [promptDuration,setPromptDuration]=useState(8);
  const [promptLanguage,setPromptLanguage]=useState<PromptLanguage>("nl-NL");
  const [promptScope,setPromptScope]=useState("");
  const [promptCopied,setPromptCopied]=useState(false);
  const validationRequest=useRef(0);
  const jobsLoaded=useRef(false);

  const refreshJobs=useCallback(async(preferredJobId?:string)=>{
    try{
      const response=await fetch("/api/jobs",{cache:"no-store"});
      if(!response.ok)return;
      const result=await response.json() as {jobs:JobStatus[]};
      const nextJobs=result.jobs??[];
      setJobs(nextJobs);
      setJob((current)=>{
        if(preferredJobId)return nextJobs.find((item)=>item.jobId===preferredJobId)??current;
        if(current?.jobId==="starting")return current;
        if(current)return nextJobs.find((item)=>item.jobId===current.jobId)??null;
        if(!jobsLoaded.current)return nextJobs.find((item)=>!isTerminal(item.state))??nextJobs[0]??null;
        return null;
      });
      jobsLoaded.current=true;
    }catch{
      // The render UI can still work with the currently selected job if history loading fails.
    }
  },[]);

  useEffect(()=>{
    void refreshJobs();
    const timer=window.setInterval(()=>void refreshJobs(),30_000);
    return()=>window.clearInterval(timer);
  },[refreshJobs]);

  const handleProjectFile=(file:File|null)=>{
    const requestId=++validationRequest.current;
    setProjectFile(file);
    setAssetFiles([]);
    setValidation(null);
    setJob(null);
    setLogs([]);
    setDetailsOpen(false);
    setError(null);
    if(!file){setValidating(false);return;}

    setValidating(true);
    void file.text().then(async(text)=>{
      const response=await fetch("/api/validate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text})});
      const result=await response.json() as ValidationResult;
      if(requestId===validationRequest.current)setValidation(result);
    }).catch((cause)=>{
      if(requestId===validationRequest.current)setError(cause instanceof Error?cause.message:"Validation failed");
    }).finally(()=>{
      if(requestId===validationRequest.current)setValidating(false);
    });
  };

  const jobId=job?.jobId;
  const jobState=job?.state;
  useEffect(()=>{
    if(!jobId||jobId==="starting"||isTerminal(jobState))return;
    let cancelled=false;
    const poll=()=>{
      void fetch(`/api/jobs/${jobId}`,{cache:"no-store"}).then(async(response)=>{
        if(!response.ok)return;
        const next=await response.json() as JobStatus;
        if(cancelled)return;
        setJob(next);
        setJobs((current)=>[next,...current.filter((item)=>item.jobId!==next.jobId)].sort(sortJobs));
      });
    };
    poll();
    const timer=window.setInterval(poll,1200);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[jobId,jobState]);

  useEffect(()=>{
    if(!detailsOpen||!jobId||jobId==="starting")return;
    let cancelled=false;
    const load=()=>{
      void fetch(`/api/jobs/${jobId}/logs`,{cache:"no-store"}).then(async(response)=>{
        if(!response.ok)return;
        const result=await response.json() as {logs:JobLogEntry[]};
        if(!cancelled)setLogs(result.logs??[]);
      });
    };
    load();
    if(isTerminal(jobState))return()=>{cancelled=true;};
    const timer=window.setInterval(load,1200);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[detailsOpen,jobId,jobState]);

  const matchedAssets=useMemo(()=>{
    const result=new Map<string,File>();
    if(!validation?.valid)return result;
    for(const asset of validation.assets){
      const matches=assetFiles.filter((file)=>file.name===asset.fileName);
      if(matches.length===1)result.set(asset.id,matches[0]);
    }
    return result;
  },[assetFiles,validation]);

  const missingAssets=validation?.valid?validation.assets.filter((asset)=>!matchedAssets.has(asset.id)):[];
  const busy=Boolean(job&&!isTerminal(job.state));
  const hasActiveJob=busy||jobs.some((item)=>!isTerminal(item.state));

  const copyPrompt=async()=>{
    const prompt=buildChatGptPrompt({targetDurationMinutes:promptDuration,language:promptLanguage,scope:promptScope});
    try{
      await copyText(prompt);
      setPromptCopied(true);
      window.setTimeout(()=>setPromptCopied(false),1800);
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Could not copy the ChatGPT prompt");
    }
  };

  const startRender=async()=>{
    if(!projectFile||!validation?.valid||missingAssets.length>0||hasActiveJob)return;
    setError(null);setLogs([]);setDetailsOpen(false);setJob({jobId:"starting",state:"queued",progress:0,projectTitle:validation.summary.title});
    const form=new FormData();form.append("project",projectFile);
    for(const asset of validation.assets){const file=matchedAssets.get(asset.id);if(file)form.append(`asset:${asset.id}`,file,file.name);}
    const response=await fetch("/api/jobs",{method:"POST",body:form});
    const result=await response.json() as {jobId?:string;error?:string};
    if(!response.ok||!result.jobId){setJob(null);setError(result.error??"Could not start render");return;}
    const next:JobStatus={jobId:result.jobId,state:"queued",progress:0,createdAt:new Date().toISOString(),projectTitle:validation.summary.title};
    setJob(next);
    setJobs((current)=>[next,...current.filter((item)=>item.jobId!==next.jobId)]);
    void refreshJobs(result.jobId);
  };

  const selectJob=(next:JobStatus)=>{
    setJob(next);
    setLogs([]);
    setDetailsOpen(false);
  };

  return <main className="appShell">
    <header className="topbar"><div className="brand"><span className="brandMark">S</span><span>StudyTube</span></div><span className="badge">Local render</span></header>
    <section className="workspace">
      <div className="intro"><p className="eyebrow">JSON → narration → motion → MP4</p><h1>Turn your study material into an explainer.</h1><p className="lede">Create a schema-safe StudyTube project with ChatGPT, upload the generated <code>.studytube.json</code>, and StudyTube handles narration and rendering locally.</p></div>

      <section className="promptPanel">
        <div className="promptCopy">
          <p className="eyebrow">Create · ChatGPT</p>
          <h2>Generate the project JSON with ChatGPT.</h2>
          <p>Choose the video settings, copy the prompt, and paste it into a ChatGPT conversation with your study material. The prompt includes StudyTube&apos;s supported scene types and validation rules.</p>
          <div className="promptSteps"><span>1 · Add your study material to ChatGPT</span><span>2 · Paste the generated prompt</span><span>3 · Save the response as <code>.studytube.json</code></span></div>
        </div>
        <div className="promptBuilder">
          <div className="promptFields">
            <label><span>Duration</span><div className="durationInput"><input type="number" min="0.5" max="120" step="0.5" value={promptDuration} onChange={(event)=>setPromptDuration(clampDuration(Number(event.target.value)))}/><span>min</span></div></label>
            <label><span>Language</span><select value={promptLanguage} onChange={(event)=>setPromptLanguage(event.target.value as PromptLanguage)}><option value="nl-NL">Dutch (nl-NL)</option><option value="en-US">English (en-US)</option></select></label>
          </div>
          <label className="scopeField"><span>Chapters or scope <em>optional</em></span><textarea rows={3} placeholder="e.g. Chapters 2–4, focus on Design Science and artefacts" value={promptScope} onChange={(event)=>setPromptScope(event.target.value)}/></label>
          <button className="promptButton" onClick={()=>void copyPrompt()}>{promptCopied?"✓ Prompt copied":"Copy ChatGPT prompt"}</button>
          <p className="promptHint">The copied prompt targets schema v1.0 and a {formatDuration(Math.round(promptDuration*60))} video.</p>
        </div>
      </section>

      <div className="grid">
        <section className="panel">
          <div className="panelHeading"><div><span className="step">01</span><h2>Project</h2></div>{validation?.valid?<span className="successPill">Valid</span>:null}</div>
          <label className="dropzone">
            <input type="file" accept=".json,.studytube.json,application/json" onChange={(event)=>handleProjectFile(event.target.files?.[0]??null)}/>
            <span className="dropIcon">↥</span><strong>{projectFile?.name??"Choose StudyTube JSON"}</strong><span>{validating?"Validating…":"Drop or select your generated project file"}</span>
          </label>

          {validation?.valid?<div className="summary">
            <div className="summaryTitle"><span>Project</span><strong>{validation.summary.title}</strong></div>
            <div className="metrics"><Metric label="Target" value={formatDuration(validation.summary.targetDuration)}/><Metric label="Chapters" value={String(validation.summary.chapters)}/><Metric label="Scenes" value={String(validation.summary.scenes)}/><Metric label="Language" value={validation.summary.language}/></div>
          </div>:null}

          {validation&&!validation.valid?<div className="errorBox"><strong>Project is not valid yet</strong>{validation.issues.slice(0,6).map((issue,index)=><p key={`${issue.path}-${index}`}>{issue.path?`${issue.path}: `:""}{issue.message}</p>)}</div>:null}
        </section>

        <section className="panel">
          <div className="panelHeading"><div><span className="step">02</span><h2>Assets</h2></div>{validation?.valid?<span className="mutedPill">{validation.assets.length} required</span>:null}</div>
          {!validation?.valid?<p className="emptyState">Validate a project first. Referenced images and documents will appear here.</p>:validation.assets.length===0?<div className="emptyState successText">✓ This project has no external assets.</div>:<>
            <label className="assetPicker"><input type="file" multiple onChange={(event)=>setAssetFiles(Array.from(event.target.files??[]))}/><span>Select referenced files</span></label>
            <div className="assetList">{validation.assets.map((asset)=>{const match=matchedAssets.get(asset.id);return <div className="assetRow" key={asset.id}><div><strong>{asset.fileName}</strong><span>{asset.type} · {asset.path}</span></div><span className={match?"assetOk":"assetMissing"}>{match?"✓ matched":"missing"}</span></div>;})}</div>
          </>}
        </section>
      </div>

      <section className="renderPanel">
        <div className="renderMain">
          <div><p className="eyebrow">03 · Render</p><h2>{job?.state==="completed"?"Your video is ready.":job?.state==="failed"?"Render failed.":busy?humanState(job?.state):"Ready when you are."}</h2><p>{renderDescription(job,busy,hasActiveJob)}</p></div>
          {job&&job.jobId!=="starting"?<details className="jobDetails" open={detailsOpen} onToggle={(event)=>setDetailsOpen(event.currentTarget.open)}>
            <summary><span>{detailsOpen?"Hide details":"Show details"}</span><span className="detailMeta">{job.jobId}</span></summary>
            <div className="logConsole">{logs.length===0?<div className="logEmpty">{busy?"Waiting for pipeline logs…":"No logs recorded for this job."}</div>:logs.map((entry,index)=><div className="logLine" key={`${entry.timestamp}-${entry.event}-${index}`}><time>{formatLogTime(entry.timestamp)}</time><span className="logEvent">{entry.event}</span><span>{entry.message}</span></div>)}</div>
          </details>:null}
        </div>
        <div className="renderAction">
          {busy?<div className="progress"><div className="progressTrack"><span style={{width:`${Math.round((job?.progress??0)*100)}%`}}/></div><strong>{Math.round((job?.progress??0)*100)}%</strong></div>:null}
          {job?.state==="completed"?<a className="primaryButton" href={`/api/jobs/${job.jobId}/download`} onClick={()=>window.setTimeout(()=>void refreshJobs(job.jobId),1200)}>Download MP4</a>:<button className="primaryButton" disabled={!validation?.valid||missingAssets.length>0||hasActiveJob} onClick={()=>void startRender()}>{hasActiveJob&&!busy?"Render already running":"Generate video"}</button>}
        </div>
      </section>

      {jobs.length>0?<section className="jobsPanel">
        <div className="jobsHeading"><div><p className="eyebrow">Saved on this server</p><h2>Recent jobs</h2></div><span className="mutedPill">{jobs.length} saved</span></div>
        <div className="jobsList">{jobs.slice(0,8).map((item)=><button type="button" className={`jobRow${job?.jobId===item.jobId?" selected":""}`} key={item.jobId} onClick={()=>selectJob(item)}>
          <div className="jobIdentity"><strong>{item.projectTitle??"StudyTube render"}</strong><span>{item.createdAt?formatJobDate(item.createdAt):item.jobId}</span></div>
          <div className="jobState"><span className={`jobStatePill ${stateClass(item.state)}`}>{jobStatusLabel(item)}</span>{!isTerminal(item.state)?<span className="jobProgress">{Math.round(item.progress*100)}%</span>:null}</div>
        </button>)}</div>
      </section>:null}

      {error?<div className="globalError">{error}</div>:null}
    </section>
  </main>;
};

const Metric=({label,value}:{label:string;value:string})=><div className="metric"><span>{label}</span><strong>{value}</strong></div>;
const clampDuration=(minutes:number)=>Number.isFinite(minutes)?Math.max(0.5,Math.min(120,minutes)):8;
const formatDuration=(seconds:number)=>{const total=Math.max(0,Math.round(seconds));return `${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`;};
const humanState=(state?:string)=>({queued:"Preparing render…",validating:"Analyzing project…",synthesizing:"Generating narration…",staging:"Preparing assets…",bundling:"Building video…",rendering:"Rendering MP4…"}[state??""]??"Working…");
const isTerminal=(state?:string)=>state==="completed"||state==="failed";
const sortJobs=(a:JobStatus,b:JobStatus)=>Date.parse(b.createdAt??"")-Date.parse(a.createdAt??"");
const renderDescription=(job:JobStatus|null,busy:boolean,hasActiveJob:boolean)=>{
  if(job?.state==="failed")return job.error??"The render pipeline stopped. Open details to inspect the logs.";
  if(job?.state==="completed"&&job.downloadedAt)return "Downloaded. StudyTube will remove this job automatically about one hour after the first download.";
  if(job?.state==="completed")return "Finished videos stay on the server until you download them.";
  if(busy)return "The render continues on your server even if you refresh or close this tab.";
  if(hasActiveJob)return "Another saved render is still running. Open it under Recent jobs to follow its progress.";
  return "No editing timeline. The output is a finished 1080p MP4.";
};
const jobStatusLabel=(job:JobStatus)=>{
  if(job.state==="completed")return job.downloadedAt?"Downloaded":"Ready";
  if(job.state==="failed")return "Failed";
  return humanState(job.state).replace("…","");
};
const stateClass=(state:string)=>state==="completed"?"complete":state==="failed"?"failed":"active";
const formatLogTime=(value:string)=>new Date(value).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});
const formatJobDate=(value:string)=>new Date(value).toLocaleString([],{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
const copyText=async(text:string)=>{
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
  const textarea=document.createElement("textarea");
  textarea.value=text;textarea.style.position="fixed";textarea.style.opacity="0";document.body.appendChild(textarea);textarea.select();
  const copied=document.execCommand("copy");document.body.removeChild(textarea);
  if(!copied)throw new Error("Could not copy the prompt to your clipboard");
};
