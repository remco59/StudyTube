import {resolveMultipleChoiceThinkingSeconds,type NormalizedScene,type NormalizedStudyTubeProject} from "@studytube/core";
import {colors,radii,spacing,typography} from "@studytube/design-system";
import type {CSSProperties,ReactNode} from "react";
import {Img,interpolate,useCurrentFrame,useVideoConfig} from "remotion";
import {resolveProjectAsset} from "../assets/assetResolver";

type Scene=NormalizedScene["scene"];
type SceneOf<T extends Scene["type"]>=Extract<Scene,{type:T}>;
type Project=NormalizedStudyTubeProject["project"];

export const VersatileSceneRenderer=({normalizedScene,project}:{normalizedScene:NormalizedScene;project:Project})=>{
  const {scene}=normalizedScene;
  switch(scene.type){
    case "bulletReveal":return <BulletRevealScene scene={scene}/>;
    case "annotatedImage":return <AnnotatedImageScene scene={scene} project={project}/>;
    case "dataChart":return <DataChartScene scene={scene}/>;
    case "matrix":return <MatrixScene scene={scene}/>;
    case "cycle":return <CycleScene scene={scene}/>;
    case "multipleChoice":return <MultipleChoiceScene scene={scene} narrationDurationSeconds={normalizedScene.narrationDurationSeconds}/>;
    case "workedExample":return <WorkedExampleScene scene={scene}/>;
    case "hierarchy":return <HierarchyScene scene={scene}/>;
    default:throw new Error(`Versatile scene renderer cannot render "${scene.type}".`);
  }
};

const BulletRevealScene=({scene}:{scene:SceneOf<"bulletReveal">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();
  return <Stage><SceneTitle title={scene.visual.title??"Belangrijk"}/><div style={{display:"grid",width:"100%"}}>
    {scene.visual.points.map((point,index)=><div key={`${point}-${index}`} style={{...reveal(frame,fps,index*5),alignItems:"center",borderTop:index===0?`1px solid ${colors.line}`:undefined,borderBottom:`1px solid ${colors.line}`,display:"grid",gap:spacing.md,gridTemplateColumns:"64px 1fr",minHeight:92,padding:`${spacing.md}px 0`}}>
      <div style={{alignItems:"center",border:`2px solid ${colors.accent}`,borderRadius:radii.pill,color:colors.accent,display:"flex",fontSize:22,fontWeight:850,height:46,justifyContent:"center",width:46}}>{index+1}</div>
      <div style={{...typography.body,fontSize:31,lineHeight:1.3}}>{point}</div>
    </div>)}
  </div></Stage>;
};

const AnnotatedImageScene=({scene,project}:{scene:SceneOf<"annotatedImage">;project:Project})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const asset=resolveProjectAsset(project,scene.visual.assetId,"image");
  return <Stage>{scene.visual.title?<SceneTitle title={scene.visual.title}/>:null}<div style={{borderRadius:radii.md,flex:1,minHeight:0,overflow:"hidden",position:"relative",width:"100%"}}>
    <Img src={asset.src} alt={asset.alt??scene.visual.caption??asset.id} style={{height:"100%",objectFit:scene.visual.fit??"contain",width:"100%"}}/>
    <svg height="100%" style={{inset:0,pointerEvents:"none",position:"absolute",width:"100%"}} viewBox="0 0 100 100" preserveAspectRatio="none">{scene.visual.annotations.map((annotation,index)=>{const tx=annotation.targetX??annotation.x;const ty=annotation.targetY??annotation.y;return <line key={`line-${index}`} x1={annotation.x} y1={annotation.y} x2={tx} y2={ty} stroke={colors.accent} strokeWidth="0.4" opacity={revealOpacity(frame,fps,4+index*4)}/>;})}</svg>
    {scene.visual.annotations.map((annotation,index)=><div key={`${annotation.label}-${index}`} style={{...reveal(frame,fps,4+index*4),backgroundColor:colors.canvasSoft,borderLeft:`3px solid ${colors.accent}`,color:colors.text,fontSize:23,fontWeight:720,left:`${annotation.x}%`,maxWidth:250,padding:"9px 12px",position:"absolute",top:`${annotation.y}%`,transform:"translate(-50%, -50%)"}}>{annotation.label}</div>)}
  </div>{scene.visual.caption?<div style={{...typography.body,color:colors.textMuted,fontSize:27,lineHeight:1.3,marginTop:spacing.sm}}>{scene.visual.caption}</div>:null}</Stage>;
};

