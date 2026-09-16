export type VoiceOption={id:string;label:string};

const languageLabels:Record<string,string>={
  "nl-NL":"Dutch (Netherlands)",
  "nl-BE":"Dutch (Belgium)",
  "en-US":"English (US)",
  "en-GB":"English (UK)",
  "de-DE":"German",
  "fr-FR":"French",
  "es-ES":"Spanish",
};

export const neuralVoiceCatalog:Record<string,VoiceOption[]>={
  "nl-NL":[{id:"nl-NL-MaartenNeural",label:"Maarten (male)"},{id:"nl-NL-FennaNeural",label:"Fenna (female)"},{id:"nl-NL-ColetteNeural",label:"Colette (female)"}],
  "nl-BE":[{id:"nl-BE-ArnaudNeural",label:"Arnaud (male)"},{id:"nl-BE-DenaNeural",label:"Dena (female)"}],
  "en-US":[{id:"en-US-GuyNeural",label:"Guy (male)"},{id:"en-US-JennyNeural",label:"Jenny (female)"},{id:"en-US-AriaNeural",label:"Aria (female)"}],
  "en-GB":[{id:"en-GB-RyanNeural",label:"Ryan (male)"},{id:"en-GB-SoniaNeural",label:"Sonia (female)"}],
  "de-DE":[{id:"de-DE-ConradNeural",label:"Conrad (male)"},{id:"de-DE-KatjaNeural",label:"Katja (female)"}],
  "fr-FR":[{id:"fr-FR-HenriNeural",label:"Henri (male)"},{id:"fr-FR-DeniseNeural",label:"Denise (female)"}],
  "es-ES":[{id:"es-ES-AlvaroNeural",label:"Álvaro (male)"},{id:"es-ES-ElviraNeural",label:"Elvira (female)"}],
};

const chirpCharacterNames=["Charon","Puck","Kore","Fenrir","Aoede","Leda","Orus","Zephyr"];
export const chirpVoiceCatalog:Record<string,VoiceOption[]>=Object.fromEntries(
  Object.keys(neuralVoiceCatalog).map((language)=>[language,chirpCharacterNames.map((name)=>({id:`${language}-Chirp3-HD-${name}`,label:name}))]),
);

export const voiceLanguageOptions:VoiceOption[]=Object.keys(neuralVoiceCatalog).map((id)=>({id,label:languageLabels[id]??id}));
export const isKnownVoiceLanguage=(language:string):boolean=>language in neuralVoiceCatalog;
