import type {CaptionCue} from "@studytube/core";
import {colors,typography,video} from "@studytube/design-system";
import {useCurrentFrame} from "remotion";

export const findActiveCaption=(cues:CaptionCue[],frame:number):CaptionCue|undefined=>cues.find((cue)=>frame>=cue.startFrame&&frame<cue.endFrameExclusive);

export const CaptionOverlay=({cues}:{cues:CaptionCue[]})=>{
  const frame=useCurrentFrame();
  const cue=findActiveCaption(cues,frame);
  if(!cue)return null;
  return <div style={{bottom:video.safeArea.bottom+24,display:"flex",justifyContent:"center",left:video.safeArea.left,pointerEvents:"none",position:"absolute",right:video.safeArea.right,zIndex:20}}><div style={{...typography.body,color:colors.text,fontSize:32,fontWeight:650,lineHeight:1.22,maxWidth:1200,padding:"0 12px",textAlign:"center",textShadow:"0 2px 8px rgba(0,0,0,.85),0 0 24px rgba(0,0,0,.45)"}}>{cue.text}</div></div>;
};
