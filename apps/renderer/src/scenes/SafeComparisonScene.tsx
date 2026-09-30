import type {NormalizedScene} from "@studytube/core";
import {colors,radii,spacing,typography} from "@studytube/design-system";
import type {CSSProperties,ReactNode} from "react";
import {interpolate,spring,useCurrentFrame,useVideoConfig} from "remotion";
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
    const dividerProgress=interpolate(frame,[2,2+Math.max(8,Math.round(fps*.3))],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
    const badgePop=spring({config:{damping:10,mass:.55},fps,frame:frame-10});
    return <FullStage>
      <div style={{alignItems:"stretch",display:"grid",gap:spacing.lg,gridTemplateColumns:`minmax(0,1fr) ${middleColumnWidth}px minmax(0,1fr)`,maxWidth:1540,minHeight:430,minWidth:0,width:"100%"}}>
        <ComparisonColumn sideData={scene.visual.left} side="left" style={revealStyle(frame,fps,0,-36)}/>
        <div style={{alignItems:"center",display:"flex",justifyContent:"center",minHeight:0,position:"relative"}}>
          <div style={{backgroundColor:colors.line,bottom:18,left:"50%",position:"absolute",top:18,transform:`scaleY(${dividerProgress})`,transformOrigin:"top center",width:2}}/>
          <div style={{alignItems:"center",backgroundColor:colors.canvas,border:`2px solid ${colors.line}`,borderRadius:radii.pill,boxShadow:`0 0 24px ${colors.accentSoft}`,color:colors.text,display:"flex",fontSize:middleFontSize,fontWeight:850,height:Math.max(62,middleFontSize+24),justifyContent:"center",lineHeight:1,minWidth:Math.max(62,middleFontSize+24),opacity:badgePop,padding:"0 14px",position:"relative",textAlign:"center",transform:`scale(${badgePop})`,whiteSpace:"nowrap"}}>{versusLabel}</div>
        </div>
        <ComparisonColumn sideData={scene.visual.right} side="right" style={revealStyle(frame,fps,8,36)}/>
      </div>
    </FullStage>;
  }

  return <FullStage>
    <div style={{display:"grid",gap:spacing.xl,maxWidth:1540,minWidth:0,width:"100%"}}>
      <div style={{...revealStyle(frame,fps,4),alignItems:"center",display:"flex",gap:spacing.md,justifyContent:"center",minWidth:0}}>
        <div style={{backgroundColor:colors.line,height:1,maxWidth:240,width:"18%"}}/>
        <div style={{...typography.label,color:colors.accent,fontSize:24,lineHeight:1.2,maxWidth:900,overflowWrap:"anywhere",textAlign:"center",textTransform:"uppercase"}}>{versusLabel}</div>
        <div style={{backgroundColor:colors.line,height:1,maxWidth:240,width:"18%"}}/>
      </div>
      <div style={{alignItems:"stretch",display:"grid",gap:spacing.xxl,gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",minWidth:0,width:"100%"}}>
        <ComparisonColumn sideData={scene.visual.left} side="left" style={revealStyle(frame,fps,0,-36)}/>
        <ComparisonColumn sideData={scene.visual.right} side="right" style={revealStyle(frame,fps,8,36)}/>
      </div>
    </div>
  </FullStage>;
};

const ComparisonColumn=({sideData,side,style}:{sideData:ComparisonSide;side:"left"|"right";style:CSSProperties})=>{
  const contentLength=sideData.title.length+(sideData.body?.length??0);
  const titleFontSize=sideData.title.length>34?44:sideData.title.length>24?50:58;
  const bodyFontSize=contentLength>170?28:contentLength>115?31:34;

  return <div style={{...style,display:"flex",flexDirection:"column",justifyContent:"center",minHeight:390,minWidth:0,padding:`${spacing.sm}px ${spacing.md}px`}}>
    <div style={{alignItems:"center",border:`2px solid ${side==="right"?colors.warning:colors.accent}`,borderRadius:radii.pill,boxShadow:`0 0 22px ${side==="right"?colors.warning:colors.accent}`,color:side==="right"?colors.warning:colors.accent,display:"flex",height:72,justifyContent:"center",marginBottom:spacing.md,width:72}}>
      {sideData.icon?<IconGlyph icon={sideData.icon} size={36}/>:<span style={{fontSize:28,fontWeight:850}}>{side==="left"?"A":"B"}</span>}
    </div>
    <div style={{...typography.heading,fontSize:titleFontSize,lineHeight:1.03,minWidth:0,overflowWrap:"anywhere"}}>{sideData.title}</div>
    {sideData.body?<div style={{...typography.body,color:colors.textMuted,fontSize:bodyFontSize,lineHeight:1.34,marginTop:spacing.md,minWidth:0,overflowWrap:"anywhere",whiteSpace:"pre-line"}}>{sideData.body}</div>:null}
  </div>;
};

const FullStage=({children}:{children:ReactNode})=><div style={{alignItems:"center",display:"flex",flex:1,justifyContent:"center",minHeight:0,minWidth:0,width:"100%"}}>{children}</div>;

const revealStyle=(frame:number,fps:number,delayFrames:number,distance=34):CSSProperties=>{
  const duration=Math.max(8,Math.round(fps*.42));
  const progress=interpolate(frame,[delayFrames,delayFrames+duration],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return {opacity:progress,transform:`translateY(${(1-progress)*distance}px)`};
};
