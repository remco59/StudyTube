import type {NormalizedScene,NormalizedStudyTubeProject} from "@studytube/core";
import {colors,radii,shadows,spacing,typography} from "@studytube/design-system";
import type {ReactNode} from "react";
import {Img,OffthreadVideo,interpolate,staticFile,useCurrentFrame,useVideoConfig} from "remotion";
import {normalizeProjectAssetPath,resolveProjectAsset} from "../assets/assetResolver";

type Scene=NormalizedScene["scene"];
type SceneOf<T extends Scene["type"]>=Extract<Scene,{type:T}>;
type Project=NormalizedStudyTubeProject["project"];
type ImageVisual=SceneOf<"image">["visual"];
type DocumentPageManifest=Record<string,string>;

export const MediaSceneRenderer=({normalizedScene,project,documentPages}:{normalizedScene:NormalizedScene;project:Project;documentPages?:DocumentPageManifest})=>{
  const {scene}=normalizedScene;
  switch(scene.type){
    case "image":return <ImageScene project={project} scene={scene}/>;
    case "video":return <VideoScene project={project} scene={scene}/>;
    case "document":return <DocumentScene project={project} scene={scene} documentPages={documentPages}/>;
    case "documentHighlight":return <DocumentHighlightScene project={project} scene={scene} documentPages={documentPages}/>;
    case "visualGag":return <VisualGagScene scene={scene}/>;
    default:throw new Error(`Media renderer received unsupported scene type "${scene.type}".`);
  }
};

const ImageScene=({project,scene}:{project:Project;scene:SceneOf<"image">})=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const visual=scene.visual;
  const variant=visual.variant??"full";
  const asset=resolveProjectAsset(project,visual.assetId,"image");
  const fullZoom=interpolate(frame,[0,fps*5],[1.02,1.08],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const splitZoom=interpolate(frame,[0,fps*5],[1,1.025],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});

  if(variant==="split-text"){
    const imagePane=<ImagePane src={asset.src} alt={asset.alt??visual.caption??asset.id} fit={visual.fit??"contain"} zoom={splitZoom} caption={visual.caption}/>;
    const textPane=<ImageTextPane title={visual.title} text={visual.text}/>;
    const imageFirst=(visual.layout??"image-left")==="image-left";
    return <Stage><SplitLayout ratio={visual.splitRatio}>{imageFirst?imagePane:textPane}{imageFirst?textPane:imagePane}</SplitLayout></Stage>;
  }

  if(variant==="split-image"&&visual.secondaryAssetId){
    const secondary=resolveProjectAsset(project,visual.secondaryAssetId,"image");
    return <Stage><SplitLayout ratio={visual.splitRatio}>
      <ImagePane src={asset.src} alt={asset.alt??visual.caption??asset.id} fit={visual.fit??"contain"} zoom={splitZoom} caption={visual.caption}/>
      <ImagePane src={secondary.src} alt={secondary.alt??visual.secondaryCaption??secondary.id} fit={visual.secondaryFit??"contain"} zoom={splitZoom} caption={visual.secondaryCaption}/>
    </SplitLayout></Stage>;
  }

  return <Stage><div style={{display:"flex",flexDirection:"column",gap:spacing.md,height:"100%",width:"100%"}}><div style={{borderRadius:radii.md,flex:1,minHeight:0,overflow:"hidden",position:"relative"}}><Img src={asset.src} alt={asset.alt??visual.caption??asset.id} style={{height:"100%",objectFit:visual.fit??"cover",transform:`scale(${fullZoom})`,width:"100%"}}/><div style={{background:"linear-gradient(transparent, rgba(8,19,31,.54))",bottom:0,height:150,left:0,position:"absolute",right:0}}/></div>{visual.caption?<div style={{...typography.body,color:colors.textMuted,fontSize:28,lineHeight:1.3,maxWidth:1200}}>{visual.caption}</div>:null}</div></Stage>;
};

const VideoScene=({project,scene}:{project:Project;scene:SceneOf<"video">})=>{
  const asset=resolveProjectAsset(project,scene.visual.assetId,"video");
  return <Stage><div style={{height:"100%",overflow:"hidden",position:"relative",width:"100%"}}><OffthreadVideo src={asset.src} muted style={{height:"100%",objectFit:scene.visual.fit??"cover",width:"100%"}}/><div style={{background:"linear-gradient(transparent, rgba(8,19,31,.48))",bottom:0,height:180,left:0,pointerEvents:"none",position:"absolute",right:0}}/>{scene.visual.caption?<div style={{...typography.body,backgroundColor:"rgba(8,19,31,.72)",borderRadius:radii.sm,bottom:42,color:colors.text,fontSize:26,left:52,lineHeight:1.3,maxWidth:980,padding:`${spacing.sm}px ${spacing.md}px`,position:"absolute"}}>{scene.visual.caption}</div>:null}</div></Stage>;
};

