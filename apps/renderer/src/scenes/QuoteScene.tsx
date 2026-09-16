import type {NormalizedScene} from "@studytube/core";
import {colors,spacing,typography} from "@studytube/design-system";
import {interpolate,useCurrentFrame,useVideoConfig} from "remotion";

type Scene=NormalizedScene["scene"];
type QuoteSceneType=Extract<Scene,{type:"quote"}>;

export const QuoteScene=({scene}:{scene:QuoteSceneType})=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const quoteOpacity=interpolate(frame,[0,fps*.65],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const metaOpacity=interpolate(frame,[fps*.45,fps*1.05],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const fontSize=scene.visual.quote.length>420?38:scene.visual.quote.length>260?44:scene.visual.quote.length>140?52:62;
  const attribution=[scene.visual.author,scene.visual.work].filter(Boolean).join(" — ");

  return <div style={{alignItems:"center",display:"flex",flex:1,justifyContent:"center",minHeight:0,width:"100%"}}>
    <div style={{maxWidth:1420,padding:`${spacing.lg}px ${spacing.xl}px`,position:"relative",width:"100%"}}>
      <div aria-hidden="true" style={{color:colors.accent,fontFamily:"Georgia, serif",fontSize:170,fontWeight:900,left:0,lineHeight:.75,opacity:.24,position:"absolute",top:0}}>“</div>
      {scene.visual.context?<div style={{...typography.label,color:colors.accent,marginBottom:spacing.xl,opacity:metaOpacity,textTransform:"uppercase"}}>{scene.visual.context}</div>:null}
      <blockquote style={{borderLeft:`4px solid ${colors.accent}`,margin:0,opacity:quoteOpacity,padding:`0 0 0 ${spacing.xl}px`,transform:`translateY(${(1-quoteOpacity)*24}px)`}}>
        <div style={{color:colors.text,fontFamily:"Georgia, serif",fontSize,fontStyle:"italic",fontWeight:600,letterSpacing:-1.1,lineHeight:1.25}}>“{scene.visual.quote}”</div>
      </blockquote>
      {(attribution||scene.visual.locator)?<div style={{alignItems:"baseline",display:"flex",flexWrap:"wrap",gap:12,marginLeft:spacing.xl+4,marginTop:spacing.xl,opacity:metaOpacity}}>{attribution?<div style={{fontSize:27,fontWeight:850}}>{attribution}</div>:null}{scene.visual.locator?<div style={{color:colors.textMuted,fontSize:23}}>{scene.visual.locator}</div>:null}</div>:null}
    </div>
  </div>;
};
