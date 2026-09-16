"use client";

import {useEffect,useState} from "react";
import {chirpVoiceCatalog,isKnownVoiceLanguage,neuralVoiceCatalog,voiceLanguageOptions,type VoiceOption} from "./voiceCatalog";

export type TtsProviderChoice="edge"|"piper"|"omnivoice"|"chatterbox"|"xtts"|"google-chirp"|"azure";
export type TtsSelection={
  provider:TtsProviderChoice;
  language:string;
  edge:{voice:string;rate:string};
  piper:{voice:string;lengthScale:number};
  omnivoice:{speed:number;numSteps:number;instruction:string;normalizeText:boolean;referenceText:string;referenceFile:File|null};
  chatterbox:{t3Model:"v2"|"v3";exaggeration:number;cfgWeight:number;temperature:number;referenceFile:File|null};
  xtts:{speaker:string;speed:number;referenceFile:File|null};
  googleChirp:{voice:string};
  azure:{voice:string};
};

type GoogleChirpUsage={
  period:string;
  usedCharacters:number;
  limitCharacters:number;
  remainingCharacters:number;
  percentUsed:number;
  exhausted:boolean;
  resetsAt:string;
  trackingScope:string;
};

export const defaultTtsSelection:TtsSelection={
  provider:"edge",
  language:"nl-NL",
  edge:{voice:"nl-NL-MaartenNeural",rate:"+0%"},
  piper:{voice:"nl_NL-mls-medium",lengthScale:1},
  omnivoice:{speed:1,numSteps:16,instruction:"male, young adult, medium pitch",normalizeText:true,referenceText:"",referenceFile:null},
  chatterbox:{t3Model:"v2",exaggeration:.5,cfgWeight:.5,temperature:.8,referenceFile:null},
  xtts:{speaker:"Ana Florence",speed:1,referenceFile:null},
  googleChirp:{voice:"nl-NL-Chirp3-HD-Charon"},
  azure:{voice:"nl-NL-MaartenNeural"},
};

export const applyProjectLanguage=(selection:TtsSelection,projectLanguage:string):TtsSelection=>{
  if(!isKnownVoiceLanguage(projectLanguage)||selection.language===projectLanguage)return selection;
  const neuralVoice=neuralVoiceCatalog[projectLanguage]?.[0];
  const chirpVoice=chirpVoiceCatalog[projectLanguage]?.[0];
  return {
    ...selection,
    language:projectLanguage,
    edge:neuralVoice?{...selection.edge,voice:neuralVoice.id}:selection.edge,
    azure:neuralVoice?{voice:neuralVoice.id}:selection.azure,
    googleChirp:chirpVoice?{voice:chirpVoice.id}:selection.googleChirp,
  };
};

export const serializeTtsSettings=(selection:TtsSelection)=>JSON.stringify({
  edge:{voice:selection.edge.voice,rate:selection.edge.rate},
  piper:{voice:selection.piper.voice,lengthScale:selection.piper.lengthScale},
  omnivoice:{speed:selection.omnivoice.speed,numSteps:selection.omnivoice.numSteps,instruction:selection.omnivoice.instruction,normalizeText:selection.omnivoice.normalizeText,referenceText:selection.omnivoice.referenceText},
  chatterbox:{t3Model:selection.chatterbox.t3Model,exaggeration:selection.chatterbox.exaggeration,cfgWeight:selection.chatterbox.cfgWeight,temperature:selection.chatterbox.temperature},
  xtts:{speaker:selection.xtts.speaker,speed:selection.xtts.speed},
  googleChirp:{voice:selection.googleChirp.voice},
  azure:{voice:selection.azure.voice},
});

export const getTtsReferenceFile=(selection:TtsSelection):File|null=>{
  if(selection.provider==="omnivoice")return selection.omnivoice.referenceFile;
  if(selection.provider==="chatterbox")return selection.chatterbox.referenceFile;
  if(selection.provider==="xtts")return selection.xtts.referenceFile;
  return null;
};

