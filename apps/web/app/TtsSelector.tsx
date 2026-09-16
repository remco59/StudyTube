"use client";

import {useState} from "react";

export type TtsProviderChoice="edge"|"piper"|"omnivoice";
export type TtsSelection={
  provider:TtsProviderChoice;
  edge:{voice:string;rate:string};
  piper:{voice:string;lengthScale:number};
  omnivoice:{speed:number;numSteps:number;instruction:string;normalizeText:boolean;referenceText:string;referenceFile:File|null};
};

export const defaultTtsSelection: TtsSelection={
  provider:"edge",
  edge:{voice:"nl-NL-MaartenNeural",rate:"+0%"},
  piper:{voice:"nl_NL-mls-medium",lengthScale:1},
  omnivoice:{speed:1,numSteps:16,instruction:"male, young adult, medium pitch",normalizeText:true,referenceText:"",referenceFile:null},
};

export const serializeTtsSettings=(selection:TtsSelection)=>JSON.stringify({
  edge:{voice:selection.edge.voice,rate:selection.edge.rate},
  piper:{voice:selection.piper.voice,lengthScale:selection.piper.lengthScale},
  omnivoice:{
    speed:selection.omnivoice.speed,
    numSteps:selection.omnivoice.numSteps,
    instruction:selection.omnivoice.instruction,
    normalizeText:selection.omnivoice.normalizeText,
    referenceText:selection.omnivoice.referenceText,
  },
});

type Props={value:TtsSelection;disabled?:boolean;onChange:(value:TtsSelection)=>void};

const choices:{id:TtsProviderChoice;label:string;detail:string;badge:string}[]=[
  {id:"edge",label:"Edge TTS",detail:"Microsoft neural voices · fast · internet required",badge:"Recommended"},
  {id:"piper",label:"Piper",detail:"Fully local and lightweight · lower voice quality",badge:"Offline"},
  {id:"omnivoice",label:"OmniVoice",detail:"Local multilingual model · voice cloning · slow on CPU",badge:"Experimental"},
];

export const TtsSelector=({value,disabled=false,onChange}:Props)=>{
  const [settingsOpen,setSettingsOpen]=useState<TtsProviderChoice|null>(null);
  const select=(provider:TtsProviderChoice)=>onChange({...value,provider});
  return <div className="ttsBlock">
    <div className="ttsHeading"><div><strong>Text-to-speech</strong><span>Choose the voice engine for this render.</span></div></div>
    <div className="ttsOptions">{choices.map((choice)=><div className={`ttsOption${value.provider===choice.id?" selected":""}`} key={choice.id}>
      <button type="button" className="ttsOptionSelect" disabled={disabled} onClick={()=>select(choice.id)}>
        <span className="engineRadio">{value.provider===choice.id?"●":"○"}</span>
        <span className="engineCopy"><strong>{choice.label}</strong><small>{choice.detail}</small></span>
        <span className={`ttsBadge ${choice.id}`}>{choice.badge}</span>
      </button>
      <button type="button" className={`ttsSettingsButton${settingsOpen===choice.id?" active":""}`} aria-label={`${choice.label} settings`} title={`${choice.label} settings`} disabled={disabled} onClick={()=>setSettingsOpen((current)=>current===choice.id?null:choice.id)}>⚙</button>
      {settingsOpen===choice.id?<div className="ttsSettingsPanel">{choice.id==="edge"?<EdgeSettings value={value} onChange={onChange}/>:choice.id==="piper"?<PiperSettings value={value} onChange={onChange}/>:<OmniVoiceSettings value={value} onChange={onChange}/>}</div>:null}
    </div>)}</div>
  </div>;
};

const EdgeSettings=({value,onChange}:{value:TtsSelection;onChange:(next:TtsSelection)=>void})=><div className="ttsSettingsGrid">
  <label><span>Voice</span><input value={value.edge.voice} onChange={(event)=>onChange({...value,edge:{...value.edge,voice:event.target.value}})} placeholder="nl-NL-MaartenNeural"/></label>
  <label><span>Rate</span><input value={value.edge.rate} onChange={(event)=>onChange({...value,edge:{...value.edge,rate:event.target.value}})} placeholder="+0%"/></label>
  <p className="ttsSettingsHint">Use a Microsoft neural voice name. Rate examples: <code>-5%</code>, <code>+0%</code>, <code>+10%</code>.</p>
</div>;

const PiperSettings=({value,onChange}:{value:TtsSelection;onChange:(next:TtsSelection)=>void})=><div className="ttsSettingsGrid">
  <label><span>Voice model</span><input value={value.piper.voice} onChange={(event)=>onChange({...value,piper:{...value.piper,voice:event.target.value}})} placeholder="nl_NL-mls-medium"/></label>
  <label><span>Length scale</span><input type="number" min="0.4" max="3" step="0.05" value={value.piper.lengthScale} onChange={(event)=>onChange({...value,piper:{...value.piper,lengthScale:numberOr(event.target.value,1)}})}/></label>
  <p className="ttsSettingsHint">Lower length scale speaks faster; higher values speak slower.</p>
</div>;

const OmniVoiceSettings=({value,onChange}:{value:TtsSelection;onChange:(next:TtsSelection)=>void})=><div className="ttsSettingsGrid omniSettings">
  <label><span>Speed</span><input type="number" min="0.4" max="3" step="0.05" value={value.omnivoice.speed} onChange={(event)=>onChange({...value,omnivoice:{...value.omnivoice,speed:numberOr(event.target.value,1)}})}/></label>
  <label><span>Quality steps</span><select value={value.omnivoice.numSteps} onChange={(event)=>onChange({...value,omnivoice:{...value.omnivoice,numSteps:Number(event.target.value)}})}><option value={16}>16 · faster</option><option value={24}>24 · balanced</option><option value={32}>32 · higher quality</option></select></label>
  <label className="wide"><span>Voice design</span><input value={value.omnivoice.instruction} onChange={(event)=>onChange({...value,omnivoice:{...value.omnivoice,instruction:event.target.value}})} placeholder="male, young adult, medium pitch"/></label>
  <label className="wide"><span>Reference audio <em>optional, best consistency</em></span><input className="fileInput" type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.webm" onChange={(event)=>onChange({...value,omnivoice:{...value.omnivoice,referenceFile:event.target.files?.[0]??null}})}/><small>{value.omnivoice.referenceFile?value.omnivoice.referenceFile.name:"3–10 seconds of clean speech works best."}</small></label>
  <label className="wide"><span>Reference transcript <em>optional</em></span><textarea rows={2} value={value.omnivoice.referenceText} onChange={(event)=>onChange({...value,omnivoice:{...value.omnivoice,referenceText:event.target.value}})} placeholder="What is being said in the reference audio?"/></label>
  <label className="ttsCheckbox wide"><input type="checkbox" checked={value.omnivoice.normalizeText} onChange={(event)=>onChange({...value,omnivoice:{...value.omnivoice,normalizeText:event.target.checked}})}/><span>Normalize numbers and dates before synthesis</span></label>
  <p className="ttsSettingsHint wide">Reference audio switches OmniVoice to voice cloning and takes priority over voice design. On CPU, 16 steps is the practical starting point.</p>
</div>;

const numberOr=(value:string,fallback:number)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;};
