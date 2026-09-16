import type {NormalizedScene,NormalizedStudyTubeProject} from "@studytube/core";
import {colors,radii,spacing,typography} from "@studytube/design-system";
import {type CSSProperties,type SyntheticEvent,useLayoutEffect,useRef,useState} from "react";
import {Img,interpolate,useCurrentFrame,useVideoConfig} from "remotion";
import {resolveProjectAsset} from "../assets/assetResolver";
import {fittedImageRect,percentPointInRect,percentPointInSize,type Size} from "./annotatedImageLayout";

type Scene=NormalizedScene["scene"];
type AnnotatedImageSceneType=Extract<Scene,{type:"annotatedImage"}>;
type Project=NormalizedStudyTubeProject["project"];

export const AnnotatedImageScene=({scene,project}:{scene:AnnotatedImageSceneType;project:Project})=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const asset=resolveProjectAsset(project,scene.visual.assetId,"image");
  const fit=scene.visual.fit??"contain";
  const stageRef=useRef<HTMLDivElement>(null);
  const [stageSize,setStageSize]=useState<Size>({width:0,height:0});
  const [imageSize,setImageSize]=useState<Size|null>(null);

  useLayoutEffect(()=>{
    const element=stageRef.current;
    if(!element)return;

    const measure=()=>{
      const rect=element.getBoundingClientRect();
      setStageSize((current)=>current.width===rect.width&&current.height===rect.height?current:{width:rect.width,height:rect.height});
    };

    measure();
    if(typeof ResizeObserver==="undefined")return;
    const observer=new ResizeObserver(measure);
    observer.observe(element);
    return ()=>observer.disconnect();
  },[]);

  const imageRect=fittedImageRect(stageSize,imageSize,fit);
  const handleImageLoad=(event:SyntheticEvent<HTMLImageElement>)=>{
    const image=event.currentTarget;
    if(image.naturalWidth>0&&image.naturalHeight>0)setImageSize({width:image.naturalWidth,height:image.naturalHeight});
  };

  return <Stage>
    {scene.visual.title?<SceneTitle title={scene.visual.title}/>:null}
    <div ref={stageRef} style={{borderRadius:radii.md,flex:1,minHeight:0,overflow:"hidden",position:"relative",width:"100%"}}>
      <Img src={asset.src} alt={asset.alt??scene.visual.caption??asset.id} onLoad={handleImageLoad} style={{height:"100%",objectFit:fit,width:"100%"}}/>
      {stageSize.width>0&&stageSize.height>0?<svg height="100%" preserveAspectRatio="none" style={{inset:0,pointerEvents:"none",position:"absolute",width:"100%"}} viewBox={`0 0 ${stageSize.width} ${stageSize.height}`}>
        {scene.visual.annotations.map((annotation,index)=>{
          const labelPoint=percentPointInSize(stageSize,annotation.x,annotation.y);
          const hasTarget=annotation.targetX!==undefined||annotation.targetY!==undefined;
          const targetPoint=hasTarget
            ?percentPointInRect(imageRect,annotation.targetX??annotation.x,annotation.targetY??annotation.y)
            :labelPoint;
          const opacity=revealOpacity(frame,fps,4+index*4);
          return <g key={`connector-${annotation.label}-${index}`} opacity={opacity}>
            <line x1={labelPoint.x} y1={labelPoint.y} x2={targetPoint.x} y2={targetPoint.y} stroke={colors.accent} strokeLinecap="round" strokeWidth={3}/>
            {hasTarget?<circle cx={targetPoint.x} cy={targetPoint.y} fill={colors.accent} r={5}/>:null}
          </g>;
        })}
      </svg>:null}
      {scene.visual.annotations.map((annotation,index)=><div key={`${annotation.label}-${index}`} style={{...reveal(frame,fps,4+index*4),backgroundColor:colors.canvasSoft,borderLeft:`3px solid ${colors.accent}`,color:colors.text,fontSize:23,fontWeight:720,left:`${annotation.x}%`,maxWidth:250,padding:"9px 12px",position:"absolute",top:`${annotation.y}%`,transform:"translate(-50%, -50%)"}}>{annotation.label}</div>)}
    </div>
    {scene.visual.caption?<div style={{...typography.body,color:colors.textMuted,fontSize:27,lineHeight:1.3,marginTop:spacing.sm}}>{scene.visual.caption}</div>:null}
  </Stage>;
};

const Stage=({children}:{children:React.ReactNode})=><div style={{display:"flex",flex:1,flexDirection:"column",minHeight:0,width:"100%"}}>{children}</div>;
const SceneTitle=({title}:{title:string})=><div style={{...typography.heading,fontSize:48,lineHeight:1.05,marginBottom:spacing.lg,maxWidth:1450}}>{title}</div>;

const revealOpacity=(frame:number,fps:number,startFrame:number)=>interpolate(frame,[startFrame,startFrame+Math.max(5,Math.round(fps*.22))],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
const reveal=(frame:number,fps:number,startFrame:number):CSSProperties=>{
  const opacity=revealOpacity(frame,fps,startFrame);
  return {opacity,transform:`translateY(${(1-opacity)*12}px)`};
};