const SplitLayout=({children,ratio="50/50"}:{children:ReactNode;ratio?:ImageVisual["splitRatio"]})=>{
  const columns=ratio==="60/40"?"3fr 2fr":ratio==="40/60"?"2fr 3fr":"1fr 1fr";
  return <div style={{alignItems:"stretch",display:"grid",gap:spacing.xxl,gridTemplateColumns:columns,height:"100%",minHeight:0,width:"100%"}}>{children}</div>;
};

const ImagePane=({src,alt,fit,zoom,caption}:{src:string;alt:string;fit:"contain"|"cover";zoom:number;caption?:string})=><div style={{display:"flex",flexDirection:"column",gap:spacing.sm,height:"100%",minHeight:0,minWidth:0}}><div style={{borderRadius:radii.md,flex:1,minHeight:0,overflow:"hidden",position:"relative"}}><Img src={src} alt={alt} style={{height:"100%",objectFit:fit,transform:`scale(${zoom})`,width:"100%"}}/></div>{caption?<div style={{...typography.body,color:colors.textMuted,fontSize:23,lineHeight:1.3}}>{caption}</div>:null}</div>;

const ImageTextPane=({title,text}:{title?:string;text?:string})=><div style={{alignItems:"flex-start",display:"flex",flexDirection:"column",justifyContent:"center",minHeight:0,minWidth:0,padding:`${spacing.lg}px ${spacing.sm}px`}}>{title?<div style={{...typography.heading,fontSize:58,lineHeight:1.05,maxWidth:660}}>{title}</div>:null}{text?<div style={{...typography.body,borderLeft:`3px solid ${colors.line}`,color:colors.textMuted,fontSize:33,lineHeight:1.42,marginTop:title?spacing.lg:0,maxWidth:680,paddingLeft:spacing.md}}>{text}</div>:null}</div>;

const documentPagePath=(documentPages:DocumentPageManifest|undefined,assetId:string,page:number)=>documentPages?.[`${assetId}:${page}`];

const DocumentScene=({project,scene,documentPages}:{project:Project;scene:SceneOf<"document">;documentPages?:DocumentPageManifest})=>{
  const asset=resolveProjectAsset(project,scene.visual.assetId,"document");
  const page=scene.visual.page??1;
  const pagePath=documentPagePath(documentPages,scene.visual.assetId,page);
  if(pagePath)return <Stage centered><DocumentPageView src={staticFile(normalizeProjectAssetPath(pagePath))} title={asset.title??filename(asset.path)} page={page} caption={scene.visual.caption}/></Stage>;
  return <Stage centered><Paper><DocumentHeader title={asset.title??filename(asset.path)} page={page}/><DocumentLines/><DocumentLines short/><DocumentLines/><div style={{...typography.body,color:colors.paperText,fontSize:31,marginTop:spacing.lg}}>{scene.visual.caption??"Bronmateriaal wordt als document-context in de video gebruikt."}</div></Paper></Stage>;
};

const DocumentHighlightScene=({project,scene,documentPages}:{project:Project;scene:SceneOf<"documentHighlight">;documentPages?:DocumentPageManifest})=>{
  const asset=resolveProjectAsset(project,scene.visual.assetId,"document");
  const page=scene.visual.page;
  const pagePath=documentPagePath(documentPages,scene.visual.assetId,page);
  if(pagePath)return <Stage centered><DocumentPageView src={staticFile(normalizeProjectAssetPath(pagePath))} title={asset.title??filename(asset.path)} page={page} caption={scene.visual.caption} highlightText={scene.visual.highlightText}/></Stage>;
  return <Stage centered><Paper><DocumentHeader title={asset.title??filename(asset.path)} page={page}/><DocumentLines short/><div style={{backgroundColor:"#f7e58c",borderRadius:radii.sm,color:colors.paperText,fontSize:38,fontWeight:760,lineHeight:1.2,margin:`${spacing.lg}px 0`,padding:`${spacing.md}px ${spacing.lg}px`}}>“{scene.visual.highlightText}”</div><DocumentLines/>{scene.visual.caption?<div style={{color:"#5d5a52",fontSize:27,marginTop:spacing.md}}>{scene.visual.caption}</div>:null}</Paper></Stage>;
};

const DocumentPageView=({src,title,page,caption,highlightText}:{src:string;title:string;page:number;caption?:string;highlightText?:string})=><div style={{alignItems:"center",display:"flex",flexDirection:"column",gap:spacing.sm,height:"100%",maxHeight:720,maxWidth:1380,minHeight:0,width:"100%"}}>
  <div style={{...typography.label,color:colors.textMuted,fontSize:22,lineHeight:1.2}}>{title} · p. {page}</div>
  <div style={{alignItems:"center",display:"flex",flex:1,justifyContent:"center",minHeight:0,position:"relative",width:"100%"}}>
    <Img src={src} alt={`${title}, pagina ${page}`} style={{backgroundColor:colors.paper,borderRadius:radii.sm,boxShadow:shadows.raised,height:"100%",maxHeight:"100%",maxWidth:"100%",objectFit:"contain",width:"100%"}}/>
    {highlightText?<div style={{backgroundColor:"rgba(247,229,140,.96)",borderRadius:radii.sm,bottom:22,boxShadow:shadows.raised,color:colors.paperText,fontSize:30,fontWeight:720,left:"50%",lineHeight:1.25,maxWidth:"78%",padding:`${spacing.sm}px ${spacing.md}px`,position:"absolute",transform:"translateX(-50%)",width:"max-content"}}>“{highlightText}”</div>:null}
  </div>
  {caption?<div style={{...typography.body,color:colors.textMuted,fontSize:25,lineHeight:1.25,maxWidth:1200,textAlign:"center"}}>{caption}</div>:null}
