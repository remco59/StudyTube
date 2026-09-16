import type {NormalizedScene,NormalizedStudyTubeProject} from "@studytube/core";
import {colors,radii,shadows,spacing,typography} from "@studytube/design-system";
import type {ReactNode} from "react";
import {Img,OffthreadVideo,interpolate,useCurrentFrame,useVideoConfig} from "remotion";
import {resolveProjectAsset} from "../assets/assetResolver";

type Scene=NormalizedScene["scene"];
type SceneOf<T extends Scene["type"]>=Extract<Scene,{type:T}>;
type Project=NormalizedStudyTubeProject["project"];

export const MediaSceneRenderer=({normalizedScene,project}:{normalizedScene:NormalizedScene;project:Project})=>{
  const {scene}=normalizedScene;
  switch(scene.type){
    case "image": return <ImageScene project={project} scene={scene}/>;
    case "video": return <VideoScene project={project} scene={scene}/>;
    case "document": return <DocumentScene project={project} scene={scene}/>;
    case "documentHighlight": return <DocumentHighlightScene project={project} scene={scene}/>;
    case "visualGag": return <VisualGagScene scene={scene}/>;
    default: throw new Error(`Media renderer received unsupported scene type "${scene.type}".`);
  }
};

const ImageScene=({project,scene}:{project:Project;scene:SceneOf<"image">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const asset=resolveProjectAsset(project,scene.visual.assetId,"image");
  const zoom=interpolate(frame,[0,fps*5],[1.02,1.08],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return <Stage><div style={{display:"flex",flexDirection:"column",gap:spacing.md,height:"100%",width:"100%"}}><div style={{border:`1px solid ${colors.line}`,borderRadius:radii.lg,boxShadow:shadows.raised,flex:1,minHeight:0,overflow:"hidden",position:"relative"}}><Img src={asset.src} alt={asset.alt??scene.visual.caption??asset.id} style={{height:"100%",objectFit:scene.visual.fit??"cover",transform:`scale(${zoom})`,width:"100%"}}/><div style={{background:"linear-gradient(transparent, rgba(16,18,22,.7))",bottom:0,height:180,left:0,position:"absolute",right:0}}/></div>{scene.visual.caption?<div style={{...typography.body,color:colors.textMuted,fontSize:30}}>{scene.visual.caption}</div>:null}</div></Stage>;
};

const VideoScene=({project,scene}:{project:Project;scene:SceneOf<"video">})=>{
  const asset=resolveProjectAsset(project,scene.visual.assetId,"video");
  return <Stage><div style={{display:"flex",flexDirection:"column",gap:spacing.md,height:"100%",width:"100%"}}><div style={{border:`1px solid ${colors.line}`,borderRadius:radii.lg,boxShadow:shadows.raised,flex:1,minHeight:0,overflow:"hidden",position:"relative"}}><OffthreadVideo src={asset.src} muted style={{height:"100%",objectFit:scene.visual.fit??"cover",width:"100%"}}/><div style={{background:"linear-gradient(transparent, rgba(16,18,22,.55))",bottom:0,height:150,left:0,pointerEvents:"none",position:"absolute",right:0}}/></div>{scene.visual.caption?<div style={{...typography.body,color:colors.textMuted,fontSize:30}}>{scene.visual.caption}</div>:null}</div></Stage>;
};

const DocumentScene=({project,scene}:{project:Project;scene:SceneOf<"document">})=>{const asset=resolveProjectAsset(project,scene.visual.assetId,"document");return <Stage centered><Paper><DocumentHeader title={asset.title??filename(asset.path)} page={scene.visual.page}/><DocumentLines/><DocumentLines short/><DocumentLines/><div style={{...typography.body,color:colors.paperText,fontSize:31,marginTop:spacing.lg}}>{scene.visual.caption??"Bronmateriaal wordt als document-context in de video gebruikt."}</div></Paper></Stage>;};

const DocumentHighlightScene=({project,scene}:{project:Project;scene:SceneOf<"documentHighlight">})=>{const asset=resolveProjectAsset(project,scene.visual.assetId,"document");return <Stage centered><Paper><DocumentHeader title={asset.title??filename(asset.path)} page={scene.visual.page}/><DocumentLines short/><div style={{backgroundColor:"#f7e58c",borderRadius:radii.sm,color:colors.paperText,fontSize:38,fontWeight:760,lineHeight:1.2,margin:`${spacing.lg}px 0`,padding:`${spacing.md}px ${spacing.lg}px`}}>“{scene.visual.highlightText}”</div><DocumentLines/>{scene.visual.caption?<div style={{color:"#5d5a52",fontSize:27,marginTop:spacing.md}}>{scene.visual.caption}</div>:null}</Paper></Stage>;};

const VisualGagScene=({scene}:{scene:SceneOf<"visualGag">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const progress=interpolate(frame,[0,fps*2],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});const label=scene.visual.label??defaultGagLabel(scene.visual.preset);
  if(scene.visual.preset==="giantReport") return <Stage centered><div style={{position:"relative",textAlign:"center"}}><div style={{backgroundColor:colors.paper,borderRadius:radii.md,boxShadow:shadows.raised,color:colors.paperText,fontSize:80,fontWeight:900,height:520,padding:spacing.xl,transform:`rotate(${-3+progress*3}deg) scale(${.86+progress*.14})`,width:760}}>200<br/><span style={{fontSize:42}}>PAGINA'S</span></div><Punchline text={scene.visual.punchline??label}/></div></Stage>;
  if(scene.visual.preset==="absurdScale") return <Stage centered><div style={{fontSize:Math.round(70+progress*180),fontWeight:900,letterSpacing:-8,textAlign:"center"}}>{label}</div></Stage>;
  if(scene.visual.preset==="redArrow") return <Stage centered><div style={{position:"relative",textAlign:"center"}}><div style={{...typography.heading,fontSize:82}}>{label}</div><div style={{color:"#ff5b5b",fontSize:190,fontWeight:900,position:"absolute",right:-210,top:-120,transform:`rotate(-25deg) translateX(${(1-progress)*80}px)`}}>↙</div><Punchline text={scene.visual.punchline}/></div></Stage>;
  if(scene.visual.preset==="fakeLoading") return <Stage centered><div style={{maxWidth:980,textAlign:"center",width:"100%"}}><div style={{...typography.heading,fontSize:72,marginBottom:spacing.xl}}>{label}</div><div style={{backgroundColor:colors.surfaceRaised,borderRadius:radii.pill,height:42,overflow:"hidden"}}><div style={{backgroundColor:colors.accent,height:"100%",width:`${Math.min(99,progress*115)}%`}}/></div><div style={{...typography.label,color:colors.textMuted,marginTop:spacing.md}}>{Math.round(Math.min(99,progress*115))}%</div></div></Stage>;
  return <Stage centered><div style={{alignItems:"center",display:"flex",height:620,justifyContent:"center",position:"relative",width:1100}}><div style={{background:"radial-gradient(circle, rgba(179,164,255,.4) 0%, rgba(179,164,255,.08) 42%, transparent 70%)",inset:0,position:"absolute",transform:`scale(${.85+progress*.15})`}}/><div style={{...typography.display,fontSize:104,position:"relative",textAlign:"center"}}>{label}</div><Punchline text={scene.visual.punchline}/></div></Stage>;
};

const Stage=({children,centered=false}:{children:ReactNode;centered?:boolean})=><div style={{alignItems:centered?"center":"stretch",display:"flex",flex:1,justifyContent:"center",minHeight:0,width:"100%"}}>{children}</div>;
const Paper=({children}:{children:ReactNode})=><div style={{backgroundColor:colors.paper,borderRadius:radii.sm,boxShadow:shadows.raised,color:colors.paperText,maxHeight:690,maxWidth:1160,overflow:"hidden",padding:`${spacing.xl}px ${spacing.xxl}px`,width:"100%"}}>{children}</div>;
const DocumentHeader=({title,page}:{title:string;page?:number})=><div style={{alignItems:"center",borderBottom:"2px solid #d9d5ca",display:"flex",justifyContent:"space-between",marginBottom:spacing.lg,paddingBottom:spacing.md}}><div style={{fontSize:32,fontWeight:850}}>{title}</div><div style={{color:"#767168",fontSize:24}}>p. {page??1}</div></div>;
const DocumentLines=({short=false}:{short?:boolean})=><div style={{display:"grid",gap:14,marginTop:spacing.md,width:short?"72%":"100%"}}>{[1,2,3].map((line)=><div key={line} style={{backgroundColor:"#dedbd2",borderRadius:radii.pill,height:16,width:line===3?"82%":"100%"}}/>)}</div>;
const Punchline=({text}:{text?:string})=>text?<div style={{...typography.body,color:colors.accent,marginTop:spacing.lg}}>{text}</div>:null;
const filename=(path:string)=>path.split("/").at(-1)??path;
const defaultGagLabel=(preset:SceneOf<"visualGag">["visual"]["preset"])=>( {giantReport:"Heel. Veel. Papier.",absurdScale:"Echt heel groot",redArrow:"Kijk hier",fakeLoading:"Even onderzoek doen…",spotlight:"Dit is belangrijk"} )[preset];
