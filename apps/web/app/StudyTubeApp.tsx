"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {buildChatGptPrompt} from "../lib/chatgptPrompt";

type RequiredAsset={id:string;type:"image"|"document";path:string;fileName:string};
type ValidationResult={valid:true;packageType:"json"|"zip";summary:{title:string;language:string;targetDuration:number;chapters:number;scenes:number;assets:number};assets:RequiredAsset[]}|{valid:false;issues:{path:string;message:string}[]};
type RenderEngine="cpu"|"intel"|"nvidia";
type RenderCapability={id:RenderEngine;label:string;available:boolean;detail:string};
type RenderCapabilities={engines:RenderCapability[]};
type JobStatus={jobId:string;state:string;progress:number;createdAt?:string;updatedAt?:string;projectTitle?:string;renderEngine?:RenderEngine;outputPath?:string;error?:string;downloadedAt?:string;expiresAt?:string};
type JobLogEntry={timestamp:string;event:string;message:string;data?:unknown};
type PromptLanguage="nl-NL"|"en-US";
type AppTab="create"|"jobs";
type CreateStep=0|1|2;

const renderEngineChoices:RenderEngine[]=["cpu","intel","nvidia"];

export const StudyTubeApp=()=>{
  const [activeTab,setActiveTab]=useState<AppTab>("create");
  const [createStep,setCreateStep]=useState<CreateStep>(0);
  const [projectFile,setProjectFile]=useState<File|null>(null);
  const [validation,setValidation]=useState<ValidationResult|null>(null);
  const [validating,setValidating]=useState(false);
  const [job,setJob]=useState<JobStatus|null>(null);
  const [jobs,setJobs]=useState<JobStatus[]>([]);
  const [managedJobId,setManagedJobId]=useState<string|null>(null);
  const [logs,setLogs]=useState<JobLogEntry[]>([]);
  const [detailsOpen,setDetailsOpen]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [promptDuration,setPromptDuration]=useState(8);
  const [promptLanguage,setPromptLanguage]=useState<PromptLanguage>("nl-NL");
  const [promptScope,setPromptScope]=useState("");
  const [promptCopied,setPromptCopied]=useState(false);
  const [cancellingJobId,setCancellingJobId]=useState<string|null>(null);
  const [deletingJobId,setDeletingJobId]=useState<string|null>(null);
  const [renderEngine,setRenderEngine]=useState<RenderEngine>("cpu");
  const [renderCapabilities,setRenderCapabilities]=useState<RenderCapabilities|null>(null);
  const validationRequest=useRef(0);

  const refreshJobs=useCallback(async()=>{
    try{
      const response=await fetch("/api/jobs",{cache:"no-store"});
      if(!response.ok)return;
      const result=await response.json() as {jobs:JobStatus[]};
      const nextJobs=result.jobs??[];
      setJobs(nextJobs);
      setJob((current)=>{
        if(!current||current.jobId==="starting")return current;
        return nextJobs.find((item)=>item.jobId===current.jobId)??current;
      });
      setManagedJobId((current)=>current&&nextJobs.some((item)=>item.jobId===current)?current:nextJobs[0]?.jobId??null);
      setCancellingJobId((current)=>{
        if(!current)return null;
        const cancelling=nextJobs.find((item)=>item.jobId===current);
        return !cancelling||isTerminal(cancelling.state)?null:current;
      });
      setDeletingJobId((current)=>current&&!nextJobs.some((item)=>item.jobId===current)?null:current);
    }catch{
      // Keep the current UI usable if the persisted job list is temporarily unavailable.
    }
  },[]);

  const refreshRenderCapabilities=useCallback(async()=>{
    try{
      const response=await fetch("/api/render-capabilities",{cache:"no-store"});
      if(!response.ok)return;
      setRenderCapabilities(await response.json() as RenderCapabilities);
    }catch{
      // CPU remains a safe default when hardware detection is unavailable.
    }
  },[]);

  useEffect(()=>{
    const initialTimer=window.setTimeout(()=>void refreshJobs(),0);
    const timer=window.setInterval(()=>void refreshJobs(),30_000);
    return()=>{window.clearTimeout(initialTimer);window.clearInterval(timer);};
  },[refreshJobs]);

  useEffect(()=>{
    const timer=window.setTimeout(()=>void refreshRenderCapabilities(),0);
    return()=>window.clearTimeout(timer);
  },[refreshRenderCapabilities]);

  useEffect(()=>{
    if(activeTab!=="jobs")return;
    const timer=window.setInterval(()=>void refreshJobs(),1500);
    return()=>window.clearInterval(timer);
  },[activeTab,refreshJobs]);

  const handleProjectFile=(file:File|null)=>{
    const requestId=++validationRequest.current;
    setProjectFile(file);
    setValidation(null);
    setJob(null);
    setError(null);
    if(!file){setValidating(false);return;}

    setValidating(true);
    const form=new FormData();
    form.append("project",file,file.name);
    void fetch("/api/validate",{method:"POST",body:form}).then(async(response)=>{
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

  const managedJob=useMemo(()=>jobs.find((item)=>item.jobId===managedJobId)??null,[jobs,managedJobId]);
  const managedJobState=managedJob?.state;

  useEffect(()=>{
    if(activeTab!=="jobs"||!detailsOpen||!managedJobId)return;
    let cancelled=false;
    const load=()=>{
      void fetch(`/api/jobs/${managedJobId}/logs`,{cache:"no-store"}).then(async(response)=>{
        if(!response.ok)return;
        const result=await response.json() as {logs:JobLogEntry[]};
        if(!cancelled)setLogs(result.logs??[]);
      });
    };
    load();
    if(isTerminal(managedJobState))return()=>{cancelled=true;};
    const timer=window.setInterval(load,1200);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[activeTab,detailsOpen,managedJobId,managedJobState]);

  const busy=Boolean(job&&!isTerminal(job.state));
  const hasActiveJob=busy||jobs.some((item)=>!isTerminal(item.state));
  const renderReady=Boolean(projectFile&&validation?.valid);
  const canOpenRender=Boolean(job)||renderReady;
  const selectedRenderCapability=renderCapabilities?.engines.find((item)=>item.id===renderEngine);
  const renderEngineAvailable=renderEngine==="cpu"||(selectedRenderCapability?.available??false);

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
    if(!projectFile||!validation?.valid||hasActiveJob||!renderEngineAvailable)return;
    setCancellingJobId(null);
    setError(null);
    setJob({jobId:"starting",state:"queued",progress:0,projectTitle:validation.summary.title,renderEngine});
    const form=new FormData();
    form.append("project",projectFile,projectFile.name);
    form.append("renderEngine",renderEngine);
    const response=await fetch("/api/jobs",{method:"POST",body:form});
    const result=await response.json() as {jobId?:string;renderEngine?:RenderEngine;error?:string};
    if(!response.ok||!result.jobId){
      setJob(null);
      setError(result.error??"Could not start render");
      void refreshRenderCapabilities();
      return;
    }
    const next:JobStatus={jobId:result.jobId,state:"queued",progress:0,createdAt:new Date().toISOString(),projectTitle:validation.summary.title,renderEngine:result.renderEngine??renderEngine};
    setJob(next);
    setManagedJobId(next.jobId);
    setJobs((current)=>[next,...current.filter((item)=>item.jobId!==next.jobId)]);
    setCreateStep(2);
    void refreshJobs();
  };

  const cancelJob=async(target:JobStatus)=>{
    if(target.jobId==="starting"||isTerminal(target.state)||cancellingJobId===target.jobId)return;
    setError(null);
    setCancellingJobId(target.jobId);
    try{
      const response=await fetch(`/api/jobs/${target.jobId}/cancel`,{method:"POST"});
      const result=await response.json() as {error?:string};
      if(!response.ok){setCancellingJobId(null);setError(result.error??"Could not cancel render");return;}
      void refreshJobs();
    }catch(cause){
      setCancellingJobId(null);
      setError(cause instanceof Error?cause.message:"Could not cancel render");
    }
  };

  const deleteJob=async(target:JobStatus)=>{
    if(target.jobId==="starting"||!isTerminal(target.state)||deletingJobId===target.jobId)return;
    const title=target.projectTitle??"StudyTube render";
    if(!window.confirm(`Delete “${title}”?\n\nThis permanently removes the job, its logs and any remaining rendered video from this server.`))return;
    setError(null);
    setDeletingJobId(target.jobId);
    try{
      const response=await fetch(`/api/jobs/${target.jobId}`,{method:"DELETE"});
      const result=await response.json() as {error?:string};
      if(!response.ok){setDeletingJobId(null);setError(result.error??"Could not delete job");return;}
      setJobs((current)=>current.filter((item)=>item.jobId!==target.jobId));
      setManagedJobId((current)=>current===target.jobId?null:current);
      setJob((current)=>current?.jobId===target.jobId?null:current);
      setLogs([]);
      setDetailsOpen(false);
      setDeletingJobId(null);
      void refreshJobs();
    }catch(cause){
      setDeletingJobId(null);
      setError(cause instanceof Error?cause.message:"Could not delete job");
    }
  };

  const selectManagedJob=(next:JobStatus)=>{
    setManagedJobId(next.jobId);
    setLogs([]);
    setDetailsOpen(false);
    setError(null);
  };

  const openJobs=()=>{
    setActiveTab("jobs");
    void refreshJobs();
  };

  return <main className="appShell">
    <header className="topbar">
      <div className="brand"><span className="brandMark">S</span><span>StudyTube</span></div>
      <nav className="appTabs" aria-label="StudyTube sections">
        <button type="button" className={activeTab==="create"?"active":""} onClick={()=>setActiveTab("create")}>Create</button>
        <button type="button" className={activeTab==="jobs"?"active":""} onClick={openJobs}>Jobs{jobs.length>0?<span>{jobs.length}</span>:null}</button>
      </nav>
      <span className="badge topbarBadge">Local render</span>
    </header>

    <section className="workspace">
      {activeTab==="create"?<>
        <div className="intro compactIntro"><p className="eyebrow">Create</p><h1>Turn study material into a video.</h1><p className="lede">Generate a StudyTube project, upload one JSON or ZIP file, then render the finished explainer.</p></div>

        <section className="workflowCard">
          <div className="workflowHeader"><div><p className="eyebrow">New video</p><h2>Three steps, one workflow.</h2></div><span className="workflowCounter">Step {createStep+1} of 3</span></div>
          <div className="workflowSteps" role="tablist" aria-label="Create video steps">
            <button type="button" className={createStep===0?"active":""} onClick={()=>setCreateStep(0)}><span>1</span><strong>Prompt</strong><small>Generate project</small></button>
            <button type="button" className={createStep===1?"active":""} onClick={()=>setCreateStep(1)}><span>2</span><strong>Upload</strong><small>JSON or ZIP</small></button>
            <button type="button" className={createStep===2?"active":""} disabled={!canOpenRender} onClick={()=>setCreateStep(2)}><span>3</span><strong>Render</strong><small>Create MP4</small></button>
          </div>

          <div className="workflowBody">
            {createStep===0?<>
              <div className="wizardPrompt">
                <div className="promptCopy">
                  <p className="eyebrow">ChatGPT prompt</p>
                  <h2>Generate a StudyTube project.</h2>
                  <p>Ask ChatGPT for a text-only <code>.studytube.json</code>, or a <code>.studytube.zip</code> when the video uses images or documents.</p>
                  <div className="promptSteps"><span>1 · Add study material</span><span>2 · Paste prompt</span><span>3 · Download JSON or ZIP</span></div>
                </div>
                <div className="promptBuilder">
                  <div className="promptFields">
                    <label><span>Duration</span><div className="durationInput"><input type="number" min="0.5" max="120" step="0.5" value={promptDuration} onChange={(event)=>setPromptDuration(clampDuration(Number(event.target.value)))}/><span>min</span></div></label>
                    <label><span>Language</span><select value={promptLanguage} onChange={(event)=>setPromptLanguage(event.target.value as PromptLanguage)}><option value="nl-NL">Dutch (nl-NL)</option><option value="en-US">English (en-US)</option></select></label>
                  </div>
                  <label className="scopeField"><span>Chapters or scope <em>optional</em></span><textarea rows={3} placeholder="e.g. Chapters 2–4, focus on Design Science and artefacts" value={promptScope} onChange={(event)=>setPromptScope(event.target.value)}/></label>
                  <button className="promptButton" onClick={()=>void copyPrompt()}>{promptCopied?"✓ Prompt copied":"Copy ChatGPT prompt"}</button>
                  <p className="promptHint">Targets schema v1.0 · {formatDuration(Math.round(promptDuration*60))} video</p>
                </div>
              </div>
              <div className="workflowFooter"><span>You can skip this step if you already have a StudyTube project.</span><button type="button" className="primaryButton compactButton" onClick={()=>setCreateStep(1)}>Continue to upload</button></div>
            </>:null}

            {createStep===1?<>
              <div className="wizardUpload">
                <div className="wizardSectionHeader"><div><p className="eyebrow">Project file</p><h2>Upload your StudyTube project.</h2><p>Use JSON for text-only projects. Use a StudyTube ZIP when the project contains images or documents.</p></div>{validation?.valid?<span className="successPill">Valid</span>:null}</div>
                <label className="dropzone">
                  <input type="file" accept=".json,.studytube.json,.zip,.studytube.zip,application/json,application/zip" onChange={(event)=>handleProjectFile(event.target.files?.[0]??null)}/>
                  <span className="dropIcon">↥</span><strong>{projectFile?.name??"Choose StudyTube JSON or ZIP"}</strong><span>{validating?"Validating…":"Drop or select your generated project file"}</span>
                </label>

                {validation?.valid?<div className="summary">
                  <div className="summaryTitle"><span>{validation.packageType==="zip"?"Packaged project":"Text-only project"}</span><strong>{validation.summary.title}</strong></div>
                  <div className="metrics"><Metric label="Target" value={formatDuration(validation.summary.targetDuration)}/><Metric label="Chapters" value={String(validation.summary.chapters)}/><Metric label="Scenes" value={String(validation.summary.scenes)}/><Metric label="Language" value={validation.summary.language}/></div>
                </div>:null}

                {validation&&!validation.valid?<div className="errorBox"><strong>Project is not valid yet</strong>{validation.issues.slice(0,6).map((issue,index)=><p key={`${issue.path}-${index}`}>{issue.path?`${issue.path}: `:""}{issue.message}</p>)}</div>:null}

                {validation?.valid?<div className="assetsBlock">
                  <div className="assetsBlockHeader"><div><strong>{validation.assets.length===0?"Assets":"Packaged assets"}</strong><span>{validation.assets.length===0?"No external assets required.":`${validation.assets.length} included in ZIP`}</span></div></div>
                  {validation.assets.length===0?<div className="assetComplete">✓ Text-only JSON project. Nothing else to upload.</div>:<div className="assetList">{validation.assets.map((asset)=><div className="assetRow" key={asset.id}><div><strong>{asset.fileName}</strong><span>{asset.type} · {asset.path}</span></div><span className="assetOk">✓ included</span></div>)}</div>}
                </div>:null}
              </div>
              <div className="workflowFooter"><button type="button" className="secondaryButton" onClick={()=>setCreateStep(0)}>Back</button><button type="button" className="primaryButton compactButton" disabled={!renderReady} onClick={()=>{setCreateStep(2);void refreshRenderCapabilities();}}>Continue to render</button></div>
            </>:null}

            {createStep===2?<>
              <div className="wizardRender">
                <div className="renderStageCopy">
                  <p className="eyebrow">Render</p>
                  <h2>{job?.state==="completed"?"Your video is ready.":job?.state==="failed"?"Render failed.":job?.state==="cancelled"?"Render cancelled.":busy?humanState(job?.state):hasActiveJob?"A render is already running.":"Ready to create the MP4."}</h2>
                  <p>{renderDescription(job,busy,hasActiveJob)}</p>
                  {validation?.valid?<div className="renderProjectSummary"><strong>{validation.summary.title}</strong><span>{formatDuration(validation.summary.targetDuration)} · {validation.summary.scenes} scenes · {validation.summary.assets} assets · {validation.summary.language}</span></div>:null}
                  <div className="renderEngineBlock">
                    <div className="renderEngineHeading"><div><strong>Render engine</strong><span>Choose the encoder for this video.</span></div><button type="button" className="engineRefresh" onClick={()=>void refreshRenderCapabilities()} disabled={busy}>↻ Detect</button></div>
                    <div className="renderEngineOptions">{renderEngineChoices.map((engine)=>{
                      const capability=renderCapabilities?.engines.find((item)=>item.id===engine);
                      const available=engine==="cpu"||(capability?.available??false);
                      const checking=engine!=="cpu"&&!renderCapabilities;
                      return <button type="button" key={engine} className={`renderEngineOption${renderEngine===engine?" selected":""}`} disabled={busy||!available} onClick={()=>setRenderEngine(engine)}>
                        <span className="engineRadio">{renderEngine===engine?"●":"○"}</span>
                        <span className="engineCopy"><strong>{capability?.label??renderEngineLabel(engine)}</strong><small>{checking?"Checking hardware…":capability?.detail??"Software H.264 encoding."}</small></span>
                        <span className={`engineAvailability ${available?"available":"unavailable"}`}>{available?"Available":checking?"Checking":"Unavailable"}</span>
                      </button>;
                    })}</div>
                  </div>
                </div>
                <div className="renderAction wizardRenderAction">
                  {busy?<div className="progress"><div className="progressTrack"><span style={{width:`${Math.round((job?.progress??0)*100)}%`}}/></div><strong>{Math.round((job?.progress??0)*100)}%</strong></div>:null}
                  {job?.state==="completed"?<a className="primaryButton" href={`/api/jobs/${job.jobId}/download`} onClick={()=>window.setTimeout(()=>void refreshJobs(),1200)}>Download MP4</a>:job&&busy&&job.jobId!=="starting"?<button className="cancelButton" disabled={cancellingJobId===job.jobId} onClick={()=>void cancelJob(job)}>{cancellingJobId===job.jobId?"Cancelling…":"Cancel render"}</button>:busy?<button className="primaryButton" disabled>Starting…</button>:hasActiveJob?<button type="button" className="primaryButton" onClick={openJobs}>View running job</button>:<button className="primaryButton" disabled={!renderReady||!renderEngineAvailable} onClick={()=>void startRender()}>Generate video</button>}
                  {job&&job.jobId!=="starting"?<button type="button" className="secondaryButton" onClick={()=>{setManagedJobId(job.jobId);openJobs();}}>Open in Jobs</button>:null}
                </div>
              </div>
              <div className="workflowFooter"><button type="button" className="secondaryButton" disabled={busy} onClick={()=>setCreateStep(1)}>Back to upload</button><span>Rendering continues on the server if you close this tab.</span></div>
            </>:null}
          </div>
        </section>
      </>:<>
        <div className="intro compactIntro"><p className="eyebrow">Jobs</p><h1>Manage your renders.</h1><p className="lede">Follow active renders, inspect logs, download finished videos, cancel running work, or delete old jobs.</p></div>
        <div className="jobsWorkspace">
          <section className="jobsPanel">
            <div className="jobsHeading"><div><p className="eyebrow">Saved on this server</p><h2>Render jobs</h2></div><div className="jobsHeadingActions"><span className="mutedPill">{jobs.length} saved</span><button type="button" className="iconButton" onClick={()=>void refreshJobs()} aria-label="Refresh jobs">↻</button></div></div>
            {jobs.length===0?<div className="jobsEmpty"><strong>No jobs yet.</strong><span>Create your first video from the Create tab.</span><button type="button" className="primaryButton compactButton" onClick={()=>setActiveTab("create")}>Create video</button></div>:<div className="jobsList">{jobs.map((item)=><button type="button" className={`jobRow${managedJobId===item.jobId?" selected":""}`} key={item.jobId} onClick={()=>selectManagedJob(item)}><div className="jobIdentity"><strong>{item.projectTitle??"StudyTube render"}</strong><span>{item.createdAt?formatJobDate(item.createdAt):item.jobId}</span></div><div className="jobState"><span className={`jobStatePill ${stateClass(item.state)}`}>{jobStatusLabel(item)}</span>{!isTerminal(item.state)?<span className="jobProgress">{Math.round(item.progress*100)}%</span>:null}</div></button>)}</div>}
          </section>

          {managedJob?<section className="jobManager">
            <div className="jobManagerHeader"><div><p className="eyebrow">Selected job</p><h2>{managedJob.projectTitle??"StudyTube render"}</h2><span className="jobIdText">{managedJob.jobId}</span><span className="jobEngineText">{renderEngineLabel(managedJob.renderEngine??"cpu")}</span></div><span className={`jobStatePill ${stateClass(managedJob.state)}`}>{jobStatusLabel(managedJob)}</span></div>
            {!isTerminal(managedJob.state)?<div className="managerProgress"><div className="progress"><div className="progressTrack"><span style={{width:`${Math.round(managedJob.progress*100)}%`}}/></div><strong>{Math.round(managedJob.progress*100)}%</strong></div><span>{humanState(managedJob.state)}</span></div>:null}
            {managedJob.error?<div className="errorBox managerError"><strong>Render stopped</strong><p>{managedJob.error}</p></div>:null}
            <div className="jobActionBar">
              {managedJob.state==="completed"?<a className="primaryButton compactButton" href={`/api/jobs/${managedJob.jobId}/download`} onClick={()=>window.setTimeout(()=>void refreshJobs(),1200)}>Download MP4</a>:null}
              {!isTerminal(managedJob.state)?<button className="cancelButton compactButton" disabled={cancellingJobId===managedJob.jobId} onClick={()=>void cancelJob(managedJob)}>{cancellingJobId===managedJob.jobId?"Cancelling…":"Cancel render"}</button>:null}
              {isTerminal(managedJob.state)?<button type="button" className="cancelButton compactButton" disabled={deletingJobId===managedJob.jobId} onClick={()=>void deleteJob(managedJob)}>{deletingJobId===managedJob.jobId?"Deleting…":"Delete job"}</button>:null}
            </div>
            <details className="jobDetails managerDetails" open={detailsOpen} onToggle={(event)=>setDetailsOpen(event.currentTarget.open)}>
              <summary><span>{detailsOpen?"Hide logs":"Show logs"}</span><span className="detailMeta">{managedJob.updatedAt?`Updated ${formatJobDate(managedJob.updatedAt)}`:"Pipeline details"}</span></summary>
              <div className="logConsole">{logs.length===0?<div className="logEmpty">{!isTerminal(managedJob.state)?"Waiting for pipeline logs…":"No logs recorded for this job."}</div>:logs.map((entry,index)=><div className="logLine" key={`${entry.timestamp}-${entry.event}-${index}`}><time>{formatLogTime(entry.timestamp)}</time><span className="logEvent">{entry.event}</span><span>{entry.message}</span></div>)}</div>
            </details>
          </section>:null}
        </div>
      </>}

      {error?<div className="globalError">{error}</div>:null}
    </section>
  </main>;
};

const Metric=({label,value}:{label:string;value:string})=><div className="metric"><span>{label}</span><strong>{value}</strong></div>;
const clampDuration=(minutes:number)=>Number.isFinite(minutes)?Math.max(0.5,Math.min(120,minutes)):8;
const formatDuration=(seconds:number)=>{const total=Math.max(0,Math.round(seconds));return `${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`;};
const humanState=(state?:string)=>({queued:"Preparing render…",validating:"Analyzing project…",synthesizing:"Generating narration…",staging:"Preparing assets…",bundling:"Building video…",rendering:"Rendering MP4…"}[state??""]??"Working…");
const isTerminal=(state?:string)=>state==="completed"||state==="failed"||state==="cancelled";
const sortJobs=(a:JobStatus,b:JobStatus)=>Date.parse(b.createdAt??"")-Date.parse(a.createdAt??"");
const renderEngineLabel=(engine:RenderEngine)=>({cpu:"CPU (software)",intel:"Intel GPU (VAAPI)",nvidia:"NVIDIA NVENC"}[engine]);
const renderDescription=(job:JobStatus|null,busy:boolean,hasActiveJob:boolean)=>{
  if(job?.state==="failed")return job.error??"The render pipeline stopped. Open the job to inspect its logs.";
  if(job?.state==="cancelled")return "This render was cancelled. You can start it again when you are ready.";
  if(job?.state==="completed"&&job.downloadedAt)return "Downloaded. StudyTube will remove this job automatically about one hour after the first download.";
  if(job?.state==="completed")return "The finished video stays on the server until you download it.";
  if(busy)return `StudyTube is rendering this project on your server using ${renderEngineLabel(job?.renderEngine??"cpu")}.`;
  if(hasActiveJob)return "Another saved render is still running. Open Jobs to follow or cancel it.";
  return "StudyTube will synthesize the narration and render a finished 1080p MP4.";
};
const jobStatusLabel=(job:JobStatus)=>{
  if(job.state==="completed")return job.downloadedAt?"Downloaded":"Ready";
  if(job.state==="failed")return "Failed";
  if(job.state==="cancelled")return "Cancelled";
  return humanState(job.state).replace("…","");
};
const stateClass=(state:string)=>state==="completed"?"complete":state==="failed"?"failed":state==="cancelled"?"cancelled":"active";
const formatLogTime=(value:string)=>new Date(value).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});
const formatJobDate=(value:string)=>new Date(value).toLocaleString([],{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
const copyText=async(text:string)=>{
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
  const textarea=document.createElement("textarea");
  textarea.value=text;textarea.style.position="fixed";textarea.style.opacity="0";document.body.appendChild(textarea);textarea.select();
  const copied=document.execCommand("copy");document.body.removeChild(textarea);
  if(!copied)throw new Error("Could not copy the prompt to your clipboard");
};
