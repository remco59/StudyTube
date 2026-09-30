import type {NormalizedScene} from "@studytube/core";
import {colors,radii,spacing,typography} from "@studytube/design-system";
import type {CSSProperties,ReactNode} from "react";
import {interpolate,useCurrentFrame,useVideoConfig} from "remotion";

type Scene=NormalizedScene["scene"];
type SceneOf<T extends Scene["type"]>=Extract<Scene,{type:T}>;

export const SceneRenderer=({normalizedScene}:{normalizedScene:NormalizedScene})=>{
  const {scene}=normalizedScene;
  switch(scene.type){
    case "title":return <TitleScene scene={scene}/>;
    case "chapterIntro":return <ChapterIntroScene scene={scene}/>;
    case "kineticText":return <KineticTextScene scene={scene}/>;
    case "definition":return <DefinitionScene scene={scene}/>;
    case "bigNumber":return <BigNumberScene scene={scene}/>;
    case "comparison":return <ComparisonScene scene={scene}/>;
    case "question":return <QuestionScene scene={scene}/>;
    case "recap":return <RecapScene scene={scene}/>;
    default:throw new Error(`StudyTube renderer does not implement scene type "${scene.type}" yet.`);
  }
};

const TitleScene=({scene}:{scene:SceneOf<"title">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();
  return <FullStage><div style={{display:"flex",flexDirection:"column",maxWidth:1450,width:"100%"}}>
    {scene.visual.eyebrow?<div style={{...typography.label,...revealStyle(frame,fps,0),color:colors.accent,marginBottom:spacing.md,textTransform:"uppercase"}}>{scene.visual.eyebrow}</div>:null}
    <div style={{...typography.display,...revealStyle(frame,fps,0),fontSize:126,maxWidth:1420}}>{scene.visual.title}</div>
    {scene.visual.subtitle?<div style={{...typography.body,...revealStyle(frame,fps,5),color:colors.textMuted,lineHeight:1.35,marginTop:spacing.lg,maxWidth:980}}>{scene.visual.subtitle}</div>:null}
    <div style={{...revealStyle(frame,fps,10),backgroundColor:colors.accent,height:4,marginTop:spacing.xl,width:180}}/>
  </div></FullStage>;
};

const ChapterIntroScene=({scene}:{scene:SceneOf<"chapterIntro">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();
  return <FullStage><div style={{alignItems:"start",display:"grid",gap:spacing.xl,gridTemplateColumns:"110px 1fr",width:"100%"}}>
    <div style={{...revealStyle(frame,fps,0),alignItems:"center",border:`2px solid ${colors.accent}`,borderRadius:radii.pill,color:colors.accent,display:"flex",fontSize:48,fontWeight:800,height:86,justifyContent:"center",width:86}}>§</div>
    <div>
      <div style={{...typography.label,...revealStyle(frame,fps,2),color:colors.accent,marginBottom:spacing.md,textTransform:"uppercase"}}>{scene.visual.chapterLabel??"Nieuw hoofdstuk"}</div>
      <div style={{...typography.display,...revealStyle(frame,fps,5),fontSize:112,maxWidth:1160}}>{scene.visual.title}</div>
      {scene.visual.subtitle?<div style={{...typography.body,...revealStyle(frame,fps,10),color:colors.textMuted,lineHeight:1.35,marginTop:spacing.lg,maxWidth:980}}>{scene.visual.subtitle}</div>:null}
    </div>
  </div></FullStage>;
};

const KineticTextScene=({scene}:{scene:SceneOf<"kineticText">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();
  const emphasis=new Set((scene.visual.emphasis??[]).map((item)=>normalizeWord(item)));
  return <FullStage centered><div style={{...typography.display,fontSize:118,maxWidth:1500,textAlign:"center"}}>
    {scene.visual.text.split(/\s+/u).map((word,index)=>{const active=emphasis.has(normalizeWord(word));return <span key={`${word}-${index}`} style={{...revealStyle(frame,fps,index*2),color:active?colors.accent:colors.text,display:"inline-block",marginRight:24,position:"relative"}}>{word}{active?<span style={{backgroundColor:colors.accent,bottom:-10,height:5,left:0,opacity:.9,position:"absolute",right:0}}/>:null}</span>;})}
  </div></FullStage>;
};

const DefinitionScene=({scene}:{scene:SceneOf<"definition">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();
  const underlineProgress=interpolate(frame,[10,10+Math.max(8,Math.round(fps*.4))],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return <FullStage centered><div style={{alignItems:"start",display:"grid",gap:spacing.xxl,gridTemplateColumns:".78fr 1.22fr",maxWidth:1500,width:"100%"}}>
    <div style={revealStyle(frame,fps,0)}>
      <div style={{...typography.label,color:colors.accent,marginBottom:spacing.md,textTransform:"uppercase"}}>Definitie</div>
      <div style={{...typography.heading,fontSize:76,lineHeight:1.02,overflowWrap:"anywhere"}}>{scene.visual.term}</div>
      <div style={{backgroundColor:colors.accent,borderRadius:2,boxShadow:`0 0 14px ${colors.accent}`,height:4,marginTop:spacing.md,transform:`scaleX(${underlineProgress})`,transformOrigin:"left center",width:96}}/>
    </div>
    <div style={{...revealStyle(frame,fps,5),borderLeft:`2px solid ${colors.line}`,paddingLeft:spacing.xl}}>
      <div style={{...typography.heading,fontSize:52,lineHeight:1.22}}>{scene.visual.definition}</div>
      {scene.visual.example?<div style={{...typography.body,borderLeft:`4px solid ${colors.accent}`,color:colors.textMuted,fontSize:30,lineHeight:1.4,marginTop:spacing.xl,paddingLeft:spacing.md}}><strong style={{color:colors.accent}}>Voorbeeld:</strong> {scene.visual.example}</div>:null}
    </div>
  </div></FullStage>;
};

const BigNumberScene=({scene}:{scene:SceneOf<"bigNumber">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();
  return <FullStage centered><div style={{maxWidth:1500,textAlign:"center",width:"100%"}}>
    <div style={{...revealStyle(frame,fps,0),color:colors.accent,fontSize:230,fontWeight:900,letterSpacing:-12,lineHeight:.82}}>{scene.visual.value}</div>
    <div style={{...typography.heading,...revealStyle(frame,fps,4),marginTop:spacing.xl}}>{scene.visual.label}</div>
    {scene.visual.context?<div style={{...typography.body,...revealStyle(frame,fps,8),color:colors.textMuted,lineHeight:1.35,margin:`${spacing.md}px auto 0`,maxWidth:980}}>{scene.visual.context}</div>:null}
  </div></FullStage>;
};

const ComparisonScene=({scene}:{scene:SceneOf<"comparison">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();
  return <FullStage centered><div style={{alignItems:"stretch",display:"grid",gap:spacing.xl,gridTemplateColumns:"1fr 100px 1fr",maxWidth:1540,width:"100%"}}>
    <ComparisonColumn body={scene.visual.left.body} icon={scene.visual.left.icon} style={revealStyle(frame,fps,0,-36)} title={scene.visual.left.title}/>
    <div style={{...revealStyle(frame,fps,5),alignItems:"center",display:"flex",justifyContent:"center",position:"relative"}}><div style={{backgroundColor:colors.line,bottom:0,left:"50%",position:"absolute",top:0,width:2}}/><div style={{alignItems:"center",backgroundColor:colors.canvas,border:`2px solid ${colors.line}`,borderRadius:radii.pill,display:"flex",fontSize:34,fontWeight:850,height:64,justifyContent:"center",position:"relative",width:64}}>{scene.visual.versusLabel??"VS"}</div></div>
    <ComparisonColumn body={scene.visual.right.body} icon={scene.visual.right.icon} style={revealStyle(frame,fps,8,36)} title={scene.visual.right.title}/>
  </div></FullStage>;
};

const QuestionScene=({scene}:{scene:SceneOf<"question">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();
  return <FullStage centered><div style={{maxWidth:1460,textAlign:"center"}}>
    <div style={{...revealStyle(frame,fps,0),color:colors.accent,fontSize:68,fontWeight:800,marginBottom:spacing.lg}}>?</div>
    <div style={{...typography.display,...revealStyle(frame,fps,3),fontSize:106}}>{scene.visual.question}</div>
    {scene.visual.prompt?<div style={{...typography.body,...revealStyle(frame,fps,9),color:colors.textMuted,lineHeight:1.35,marginTop:spacing.xl}}>{scene.visual.prompt}</div>:null}
  </div></FullStage>;
};

const RecapScene=({scene}:{scene:SceneOf<"recap">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();
  return <FullStage><div style={{maxWidth:1500,width:"100%"}}>
    <div style={{...typography.label,...revealStyle(frame,fps,0),color:colors.accent,marginBottom:spacing.md,textTransform:"uppercase"}}>Samengevat</div>
    <div style={{...typography.heading,...revealStyle(frame,fps,2),fontSize:68,marginBottom:spacing.xl}}>{scene.visual.title??"Dit moet je onthouden"}</div>
    <div style={{display:"grid"}}>{scene.visual.points.map((point,index)=><div key={`${point}-${index}`} style={{...revealStyle(frame,fps,5+index*3,22),alignItems:"center",borderTop:index===0?`1px solid ${colors.line}`:undefined,borderBottom:`1px solid ${colors.line}`,display:"grid",gap:spacing.md,gridTemplateColumns:"70px 1fr",padding:`${spacing.md}px 0`}}>
      <div style={{alignItems:"center",border:`2px solid ${colors.accent}`,borderRadius:radii.pill,color:colors.accent,display:"flex",fontSize:24,fontWeight:850,height:50,justifyContent:"center",width:50}}>{index+1}</div>
      <div style={{...typography.body,fontSize:33,lineHeight:1.28}}>{point}</div>
    </div>)}</div>
  </div></FullStage>;
};

const ComparisonColumn=({body,icon,style,title}:{body?:string;icon?:string;style:CSSProperties;title:string})=><div style={{...style,display:"flex",flexDirection:"column",justifyContent:"center",minHeight:400,padding:`${spacing.sm}px ${spacing.md}px`}}>
  <div style={{...typography.label,color:colors.accent,marginBottom:spacing.md,textTransform:"uppercase"}}>{icon??"•"}</div>
  <div style={{...typography.heading,fontSize:58,lineHeight:1.04}}>{title}</div>
  {body?<div style={{...typography.body,color:colors.textMuted,fontSize:33,lineHeight:1.35,marginTop:spacing.md}}>{body}</div>:null}
</div>;

const FullStage=({children,centered=false}:{children:ReactNode;centered?:boolean})=><div style={{alignItems:centered?"center":"flex-start",display:"flex",flex:1,justifyContent:"center",minHeight:0,width:"100%"}}>{children}</div>;

const revealStyle=(frame:number,fps:number,delayFrames:number,distance=34):CSSProperties=>{
  const duration=Math.max(8,Math.round(fps*.42));
  const progress=interpolate(frame,[delayFrames,delayFrames+duration],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return {opacity:progress,transform:`translateY(${(1-progress)*distance}px)`};
};

const normalizeWord=(value:string)=>value.toLocaleLowerCase("nl-NL").replace(/[^\p{L}\p{N}]+/gu,"");
