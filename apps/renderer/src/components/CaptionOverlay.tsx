import type {CaptionCue} from "@studytube/core";
import {colors,radii,shadows,spacing,typography,video} from "@studytube/design-system";
import {useCurrentFrame} from "remotion";

export const findActiveCaption=(cues:CaptionCue[],frame:number):CaptionCue|undefined=>cues.find((cue)=>frame>=cue.startFrame&&frame<cue.endFrameExclusive);

export const CaptionOverlay=({cues}:{cues:CaptionCue[]})=>{
  const frame=useCurrentFrame();
  const cue=findActiveCaption(cues,frame);
  if(!cue)return null;
  return <div style={{bottom:video.safeArea.bottom+72,display:"flex",justifyContent:"center",left:video.safeArea.left,pointerEvents:"none",position:"absolute",right:video.safeArea.right,zIndex:20}}><div style={{...typography.body,backgroundColor:"rgba(16,18,22,.92)",border:`1px solid ${colors.line}`,borderRadius:radii.md,boxShadow:shadows.soft,color:colors.text,fontSize:34,fontWeight:680,lineHeight:1.18,maxWidth:1180,padding:`${spacing.sm}px ${spacing.md}px`,textAlign:"center"}}>{cue.text}</div></div>;
};
