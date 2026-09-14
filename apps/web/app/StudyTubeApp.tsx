"use client";

import {useEffect,useMemo,useRef,useState} from "react";

type RequiredAsset={id:string;type:"image"|"document";path:string;fileName:string};
type ValidationResult={valid:true;summary:{title:string;language:string;targetDuration:number;chapters:number;scenes:number;assets:number};assets:RequiredAsset[]}|{valid:false;issues:{path:string;message:string}[]};
type JobStatus={jobId:string;state:string;progress:number;projectTitle?:string;outputPath?:string;error?:string};

export const StudyTubeApp=()=>{
  const [projectFile,setProjectFile]=useState<File|null>(null);
  const [assetFiles,setAssetFiles]=useState<File[]>([]);
  const [validation,setValidation]=useState<ValidationResult|null>(null);
  const [validating,setValidating]=useState(false);
  const [job,setJob]=useState<JobStatus|null>(null);
  const [error,setError]=useState<string|null>(null);
  const validationRequest=useRef(0);

  const handleProjectFile=(file:File|null)=>{
    const requestId=++validationRequest.current;
    setProjectFile(file);
    setAssetFiles([]);
    setValidation(null);
    setJob(null);
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
    if(!jobId||jobId==="starting"||jobState==="completed"||jobState==="failed")return;
    let cancelled=false;
    const poll=()=>{
      void fetch(`/api/jobs/${jobId}`,{cache:"no-store"}).then(async(response)=>{
        if(!response.ok)return;
        const next=await response.json() as JobStatus;
        if(!cancelled)setJob(next);
      });
    };
    poll();
    const timer=window.setInterval(poll,1200);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[jobId,jobState]);

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
  const busy=Boolean(job&&job.state!=="completed"&&job.state!=="failed");

  const startRender=async()=>{
    if(!projectFile||!validation?.valid||missingAssets.length>0)return;
    setError(null);setJob({jobId:"starting",state:"queued",progress:0});
    const form=new FormData();form.append("project",projectFile);
    for(const asset of validation.assets){const file=matchedAssets.get(asset.id);if(file)form.append(`asset:${asset.id}`,file,file.name);}
    const response=await fetch("/api/jobs",{method:"POST",body:form});
    const result=await response.json() as {jobId?:string;error?:string};
    if(!response.ok||!result.jobId){setJob(null);setError(result.error??"Could not start render");return;}
    setJob({jobId:result.jobId,state:"queued",progress:0,projectTitle:validation.summary.title});
  };

  return <main className="appShell">
    <header className="topbar"><div className="brand"><span className="brandMark">S</span><span>StudyTube</span></div><span className="badge">Local render</span></header>
    <section className="workspace">
      <div className="intro"><p className="eyebrow">JSON → narration → motion → MP4</p><h1>Turn your study material into an explainer.</h1><p className="lede">Upload the <code>.studytube.json</code> made with ChatGPT, add any referenced files, and StudyTube handles the rest locally.</p></div>

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
        <div><p className="eyebrow">03 · Render</p><h2>{job?.state==="completed"?"Your video is ready.":busy?humanState(job?.state):"Ready when you are."}</h2><p>{job?.state==="failed"?job.error:busy?"StudyTube is running the complete pipeline on your server.":"No editing timeline. The output is a finished 1080p MP4."}</p></div>
        <div className="renderAction">
          {busy?<div className="progress"><div className="progressTrack"><span style={{width:`${Math.round((job?.progress??0)*100)}%`}}/></div><strong>{Math.round((job?.progress??0)*100)}%</strong></div>:null}
          {job?.state==="completed"?<a className="primaryButton" href={`/api/jobs/${job.jobId}/download`}>Download MP4</a>:<button className="primaryButton" disabled={!validation?.valid||missingAssets.length>0||busy} onClick={()=>void startRender()}>Generate video</button>}
        </div>
      </section>
      {error?<div className="globalError">{error}</div>:null}
    </section>
  </main>;
};

const Metric=({label,value}:{label:string;value:string})=><div className="metric"><span>{label}</span><strong>{value}</strong></div>;
const formatDuration=(seconds:number)=>{const total=Math.max(0,Math.round(seconds));return `${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`;};
const humanState=(state?:string)=>({queued:"Preparing render…",validating:"Validating project…",synthesizing:"Generating narration…",staging:"Preparing assets…",bundling:"Building video…",rendering:"Rendering MP4…"}[state??""]??"Working…");
