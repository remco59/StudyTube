import type {NormalizedScene} from "@studytube/core";
import {colors,radii,shadows,spacing,typography} from "@studytube/design-system";
import type {CSSProperties,ReactNode} from "react";
import {interpolate,useCurrentFrame,useVideoConfig} from "remotion";
import {IconGlyph} from "./IconGlyph";

type ComparisonSceneType=Extract<NormalizedScene["scene"],{type:"comparison"}>;

type ComparisonSide=ComparisonSceneType["visual"]["left"];

export const isCompactVersusLabel=(value:string):boolean=>{
  const trimmed=value.trim();
  if(!trimmed)return true;
  return trimmed.length<=10&&trimmed.split(/\s+/u).length<=2;
};

export const getCompactVersusColumnWidth=(value:string):number=>{
  const length=value.trim().length;
  return Math.min(240,Math.max(130,94+length*16));
};

export const getCompactVersusFontSize=(value:string):number=>{
  const length=value.trim().length;
  if(length>=9)return 40;
  if(length>=7)return 44;
  if(length>=5)return 48;
  return 56;
};

export const SafeComparisonScene=({scene}:{scene:ComparisonSceneType})=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const versusLabel=scene.visual.versusLabel?.trim()||"VS";
  const compact=isCompactVersusLabel(versusLabel);

  if(compact){
    const middleColumnWidth=getCompactVersusColumnWidth(versusLabel);
    const middleFontSize=getCompactVersusFontSize(versusLabel);
    return <FullStage>
      <div style={{alignItems:"stretch",display:"grid",gap:spacing.lg,gridTemplateColumns:`minmax(0,1fr) ${middleColumnWidth}px minmax(0,1fr)`,maxWidth:1540,minWidth:0,width:"100%"}}>
        <ComparisonCard sideData={scene.visual.left} side="left" style={revealStyle(frame,fps,0,-36)}/>
        <div style={{...revealStyle(frame,fps,5),alignItems:"center",color:colors.accent,display:"flex",fontSize:middleFontSize,fontWeight:900,justifyContent:"center",lineHeight:1,minWidth:0,textAlign:"center",whiteSpace:"nowrap"}}>{versusLabel}</div>
        <ComparisonCard sideData={scene.visual.right} side="right" style={revealStyle(frame,fps,8,36)}/>
      </div>
    </FullStage>;
  }

  return <FullStage>
    <div style={{display:"grid",gap:spacing.lg,maxWidth:1540,minWidth:0,width:"100%"}}>
      <div style={{...revealStyle(frame,fps,4),display:"flex",justifyContent:"center",minWidth:0}}>
        <div style={{...typography.heading,backgroundColor:colors.accentSoft,border:`1px solid ${colors.accentStrong}`,borderRadius:radii.pill,color:colors.accent,fontSize:42,lineHeight:1.08,maxWidth:900,overflowWrap:"anywhere",padding:`${spacing.sm}px ${spacing.lg}px`,textAlign:"center"}}>{versusLabel}</div>
      </div>
      <div style={{alignItems:"stretch",display:"grid",gap:spacing.lg,gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",minWidth:0,width:"100%"}}>
        <ComparisonCard sideData={scene.visual.left} side="left" style={revealStyle(frame,fps,0,-36)}/>
        <ComparisonCard sideData={scene.visual.right} side="right" style={revealStyle(frame,fps,8,36)}/>
      </div>
    </div>
  </FullStage>;
};

const ComparisonCard=({sideData,side,style}:{sideData:ComparisonSide;side:"left"|"right";style:CSSProperties})=>{
  const contentLength=sideData.title.length+(sideData.body?.length??0);
  const titleFontSize=sideData.title.length>34?46:sideData.title.length>24?52:60;
  const bodyFontSize=contentLength>170?29:contentLength>115?32:36;
  const padding=contentLength>170?spacing.lg:spacing.xl;

  return <div style={{...style,backgroundColor:colors.surface,border:`1px solid ${colors.line}`,borderRadius:radii.lg,boxShadow:shadows.soft,display:"flex",flexDirection:"column",minHeight:390,minWidth:0,padding}}>
    <div style={{...typography.label,color:side==="left"?colors.textMuted:colors.accent,marginBottom:spacing.lg,textTransform:"uppercase"}}>
      {sideData.icon?<IconGlyph icon={sideData.icon} size={36}/>:side==="left"?"A":"B"}
    </div>
    <div style={{...typography.heading,fontSize:titleFontSize,lineHeight:1.02,minWidth:0,overflowWrap:"anywhere"}}>{sideData.title}</div>
    {sideData.body?<div style={{...typography.body,color:colors.textMuted,fontSize:bodyFontSize,lineHeight:1.22,marginTop:spacing.lg,minWidth:0,overflowWrap:"anywhere"}}>{sideData.body}</div>:null}
  </div>;
};

const FullStage=({children}:{children:ReactNode})=><div style={{alignItems:"center",display:"flex",flex:1,justifyContent:"center",minHeight:0,minWidth:0,width:"100%"}}>{children}</div>;

const revealStyle=(frame:number,fps:number,delayFrames:number,distance=34):CSSProperties=>{
  const duration=Math.max(8,Math.round(fps*.42));
  const progress=interpolate(frame,[delayFrames,delayFrames+duration],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return {opacity:progress,transform:`translateY(${(1-progress)*distance}px)`};
};