const DataChartScene=({scene}:{scene:SceneOf<"dataChart">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const max=Math.max(...scene.visual.data.map((item)=>item.value),1);
  if(scene.visual.chartType==="donut"){
    const total=Math.max(scene.visual.data.reduce((sum,item)=>sum+item.value,0),1);let offset=0;
    const stops=scene.visual.data.map((item,index)=>{const start=offset;offset+=item.value/total*100;return `${chartColor(index)} ${start}% ${offset}%`;}).join(", ");
    return <Stage><SceneTitle title={scene.visual.title??"Data"}/><div style={{alignItems:"center",display:"grid",gap:spacing.xxl,gridTemplateColumns:"520px 1fr",width:"100%"}}>
      <div style={{...reveal(frame,fps,2),alignItems:"center",background:`conic-gradient(${stops})`,borderRadius:"50%",display:"flex",height:430,justifyContent:"center",width:430}}><div style={{alignItems:"center",backgroundColor:colors.canvas,borderRadius:"50%",display:"flex",flexDirection:"column",height:230,justifyContent:"center",width:230}}><div style={{fontSize:50,fontWeight:900}}>{formatValue(total,scene.visual.unit)}</div><div style={{color:colors.textMuted,fontSize:23}}>totaal</div></div></div>
      <div style={{display:"grid",gap:spacing.sm}}>{scene.visual.data.map((item,index)=><LegendItem key={item.label} label={item.label} value={formatValue(item.value,scene.visual.unit)} index={index} style={reveal(frame,fps,5+index*3)}/>)}</div>
    </div><SourceLabel text={scene.visual.sourceLabel}/></Stage>;
  }
  if(scene.visual.chartType==="line"){
    const width=1420;const height=470;const pad=60;const points=scene.visual.data.map((item,index)=>({x:pad+index*((width-pad*2)/Math.max(1,scene.visual.data.length-1)),y:height-pad-(item.value/max)*(height-pad*2)}));const polyline=points.map((point)=>`${point.x},${point.y}`).join(" ");
    return <Stage><SceneTitle title={scene.visual.title??"Ontwikkeling"}/><svg viewBox={`0 0 ${width} ${height}`} style={{height:500,width:"100%"}}><line x1={pad} x2={width-pad} y1={height-pad} y2={height-pad} stroke={colors.line} strokeWidth={3}/><polyline points={polyline} fill="none" stroke={colors.accent} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" opacity={revealOpacity(frame,fps,4)}/>{points.map((point,index)=><g key={scene.visual.data[index].label} opacity={revealOpacity(frame,fps,5+index*3)}><circle cx={point.x} cy={point.y} r={10} fill={colors.accent}/><text x={point.x} y={point.y-24} fill={colors.text} fontSize={24} textAnchor="middle">{formatValue(scene.visual.data[index].value,scene.visual.unit)}</text><text x={point.x} y={height-18} fill={colors.textMuted} fontSize={22} textAnchor="middle">{scene.visual.data[index].label}</text></g>)}</svg><SourceLabel text={scene.visual.sourceLabel}/></Stage>;
  }
  return <Stage><SceneTitle title={scene.visual.title??"Vergelijking"}/><div style={{alignItems:"end",display:"grid",gap:spacing.xl,gridTemplateColumns:`repeat(${scene.visual.data.length}, minmax(0, 1fr))`,height:500,width:"100%"}}>{scene.visual.data.map((item,index)=>{const progress=interpolate(frame,[4+index*3,20+index*3],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});return <div key={item.label} style={{alignItems:"center",display:"flex",flexDirection:"column",height:"100%",justifyContent:"flex-end"}}><div style={{fontSize:26,fontWeight:800,marginBottom:8}}>{formatValue(item.value,scene.visual.unit)}</div><div style={{backgroundColor:colors.accent,borderRadius:`${radii.sm}px ${radii.sm}px 0 0`,height:`${Math.max(5,item.value/max*78*progress)}%`,minHeight:10,width:"58%"}}/><div style={{color:colors.textMuted,fontSize:22,marginTop:10,textAlign:"center"}}>{item.label}</div></div>;})}</div><SourceLabel text={scene.visual.sourceLabel}/></Stage>;
};

