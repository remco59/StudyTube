"use client";

import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {defaultTtsSelection,serializeTtsSettings,TtsSelector,type TtsProviderChoice,type TtsSelection} from "../TtsSelector";

type PromptLanguage="nl-NL"|"en-US";
type RenderEngine="cpu"|"intel"|"nvidia";
type StoredTtsSettings={
  provider:TtsProviderChoice;
  language:string;
  edge:TtsSelection["edge"];
  piper:TtsSelection["piper"];
  omnivoice:Omit<TtsSelection["omnivoice"],"referenceFile">;
  chatterbox:Omit<TtsSelection["chatterbox"],"referenceFile">;
  xtts:Omit<TtsSelection["xtts"],"referenceFile">;
  googleChirp:TtsSelection["googleChirp"];
  azure:TtsSelection["azure"];
};
type AppSettings={promptDurationMinutes:number;promptLanguage:PromptLanguage;renderEngine:RenderEngine;tts:StoredTtsSettings};
type SettingsResponse={
  settings:AppSettings;
  providers:{
    google:{configured:boolean};
    azure:{configured:boolean;region:string;endpoint:string};
    cloudService:{available:boolean;error?:string};
  };
  error?:string;
};

export const SettingsPage=()=>{
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [promptDuration,setPromptDuration]=useState(8);
  const [promptLanguage,setPromptLanguage]=useState<PromptLanguage>("nl-NL");
  const [renderEngine,setRenderEngine]=useState<RenderEngine>("cpu");
  const [ttsSelection,setTtsSelection]=useState<TtsSelection>(defaultTtsSelection);
  const [googleConfigured,setGoogleConfigured]=useState(false);
  const [googleFile,setGoogleFile]=useState<File|null>(null);
  const [azureConfigured,setAzureConfigured]=useState(false);
  const [azureKey,setAzureKey]=useState("");
  const [azureRegion,setAzureRegion]=useState("");
  const [azureEndpoint,setAzureEndpoint]=useState("");
  const [cloudAvailable,setCloudAvailable]=useState(true);
  const [cloudError,setCloudError]=useState<string|null>(null);

  const loadSettings=useCallback(async()=>{
    const response=await fetch("/api/settings",{cache:"no-store"});
    const result=await response.json() as SettingsResponse;
    if(!response.ok||!result.settings)throw new Error(result.error??"Could not load settings");
    setPromptDuration(result.settings.promptDurationMinutes);
    setPromptLanguage(result.settings.promptLanguage);
    setRenderEngine(result.settings.renderEngine);
    setTtsSelection(toTtsSelection(result.settings.tts));
    setGoogleConfigured(result.providers.google.configured);
    setAzureConfigured(result.providers.azure.configured);
    setAzureRegion(result.providers.azure.region);
    setAzureEndpoint(result.providers.azure.endpoint);
    setCloudAvailable(result.providers.cloudService.available);
    setCloudError(result.providers.cloudService.error??null);
  },[]);

  useEffect(()=>{
    let cancelled=false;
    void loadSettings().catch((cause)=>{if(!cancelled)setError(cause instanceof Error?cause.message:"Could not load settings");}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[loadSettings]);

  const saveDefaults=async()=>{
    setSaving(true);setError(null);setNotice(null);
    try{
      const serialized=JSON.parse(serializeTtsSettings(ttsSelection)) as Omit<StoredTtsSettings,"provider"|"language">;
      const response=await fetch("/api/settings",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({settings:{promptDurationMinutes:promptDuration,promptLanguage,renderEngine,tts:{provider:ttsSelection.provider,language:ttsSelection.language,...serialized}}})});
      const result=await response.json() as {settings?:AppSettings;error?:string};
      if(!response.ok||!result.settings)throw new Error(result.error??"Could not save defaults");
      setNotice("Defaults saved. New Create sessions will start with these values.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not save defaults");}
    finally{setSaving(false);}
  };

  const saveGoogle=async()=>{
    if(!googleFile){setError("Choose a Google service-account or ADC JSON file first.");return;}
    setSaving(true);setError(null);setNotice(null);
    try{
      const form=new FormData();form.append("credentials",googleFile,googleFile.name);
      const response=await fetch("/api/settings/google",{method:"POST",body:form});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error??"Could not save Google credentials");
      setGoogleFile(null);
      await loadSettings();
      setNotice("Google Chirp credentials saved. No container restart is required.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not save Google credentials");}
    finally{setSaving(false);}
  };

  const removeGoogle=async()=>{
    if(!window.confirm("Remove the stored Google credentials from StudyTube?"))return;
    setSaving(true);setError(null);setNotice(null);
    try{
      const response=await fetch("/api/settings/google",{method:"DELETE"});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error??"Could not remove Google credentials");
      await loadSettings();setNotice("Google credentials removed.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not remove Google credentials");}
    finally{setSaving(false);}
  };

  const saveAzure=async()=>{
    setSaving(true);setError(null);setNotice(null);
    try{
      const response=await fetch("/api/settings/azure",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({key:azureKey,region:azureRegion,endpoint:azureEndpoint})});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error??"Could not save Azure credentials");
      setAzureKey("");await loadSettings();setNotice("Azure Speech credentials saved. No container restart is required.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not save Azure credentials");}
    finally{setSaving(false);}
  };

  const removeAzure=async()=>{
    if(!window.confirm("Remove the stored Azure Speech credentials from StudyTube?"))return;
    setSaving(true);setError(null);setNotice(null);
    try{
      const response=await fetch("/api/settings/azure",{method:"DELETE"});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error??"Could not remove Azure credentials");
      setAzureKey("");await loadSettings();setNotice("Stored Azure credentials removed.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not remove Azure credentials");}
    finally{setSaving(false);}
  };

  return <main className="appShell settingsPage">
    <header className="topbar">
      <Link className="brand settingsBrand" href="/"><span className="brandMark">S</span><span>StudyTube</span></Link>
      <nav className="settingsNav" aria-label="StudyTube sections"><Link href="/">Create & Jobs</Link><span className="active">Settings</span></nav>
      <span className="badge topbarBadge">Local render</span>
    </header>

    <section className="workspace settingsWorkspace">
      <div className="intro compactIntro"><p className="eyebrow">Settings</p><h1>Defaults and provider configuration.</h1><p className="lede">Set the values StudyTube should start with, and configure cloud TTS credentials in one place. You can still override render settings for an individual video.</p></div>

      {!cloudAvailable?<div className="settingsWarning"><strong>Cloud TTS service is unavailable.</strong><span>{cloudError??"Check the cloud-tts container."}</span></div>:null}
      {error?<div className="globalError settingsMessage">{error}</div>:null}
      {notice?<div className="settingsNotice settingsMessage">{notice}</div>:null}

      {loading?<div className="settingsLoading">Loading settings…</div>:<div className="settingsGrid">
        <section className="settingsCard settingsCardWide">
          <div className="settingsCardHeader"><div><p className="eyebrow">Defaults</p><h2>New video defaults</h2><p>These values populate the Create and Render steps when you open StudyTube.</p></div></div>
          <div className="settingsFields threeColumns">
            <label><span>Prompt duration</span><div className="settingsInputSuffix"><input type="number" min="0.5" max="120" step="0.5" value={promptDuration} onChange={(event)=>setPromptDuration(clamp(Number(event.target.value),.5,120,8))}/><span>min</span></div></label>
            <label><span>Prompt language</span><select value={promptLanguage} onChange={(event)=>setPromptLanguage(event.target.value as PromptLanguage)}><option value="nl-NL">Dutch (nl-NL)</option><option value="en-US">English (en-US)</option></select></label>
            <label><span>Render engine</span><select value={renderEngine} onChange={(event)=>setRenderEngine(event.target.value as RenderEngine)}><option value="cpu">CPU (software)</option><option value="intel">Intel GPU (VAAPI)</option><option value="nvidia">NVIDIA NVENC</option></select></label>
          </div>
          <div className="settingsTts"><TtsSelector value={ttsSelection} showReferenceAudio={false} disabled={saving} onChange={setTtsSelection}/></div>
          <div className="settingsActions"><button type="button" className="primaryButton compactButton" disabled={saving} onClick={()=>void saveDefaults()}>{saving?"Saving…":"Save defaults"}</button></div>
        </section>

        <section className="settingsCard">
          <div className="settingsCardHeader"><div><p className="eyebrow">Google Cloud</p><h2>Chirp 3 HD</h2><p>Upload Application Default Credentials or a service-account JSON file. The file is stored only in the credentials volume.</p></div><StatusPill configured={googleConfigured}/></div>
          <label className="settingsFile"><span>Credentials JSON</span><input type="file" accept="application/json,.json" onChange={(event)=>setGoogleFile(event.target.files?.[0]??null)}/><small>{googleFile?.name??"Nothing selected"}</small></label>
          <div className="settingsActions"><button type="button" className="primaryButton compactButton" disabled={saving||!googleFile} onClick={()=>void saveGoogle()}>Save Google credentials</button>{googleConfigured?<button type="button" className="secondaryButton compactButton" disabled={saving} onClick={()=>void removeGoogle()}>Remove</button>:null}</div>
        </section>

        <section className="settingsCard">
          <div className="settingsCardHeader"><div><p className="eyebrow">Microsoft Azure</p><h2>Azure Speech</h2><p>Configure the optional Azure Speech provider. Leave the key blank when updating region or endpoint to keep the stored key.</p></div><StatusPill configured={azureConfigured}/></div>
          <div className="settingsFields">
            <label><span>Speech key</span><input type="password" autoComplete="new-password" value={azureKey} onChange={(event)=>setAzureKey(event.target.value)} placeholder={azureConfigured?"Stored — enter only to replace":"Paste Azure Speech key"}/></label>
            <label><span>Region</span><input value={azureRegion} onChange={(event)=>setAzureRegion(event.target.value)} placeholder="westeurope"/></label>
            <label className="wide"><span>Custom endpoint <em>optional</em></span><input value={azureEndpoint} onChange={(event)=>setAzureEndpoint(event.target.value)} placeholder="https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1"/></label>
          </div>
          <div className="settingsActions"><button type="button" className="primaryButton compactButton" disabled={saving||!azureRegion.trim()} onClick={()=>void saveAzure()}>Save Azure credentials</button>{azureConfigured?<button type="button" className="secondaryButton compactButton" disabled={saving} onClick={()=>void removeAzure()}>Remove</button>:null}</div>
        </section>
      </div>}
    </section>
  </main>;
};

const StatusPill=({configured}:{configured:boolean})=><span className={`providerStatus ${configured?"configured":"missing"}`}>{configured?"Configured":"Not configured"}</span>;
const clamp=(value:number,min:number,max:number,fallback:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
const toTtsSelection=(value:StoredTtsSettings):TtsSelection=>({
  provider:value.provider,
  language:value.language,
  edge:value.edge,
  piper:value.piper,
  omnivoice:{...value.omnivoice,referenceFile:null},
  chatterbox:{...value.chatterbox,referenceFile:null},
  xtts:{...value.xtts,referenceFile:null},
  googleChirp:value.googleChirp,
  azure:value.azure,
});