</div>;

const VisualGagScene=({scene}:{scene:SceneOf<"visualGag">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const progress=interpolate(frame,[0,fps*2],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});const label=scene.visual.label??defaultGagLabel(scene.visual.preset);
  if(scene.visual.preset==="giantReport")return <Stage centered><div style={{position:"relative",textAlign:"center"}}><div style={{backgroundColor:colors.paper,borderRadius:radii.md,boxShadow:shadows.raised,color:colors.paperText,fontSize:80,fontWeight:900,height:520,padding:spacing.xl,transform:`rotate(${-3+progress*3}deg) scale(${.86+progress*.14})`,width:760}}>200<br/><span style={{fontSize:42}}>PAGINA'S</span></div><Punchline text={scene.visual.punchline??label}/></div></Stage>;
  if(scene.visual.preset==="absurdScale")return <Stage centered><div style={{fontSize:Math.round(70+progress*180),fontWeight:900,letterSpacing:-8,textAlign:"center"}}>{label}</div></Stage>;
  if(scene.visual.preset==="redArrow")return <Stage centered><div style={{position:"relative",textAlign:"center"}}><div style={{...typography.heading,fontSize:82}}>{label}</div><div style={{color:"#ff5b5b",fontSize:190,fontWeight:900,position:"absolute",right:-210,top:-120,transform:`rotate(-25deg) translateX(${(1-progress)*80}px)`}}>↙</div><Punchline text={scene.visual.punchline}/></div></Stage>;
  if(scene.visual.preset==="fakeLoading")return <Stage centered><div style={{maxWidth:980,textAlign:"center",width:"100%"}}><div style={{...typography.heading,fontSize:72,marginBottom:spacing.xl}}>{label}</div><div style={{backgroundColor:colors.line,borderRadius:radii.pill,height:20,overflow:"hidden"}}><div style={{backgroundColor:colors.accent,height:"100%",width:`${Math.min(99,progress*115)}%`}}/></div><div style={{...typography.label,color:colors.textMuted,marginTop:spacing.md}}>{Math.round(Math.min(99,progress*115))}%</div></div></Stage>;
  return <Stage centered><div style={{alignItems:"center",display:"flex",height:620,justifyContent:"center",position:"relative",width:1100}}><div style={{border:`2px solid ${colors.line}`,borderRadius:"50%",height:420,position:"absolute",transform:`scale(${.85+progress*.15})`,width:420}}/><div style={{...typography.display,fontSize:104,position:"relative",textAlign:"center"}}>{label}</div><Punchline text={scene.visual.punchline}/></div></Stage>;
};

const Stage=({children,centered=false}:{children:ReactNode;centered?:boolean})=><div style={{alignItems:centered?"center":"stretch",display:"flex",flex:1,justifyContent:"center",minHeight:0,width:"100%"}}>{children}</div>;
const Paper=({children}:{children:ReactNode})=><div style={{backgroundColor:colors.paper,borderRadius:radii.sm,boxShadow:shadows.raised,color:colors.paperText,maxHeight:690,maxWidth:1160,overflow:"hidden",padding:`${spacing.xl}px ${spacing.xxl}px`,width:"100%"}}>{children}</div>;
const DocumentHeader=({title,page}:{title:string;page?:number})=><div style={{alignItems:"center",borderBottom:"2px solid #d9d5ca",display:"flex",justifyContent:"space-between",marginBottom:spacing.lg,paddingBottom:spacing.md}}><div style={{fontSize:32,fontWeight:850}}>{title}</div><div style={{color:"#767168",fontSize:24}}>p. {page??1}</div></div>;
const DocumentLines=({short=false}:{short?:boolean})=><div style={{display:"grid",gap:14,marginTop:spacing.md,width:short?"72%":"100%"}}>{[1,2,3].map((line)=><div key={line} style={{backgroundColor:"#dedbd2",borderRadius:radii.pill,height:16,width:line===3?"82%":"100%"}}/>)}</div>;
const Punchline=({text}:{text?:string})=>text?<div style={{...typography.body,color:colors.accent,marginTop:spacing.lg}}>{text}</div>:null;
const filename=(path:string)=>path.split("/").at(-1)??path;
const defaultGagLabel=(preset:SceneOf<"visualGag">["visual"]["preset"])=>( {giantReport:"Heel. Veel. Papier.",absurdScale:"Echt heel groot",redArrow:"Kijk hier",fakeLoading:"Even onderzoek doen…",spotlight:"Dit is belangrijk"} )[preset];