const MatrixScene=({scene}:{scene:SceneOf<"matrix">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const cells=[scene.visual.quadrants.topLeft,scene.visual.quadrants.topRight,scene.visual.quadrants.bottomLeft,scene.visual.quadrants.bottomRight];
  return <Stage><SceneTitle title={scene.visual.title??"2×2-matrix"}/><div style={{display:"grid",flex:1,gridTemplateColumns:"80px 1fr",gridTemplateRows:"1fr 58px",minHeight:0,width:"100%"}}>
    <div style={{alignItems:"center",color:colors.textMuted,display:"flex",fontSize:20,justifyContent:"space-between",padding:"18px 0",writingMode:"vertical-rl",transform:"rotate(180deg)"}}><span>{scene.visual.yAxis?.low??"laag"}</span><span>{scene.visual.yAxis?.high??"hoog"}</span></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr"}}>{cells.map((cell,index)=><div key={cell.title} style={{...reveal(frame,fps,index*3),borderBottom:index<2?`1px solid ${colors.line}`:undefined,borderRight:index%2===0?`1px solid ${colors.line}`:undefined,padding:spacing.lg,position:"relative"}}>{index===1?<div style={{backgroundColor:colors.accent,height:4,left:spacing.lg,position:"absolute",right:spacing.lg,top:0}}/>:null}<div style={{...typography.heading,fontSize:34}}>{cell.title}</div>{cell.detail?<div style={{...typography.body,color:colors.textMuted,fontSize:25,lineHeight:1.35,marginTop:spacing.sm}}>{cell.detail}</div>:null}</div>)}</div>
    <div/><div style={{color:colors.textMuted,display:"flex",fontSize:20,justifyContent:"space-between",paddingTop:12}}><span>{scene.visual.xAxis?.low??"laag"}</span><span>{scene.visual.xAxis?.high??"hoog"}</span></div>
  </div></Stage>;
};

const CycleScene=({scene}:{scene:SceneOf<"cycle">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const width=1450;const height=560;const center={x:width/2,y:height/2};const radiusX=510;const radiusY=210;
  const points=scene.visual.steps.map((_,index)=>{const angle=-Math.PI/2+index/scene.visual.steps.length*Math.PI*2;return {x:center.x+Math.cos(angle)*radiusX,y:center.y+Math.sin(angle)*radiusY};});
  return <Stage><SceneTitle title={scene.visual.title??"Cyclus"}/><div style={{height,margin:"0 auto",position:"relative",width}}><svg height={height} style={{inset:0,position:"absolute"}} width={width}>{points.map((point,index)=>{const next=points[(index+1)%points.length];return <line key={index} x1={point.x} y1={point.y} x2={next.x} y2={next.y} stroke={colors.line} strokeWidth={3} opacity={revealOpacity(frame,fps,4+index*2)}/>;})}</svg>
    {scene.visual.center?<div style={{alignItems:"center",border:`2px solid ${colors.accent}`,borderRadius:radii.pill,display:"flex",fontSize:30,fontWeight:850,height:116,justifyContent:"center",left:center.x-155,padding:spacing.sm,position:"absolute",textAlign:"center",top:center.y-58,width:310}}>{scene.visual.center}</div>:null}
    {scene.visual.steps.map((step,index)=>{const point=points[index];return <div key={step.title} style={{...reveal(frame,fps,4+index*2),left:point.x-130,minHeight:90,padding:spacing.sm,position:"absolute",textAlign:"center",top:point.y-52,width:260}}><div style={{alignItems:"center",border:`1px solid ${colors.line}`,borderRadius:radii.pill,color:colors.accent,display:"flex",fontSize:17,fontWeight:850,height:38,justifyContent:"center",margin:"0 auto 8px",width:38}}>{index+1}</div><div style={{fontSize:27,fontWeight:800}}>{step.icon?`${step.icon} `:""}{step.title}</div>{step.detail?<div style={{color:colors.textMuted,fontSize:19,lineHeight:1.25,marginTop:5}}>{step.detail}</div>:null}</div>;})}
  </div></Stage>;
};

const MultipleChoiceScene=({scene,narrationDurationSeconds}:{scene:SceneOf<"multipleChoice">;narrationDurationSeconds:number})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const thinkingSeconds=resolveMultipleChoiceThinkingSeconds(scene);const thinkingStartsAt=Math.ceil(narrationDurationSeconds*fps);const revealAt=thinkingStartsAt+Math.ceil(thinkingSeconds*fps);const revealed=frame>=revealAt;const thinking=frame>=thinkingStartsAt&&!revealed;const remainingSeconds=Math.max(1,Math.ceil((revealAt-frame)/fps));
  return <Stage><div style={{...typography.heading,fontSize:58,lineHeight:1.08,marginBottom:spacing.xl,maxWidth:1450}}>{scene.visual.question}</div><div style={{display:"grid",width:"100%"}}>{scene.visual.options.map((option,index)=>{const correct=index===scene.visual.correctIndex;return <div key={option.label} style={{...reveal(frame,fps,index*3),alignItems:"center",backgroundColor:revealed&&correct?colors.accentSoft:undefined,borderBottom:`1px solid ${colors.line}`,borderLeft:revealed&&correct?`4px solid ${colors.accent}`:"4px solid transparent",display:"grid",gap:spacing.md,gridTemplateColumns:"60px 1fr",padding:`${spacing.md}px ${spacing.lg}px`}}><div style={{alignItems:"center",border:`2px solid ${revealed&&correct?colors.accent:colors.line}`,borderRadius:radii.pill,color:revealed&&correct?colors.accent:colors.textMuted,display:"flex",fontSize:22,fontWeight:850,height:46,justifyContent:"center",width:46}}>{String.fromCharCode(65+index)}</div><div><div style={{fontSize:30,fontWeight:750}}>{option.label}</div>{revealed&&correct&&option.explanation?<div style={{color:colors.textMuted,fontSize:23,lineHeight:1.3,marginTop:8}}>{option.explanation}</div>:null}</div></div>;})}</div>{!revealed?<div style={{alignItems:"center",color:colors.textMuted,display:"flex",fontSize:24,gap:spacing.sm,marginTop:spacing.md}}>{thinking?<><span>Denk na</span><span style={{alignItems:"center",border:`2px solid ${colors.accent}`,borderRadius:radii.pill,color:colors.accent,display:"flex",fontSize:22,fontWeight:850,height:44,justifyContent:"center",width:44}}>{remainingSeconds}</span></>:<span>Luister naar de vraag…</span>}</div>:<div style={{color:colors.accent,fontSize:24,fontWeight:800,marginTop:spacing.md}}>Antwoord</div>}</Stage>;
};

const WorkedExampleScene=({scene}:{scene:SceneOf<"workedExample">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();
  return <Stage><SceneTitle title={scene.visual.title??"Uitgewerkt voorbeeld"}/><div style={{borderLeft:`4px solid ${colors.accent}`,fontSize:29,lineHeight:1.35,marginBottom:spacing.xl,paddingLeft:spacing.md}}><strong style={{color:colors.accent}}>Opgave:</strong> {scene.visual.problem}</div>
    <div style={{display:"grid",width:"100%"}}>{scene.visual.steps.map((step,index)=><div key={`${step.title}-${index}`} style={{...reveal(frame,fps,index*4),alignItems:"start",borderLeft:`2px solid ${colors.line}`,display:"grid",gap:spacing.md,gridTemplateColumns:"70px 1fr",marginLeft:26,padding:`0 0 ${spacing.lg}px ${spacing.lg}px`,position:"relative"}}><div style={{alignItems:"center",backgroundColor:colors.canvas,border:`2px solid ${colors.accent}`,borderRadius:radii.pill,color:colors.accent,display:"flex",fontSize:22,fontWeight:850,height:52,justifyContent:"center",left:-27,position:"absolute",top:0,width:52}}>{step.label??index+1}</div><div style={{gridColumn:2}}><div style={{fontSize:29,fontWeight:850}}>{step.title}</div><div style={{color:colors.textMuted,fontSize:24,lineHeight:1.35,marginTop:5}}>{step.body}</div></div></div>)}</div>
    {scene.visual.result?<div style={{...reveal(frame,fps,scene.visual.steps.length*4+5),borderTop:`1px solid ${colors.line}`,fontSize:31,fontWeight:800,marginTop:spacing.sm,paddingTop:spacing.md}}>Conclusie: <span style={{color:colors.accent}}>{scene.visual.result}</span></div>:null}
  </Stage>;
};

const HierarchyScene=({scene}:{scene:SceneOf<"hierarchy">})=>{
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const levels=scene.visual.direction==="bottomUp"?[...scene.visual.levels].reverse():scene.visual.levels;
  return <Stage><SceneTitle title={scene.visual.title??"Hiërarchie"}/><div style={{alignItems:"center",display:"flex",flex:1,flexDirection:"column",gap:spacing.sm,justifyContent:"center",width:"100%"}}>{levels.map((level,index)=>{const width=48+index/Math.max(1,levels.length-1)*48;return <div key={`${level.label}-${index}`} style={{...reveal(frame,fps,index*4),borderBottom:`2px solid ${index===0?colors.accent:colors.line}`,padding:`${spacing.sm}px ${spacing.md}px`,textAlign:"center",width:`${width}%`}}><div style={{color:index===0?colors.accent:colors.text,fontSize:30,fontWeight:850}}>{level.label}</div>{level.detail?<div style={{color:colors.textMuted,fontSize:22,lineHeight:1.3,marginTop:4}}>{level.detail}</div>:null}</div>;})}</div></Stage>;
};

const Stage=({children}:{children:ReactNode})=><div style={{display:"flex",flex:1,flexDirection:"column",minHeight:0,width:"100%"}}>{children}</div>;
const SceneTitle=({title}:{title:string})=><div style={{...typography.heading,fontSize:52,lineHeight:1.05,marginBottom:spacing.xl,maxWidth:1200}}>{title}</div>;
const SourceLabel=({text}:{text?:string})=>text?<div style={{color:colors.textMuted,fontSize:20,marginTop:spacing.sm}}>Bron: {text}</div>:null;
const LegendItem=({label,value,index,style}:{label:string;value:string;index:number;style?:CSSProperties})=><div style={{...style,alignItems:"center",borderBottom:`1px solid ${colors.line}`,display:"grid",gap:spacing.sm,gridTemplateColumns:"24px 1fr auto",padding:`${spacing.sm}px 0`}}><div style={{backgroundColor:chartColor(index),borderRadius:radii.pill,height:16,width:16}}/><div style={{fontSize:27}}>{label}</div><div style={{fontSize:27,fontWeight:850}}>{value}</div></div>;
const formatValue=(value:number,unit?:string)=>`${Number.isInteger(value)?value:value.toFixed(1)}${unit?` ${unit}`:""}`;
const chartColor=(index:number)=>[colors.accent,colors.warning,colors.textMuted,colors.accentStrong,colors.text,colors.line,colors.accentSoft,colors.surface][index%8];
const revealOpacity=(frame:number,fps:number,delay:number)=>interpolate(frame,[delay,delay+fps*.45],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
const reveal=(frame:number,fps:number,delay:number):CSSProperties=>{const opacity=revealOpacity(frame,fps,delay);return {opacity,transform:`translateY(${(1-opacity)*22}px)`};};