type Props={value:TtsSelection;disabled?:boolean;showReferenceAudio?:boolean;onChange:(value:TtsSelection)=>void};
const choices:{id:TtsProviderChoice;label:string;detail:string;badge:string}[]=[
  {id:"edge",label:"Edge TTS",detail:"Microsoft neural voices · fast · internet required",badge:"Standard"},
  {id:"google-chirp",label:"Google Chirp 3 HD",detail:"Premium cloud voices · Dutch HD · 1M chars/month free",badge:"Standard"},
  {id:"piper",label:"Piper",detail:"Fully local and lightweight · very fast on CPU",badge:"Standard"},
  {id:"azure",label:"Azure Speech",detail:"Optional Microsoft Speech API · Dutch neural and HD voices",badge:"Optional"},
  {id:"omnivoice",label:"OmniVoice",detail:"Optional local model · voice design and cloning · enable Docker profile",badge:"Optional"},
  {id:"chatterbox",label:"Chatterbox Multilingual",detail:"Optional local Dutch TTS · zero-shot voice cloning · enable Docker profile",badge:"Optional"},
  {id:"xtts",label:"XTTS v2",detail:"Optional local multilingual voice cloning · enable Docker profile",badge:"Optional"},
];

export const TtsSelector=({value,disabled=false,showReferenceAudio=true,onChange}:Props)=>{
  const [settingsOpen,setSettingsOpen]=useState<TtsProviderChoice|null>(null);
  const [chirpUsage,setChirpUsage]=useState<GoogleChirpUsage|null>(null);
  const [chirpUsageError,setChirpUsageError]=useState<string|null>(null);

  useEffect(()=>{
    let cancelled=false;
    const load=async()=>{
      try{
        const response=await fetch("/api/settings/google/usage",{cache:"no-store"});
        const result=await response.json() as GoogleChirpUsage&{error?:string};
        if(cancelled)return;
        if(!response.ok)throw new Error(result.error??"Could not load Google Chirp usage");
        setChirpUsage(result);
        setChirpUsageError(null);
      }catch(cause){
        if(cancelled)return;
        setChirpUsage(null);
        setChirpUsageError(cause instanceof Error?cause.message:"Could not load Google Chirp usage");
      }
    };
    void load();
    const timer=window.setInterval(()=>void load(),30_000);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[]);

  const chirpBlocked=chirpUsage?.exhausted===true||chirpUsageError!==null;
  const select=(provider:TtsProviderChoice)=>{
    if(provider==="google-chirp"&&chirpBlocked)return;
    onChange({...value,provider});
  };

  return <div className="ttsBlock">
    <div className="ttsHeading"><div><strong>Text-to-speech</strong><span>Edge TTS, Piper and Google Chirp 3 HD are included in the standard Docker stack. Larger local engines are optional.</span></div></div>
    <div className="ttsOptions">{choices.map((choice)=>{
      const blocked=choice.id==="google-chirp"&&chirpBlocked;
      const badge=choice.id==="google-chirp"&&chirpUsage?(chirpUsage.exhausted?"Free tier used":`${Math.round(chirpUsage.percentUsed)}% used`):choice.badge;
      return <div className={`ttsOption${value.provider===choice.id?" selected":""}${blocked?" blocked":""}`} key={choice.id}>
        <button type="button" className="ttsOptionSelect" disabled={disabled||blocked} onClick={()=>select(choice.id)}>
          <span className="engineRadio">{value.provider===choice.id?"●":"○"}</span>
          <span className="engineCopy"><strong>{choice.label}</strong><small>{choice.detail}</small></span>
          <span className={`ttsBadge ${choice.id}`}>{blocked&&chirpUsageError?"Usage unavailable":badge}</span>
        </button>
        <button type="button" className={`ttsSettingsButton${settingsOpen===choice.id?" active":""}`} aria-label={`${choice.label} settings`} title={`${choice.label} settings`} disabled={disabled} onClick={()=>setSettingsOpen((current)=>current===choice.id?null:choice.id)}>⚙</button>
        {choice.id==="google-chirp"?<GoogleUsageMeter usage={chirpUsage} error={chirpUsageError}/>:null}
        {settingsOpen===choice.id?<div className="ttsSettingsPanel"><Settings provider={choice.id} value={value} showReferenceAudio={showReferenceAudio} onChange={onChange}/></div>:null}
      </div>;
    })}</div>
    {!showReferenceAudio?<p className="ttsSettingsHint">Voice-cloning reference audio remains a per-render setting and is not stored as a default.</p>:null}
  </div>;
};

const GoogleUsageMeter=({usage,error}:{usage:GoogleChirpUsage|null;error:string|null})=>{
  if(error)return <div className="chirpUsageMeter unavailable"><div className="chirpUsageMeta"><span>Monthly free tier</span><strong>Usage unavailable</strong></div><small>Chirp is blocked until StudyTube can verify usage, preventing accidental paid synthesis.</small></div>;
  if(!usage)return <div className="chirpUsageMeter loading"><div className="chirpUsageMeta"><span>Monthly free tier</span><strong>Checking…</strong></div></div>;
  const used=Math.min(100,Math.max(0,usage.percentUsed));
  return <div className={`chirpUsageMeter${usage.exhausted?" exhausted":""}`}>
    <div className="chirpUsageMeta"><span>Monthly free tier</span><strong>{formatCharacters(usage.usedCharacters)} / {formatCharacters(usage.limitCharacters)}</strong></div>
    <div className="chirpUsageTrack" aria-label={`${Math.round(used)}% of Google Chirp free tier used`}><span style={{width:`${used}%`}}/></div>
    <small>{usage.exhausted?"Free allowance used up — Chirp is blocked.":`${formatCharacters(usage.remainingCharacters)} characters remaining`} · resets {formatResetDate(usage.resetsAt)} · StudyTube-tracked usage</small>
  </div>;
};

const Settings=({provider,value,showReferenceAudio,onChange}:{provider:TtsProviderChoice;value:TtsSelection;showReferenceAudio:boolean;onChange:(next:TtsSelection)=>void})=>{
  if(provider==="edge")return <EdgeSettings value={value} onChange={onChange}/>;
  if(provider==="piper")return <PiperSettings value={value} onChange={onChange}/>;
  if(provider==="omnivoice")return <OmniVoiceSettings value={value} showReferenceAudio={showReferenceAudio} onChange={onChange}/>;
  if(provider==="chatterbox")return <ChatterboxSettings value={value} showReferenceAudio={showReferenceAudio} onChange={onChange}/>;
  if(provider==="xtts")return <XttsSettings value={value} showReferenceAudio={showReferenceAudio} onChange={onChange}/>;
  if(provider==="google-chirp")return <GoogleSettings value={value} onChange={onChange}/>;
  return <AzureSettings value={value} onChange={onChange}/>;
};

const EdgeSettings=({value,onChange}:SettingsProps)=><div className="ttsSettingsGrid">
  <NeuralVoicePicker language={value.language} voice={value.edge.voice} catalog={neuralVoiceCatalog}
    onLanguageChange={(language)=>onChange({...value,language})}
    onVoiceChange={(voice)=>onChange({...value,edge:{...value.edge,voice}})}/>
  <label><span>Rate</span><input value={value.edge.rate} onChange={(event)=>onChange({...value,edge:{...value.edge,rate:event.target.value}})} placeholder="+0%"/></label>
  <p className="ttsSettingsHint wide">Rate examples: <code>-5%</code>, <code>+0%</code>, <code>+10%</code>.</p>
</div>;

const PiperSettings=({value,onChange}:SettingsProps)=><div className="ttsSettingsGrid">
  <label><span>Voice model</span><input value={value.piper.voice} onChange={(event)=>onChange({...value,piper:{...value.piper,voice:event.target.value}})} placeholder="nl_NL-mls-medium"/></label>
  <label><span>Length scale</span><input type="number" min="0.4" max="3" step="0.05" value={value.piper.lengthScale} onChange={(event)=>onChange({...value,piper:{...value.piper,lengthScale:numberOr(event.target.value,1)}})}/></label>
  <p className="ttsSettingsHint">Lower length scale speaks faster; higher values speak slower.</p>
</div>;

const OmniVoiceSettings=({value,showReferenceAudio,onChange}:SettingsProps&{showReferenceAudio:boolean})=><div className="ttsSettingsGrid">
  <label><span>Speed</span><input type="number" min="0.4" max="3" step="0.05" value={value.omnivoice.speed} onChange={(event)=>onChange({...value,omnivoice:{...value.omnivoice,speed:numberOr(event.target.value,1)}})}/></label>
  <label><span>Quality steps</span><select value={value.omnivoice.numSteps} onChange={(event)=>onChange({...value,omnivoice:{...value.omnivoice,numSteps:Number(event.target.value)}})}><option value={16}>16 · faster</option><option value={24}>24 · balanced</option><option value={32}>32 · higher quality</option></select></label>
  <label className="wide"><span>Voice design</span><input value={value.omnivoice.instruction} onChange={(event)=>onChange({...value,omnivoice:{...value.omnivoice,instruction:event.target.value}})} placeholder="male, young adult, medium pitch"/></label>
  {showReferenceAudio?<ReferenceAudio value={value.omnivoice.referenceFile} hint="3–10 seconds of clean speech works best." onChange={(file)=>onChange({...value,omnivoice:{...value.omnivoice,referenceFile:file}})}/>:null}
  <label className="wide"><span>Reference transcript <em>optional</em></span><textarea rows={2} value={value.omnivoice.referenceText} onChange={(event)=>onChange({...value,omnivoice:{...value.omnivoice,referenceText:event.target.value}})} placeholder="What is being said in the reference audio?"/></label>
  <label className="ttsCheckbox wide"><input type="checkbox" checked={value.omnivoice.normalizeText} onChange={(event)=>onChange({...value,omnivoice:{...value.omnivoice,normalizeText:event.target.checked}})}/><span>Normalize numbers and dates before synthesis</span></label>
  <p className="ttsSettingsHint wide">Reference audio takes priority over voice design. CPU inference can be slow; start with 16 steps.</p>
</div>;

const ChatterboxSettings=({value,showReferenceAudio,onChange}:SettingsProps&{showReferenceAudio:boolean})=><div className="ttsSettingsGrid">
  <label><span>Multilingual model</span><select value={value.chatterbox.t3Model} onChange={(event)=>onChange({...value,chatterbox:{...value.chatterbox,t3Model:event.target.value as "v2"|"v3"}})}><option value="v2">V2 · stable</option><option value="v3">V3 · newer</option></select></label>
  <label><span>Exaggeration</span><input type="number" min="0" max="2" step="0.05" value={value.chatterbox.exaggeration} onChange={(event)=>onChange({...value,chatterbox:{...value.chatterbox,exaggeration:numberOr(event.target.value,.5)}})}/></label>
  <label><span>CFG / pace</span><input type="number" min="0" max="1" step="0.05" value={value.chatterbox.cfgWeight} onChange={(event)=>onChange({...value,chatterbox:{...value.chatterbox,cfgWeight:numberOr(event.target.value,.5)}})}/></label>
  <label><span>Temperature</span><input type="number" min="0.05" max="5" step="0.05" value={value.chatterbox.temperature} onChange={(event)=>onChange({...value,chatterbox:{...value.chatterbox,temperature:numberOr(event.target.value,.8)}})}/></label>
  {showReferenceAudio?<ReferenceAudio value={value.chatterbox.referenceFile} hint="Optional. Without one, StudyTube uses Chatterbox's Dutch demo voice." onChange={(file)=>onChange({...value,chatterbox:{...value.chatterbox,referenceFile:file}})}/>:null}
</div>;

const XttsSettings=({value,showReferenceAudio,onChange}:SettingsProps&{showReferenceAudio:boolean})=><div className="ttsSettingsGrid">
  <label><span>Built-in speaker</span><input value={value.xtts.speaker} onChange={(event)=>onChange({...value,xtts:{...value.xtts,speaker:event.target.value}})} placeholder="Ana Florence"/></label>
  <label><span>Speed</span><input type="number" min="0.4" max="3" step="0.05" value={value.xtts.speed} onChange={(event)=>onChange({...value,xtts:{...value.xtts,speed:numberOr(event.target.value,1)}})}/></label>
  {showReferenceAudio?<ReferenceAudio value={value.xtts.referenceFile} hint="Optional. A reference clip replaces the built-in speaker with voice cloning." onChange={(file)=>onChange({...value,xtts:{...value.xtts,referenceFile:file}})}/>:null}
  <p className="ttsSettingsHint wide">XTTS uses the Coqui Public Model License. The container starts normally, but synthesis stays disabled until you explicitly accept that license with <code>COQUI_TOS_AGREED=1</code>.</p>
</div>;

const GoogleSettings=({value,onChange}:SettingsProps)=><div className="ttsSettingsGrid">
  <NeuralVoicePicker language={value.language} voice={value.googleChirp.voice} catalog={chirpVoiceCatalog}
    onLanguageChange={(language)=>onChange({...value,language})
    }
    onVoiceChange={(voice)=>onChange({...value,googleChirp:{voice}})}/>
  <p className="ttsSettingsHint wide">Requires Google Cloud credentials. StudyTube hard-blocks Chirp when its tracked monthly 1 million character free allowance is used.</p>
</div>;

const AzureSettings=({value,onChange}:SettingsProps)=><div className="ttsSettingsGrid">
  <NeuralVoicePicker language={value.language} voice={value.azure.voice} catalog={neuralVoiceCatalog}
    onLanguageChange={(language)=>onChange({...value,language})}
    onVoiceChange={(voice)=>onChange({...value,azure:{voice}})}/>
  <p className="ttsSettingsHint wide">Requires Azure Speech credentials. You can also try HD voices supported by your Azure resource.</p>
</div>;

const NeuralVoicePicker=({language,voice,catalog,onLanguageChange,onVoiceChange}:{
  language:string;voice:string;catalog:Record<string,VoiceOption[]>;
  onLanguageChange:(language:string)=>void;onVoiceChange:(voice:string)=>void;
})=>{
  const options=catalog[language]??[];
  const isCustom=!options.some((option)=>option.id===voice);
  return <>
    <label><span>Language</span><select value={language} onChange={(event)=>{
      const nextLanguage=event.target.value;
      onLanguageChange(nextLanguage);
      const nextVoice=catalog[nextLanguage]?.[0];
      if(nextVoice)onVoiceChange(nextVoice.id);
    }}>{voiceLanguageOptions.map((option)=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
    <label><span>Voice</span><select value={isCustom?"custom":voice} onChange={(event)=>{if(event.target.value!=="custom")onVoiceChange(event.target.value);}}>
      {options.map((option)=><option key={option.id} value={option.id}>{option.label}</option>)}
      <option value="custom">Custom voice ID…</option>
    </select></label>
    {isCustom?<label className="wide"><span>Custom voice ID</span><input value={voice} onChange={(event)=>onVoiceChange(event.target.value)} placeholder="nl-NL-MaartenNeural"/></label>:null}
  </>;
};

const ReferenceAudio=({value,hint,onChange}:{value:File|null;hint:string;onChange:(file:File|null)=>void})=><label className="wide"><span>Reference audio <em>optional</em></span><input className="fileInput" type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.webm" onChange={(event)=>onChange(event.target.files?.[0]??null)}/><small>{value?value.name:hint}</small></label>;
type SettingsProps={value:TtsSelection;onChange:(next:TtsSelection)=>void};
const numberOr=(value:string,fallback:number)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;};
const formatCharacters=(value:number)=>new Intl.NumberFormat().format(Math.max(0,Math.round(value)));
const formatResetDate=(value:string)=>{
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"next month":date.toLocaleDateString([],{day:"numeric",month:"short"});
};
