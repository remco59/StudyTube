import type {NormalizedScene} from "@studytube/core";
import {colors,radii,spacing,typography} from "@studytube/design-system";
import type {CSSProperties,ReactNode} from "react";
import {interpolate,useCurrentFrame,useVideoConfig} from "remotion";
import {IconGlyph} from "./IconGlyph";
import {getAdaptiveGridColumns,getFlowchartPositions,getOrbitPositions} from "./structuredLayout";

type Scene=NormalizedScene["scene"];
type SceneOf<T extends Scene["type"]>=Extract<Scene,{type:T}>;

export const StructuredSceneRenderer=({normalizedScene}:{normalizedScene:NormalizedScene})=>{
  const {scene}=normalizedScene;
  switch(scene.type){
    case "timeline":return <TimelineScene scene={scene}/>;
    case "process":return <ProcessScene scene={scene}/>;
    case "flowchart":return <FlowchartScene scene={scene}/>;
    case "diagram":return <DiagramScene scene={scene}/>;
    case "iconScene":return <IconScene scene={scene}/>;
    default:throw new Error(`Structured scene renderer cannot render "${scene.type}".`);
  }
};

const TimelineScene=({scene}:{scene:SceneOf<"timeline">})=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const columns=getAdaptiveGridColumns(scene.visual.items.length,4);
  return <Stage>
    <SceneTitle title={scene.visual.title??"Tijdlijn"}/>
    <div style={{display:"grid",gap:spacing.xl,gridTemplateColumns:`repeat(${columns}, minmax(0, 1fr))`,width:"100%"}}>
      {scene.visual.items.map((item,index)=><div key={`${item.label}-${index}`} style={{...reveal(frame,fps,index*3),minHeight:210,minWidth:0,padding:`${spacing.md}px ${spacing.sm}px 0`,position:"relative"}}>
        <div style={{backgroundColor:colors.line,height:2,left:0,position:"absolute",right:0,top:18}}/>
        <div style={{backgroundColor:colors.accent,border:`6px solid ${colors.canvas}`,borderRadius:radii.pill,height:22,left:spacing.sm,position:"absolute",top:8,width:22}}/>
        <div style={{...typography.label,color:colors.accent,fontSize:21,marginTop:spacing.sm}}>{item.label}</div>
        <div style={{...typography.heading,fontSize:38,lineHeight:1.06,marginTop:spacing.sm}}>{item.title}</div>
        {item.description?<div style={{...typography.body,color:colors.textMuted,fontSize:26,lineHeight:1.35,marginTop:spacing.sm}}>{item.description}</div>:null}
      </div>)}
    </div>
  </Stage>;
};

const ProcessScene=({scene}:{scene:SceneOf<"process">})=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const columns=getAdaptiveGridColumns(scene.visual.steps.length,4);
  return <Stage>
    <SceneTitle title={scene.visual.title??"Proces"}/>
    <div style={{display:"grid",gap:spacing.xl,gridTemplateColumns:`repeat(${columns}, minmax(0, 1fr))`,width:"100%"}}>
      {scene.visual.steps.map((step,index)=><div key={`${step.title}-${index}`} style={{...reveal(frame,fps,index*3),minHeight:250,minWidth:0,padding:`0 ${spacing.sm}px`,position:"relative"}}>
        <div style={{alignItems:"center",display:"flex",gap:spacing.sm}}>
          <div style={{alignItems:"center",border:`2px solid ${index===0?colors.accent:colors.line}`,borderRadius:radii.pill,color:index===0?colors.accent:colors.textMuted,display:"flex",flexShrink:0,fontSize:24,fontWeight:850,height:58,justifyContent:"center",width:58}}>{index+1}</div>
          {step.icon?<div style={{color:colors.accent,display:"flex"}}><IconGlyph icon={step.icon} size={34}/></div>:null}
        </div>
        <div style={{...typography.heading,fontSize:38,lineHeight:1.06,marginTop:spacing.md}}>{step.title}</div>
        {step.description?<div style={{...typography.body,color:colors.textMuted,fontSize:26,lineHeight:1.35,marginTop:spacing.sm}}>{step.description}</div>:null}
        {index<scene.visual.steps.length-1&&scene.visual.steps.length<=4?<div style={{alignItems:"center",color:colors.line,display:"flex",fontSize:38,fontWeight:400,position:"absolute",right:-spacing.lg,top:8}}>→</div>:null}
      </div>)}
    </div>
  </Stage>;
};

const FlowchartScene=({scene}:{scene:SceneOf<"flowchart">})=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const width=1500;
  const height=500;
  const positions=getFlowchartPositions(scene.visual.nodes.length,width,height);
  const positionById=new Map(scene.visual.nodes.map((node,index)=>[node.id,positions[index]]));
  return <Stage>
    <SceneTitle title={scene.visual.title??"Flowchart"}/>
    <div style={{height,margin:"0 auto",position:"relative",width}}>
      <svg height={height} style={{left:0,overflow:"visible",position:"absolute",top:0}} width={width}>
        <defs><marker id="studytube-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4"><path d="M0,0 L8,4 L0,8 z" fill={colors.accentStrong}/></marker></defs>
        {scene.visual.edges.map((edge,index)=>{
          const from=positionById.get(edge.from);const to=positionById.get(edge.to);if(!from||!to)return null;
          const progress=interpolate(frame,[6+index*2,18+index*2],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
          const midY=(from.y+to.y)/2;
          return <g key={`${edge.from}-${edge.to}-${index}`} opacity={progress}><path d={`M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`} fill="none" markerEnd="url(#studytube-arrow)" stroke={colors.accentStrong} strokeWidth={4}/>{edge.label?<text fill={colors.textMuted} fontFamily={typography.fontFamily} fontSize={21} textAnchor="middle" x={(from.x+to.x)/2} y={midY-12}>{edge.label}</text>:null}</g>;
        })}
      </svg>
      {scene.visual.nodes.map((node,index)=>{const point=positions[index];return <div key={node.id} style={{...reveal(frame,fps,index*2),left:point.x-135,minHeight:96,padding:`${spacing.sm}px ${spacing.md}px`,position:"absolute",textAlign:"center",top:point.y-48,width:270,zIndex:2}}>
        <div style={{borderBottom:`2px solid ${index===0?colors.accent:colors.line}`,fontSize:28,fontWeight:800,lineHeight:1.08,paddingBottom:10}}>{node.label}</div>
        {node.detail?<div style={{color:colors.textMuted,fontSize:20,lineHeight:1.25,marginTop:10}}>{node.detail}</div>:null}
      </div>;})}
    </div>
  </Stage>;
};

const DiagramScene=({scene}:{scene:SceneOf<"diagram">})=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const width=1450;
  const height=560;
  const center={x:width/2,y:height/2};
  const positions=getOrbitPositions(scene.visual.items.length,center,510,205);
  return <Stage>
    <div style={{height,margin:"0 auto",position:"relative",width}}>
      <svg height={height} style={{left:0,position:"absolute",top:0}} width={width}>{positions.map((point,index)=><line key={`line-${index}`} opacity={interpolate(frame,[4+index*2,16+index*2],[0,.7],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})} stroke={colors.line} strokeWidth={3} x1={center.x} x2={point.x} y1={center.y} y2={point.y}/>)}</svg>
      <div style={{...reveal(frame,fps,0),alignItems:"center",border:`2px solid ${colors.accent}`,borderRadius:radii.pill,color:colors.text,display:"flex",fontSize:36,fontWeight:850,height:126,justifyContent:"center",left:center.x-170,padding:spacing.sm,position:"absolute",textAlign:"center",top:center.y-63,width:340,zIndex:3}}>{scene.visual.center}</div>
      {scene.visual.items.map((item,index)=>{const point=positions[index];return <div key={`${item.label}-${index}`} style={{...reveal(frame,fps,4+index*2),left:point.x-145,minHeight:92,padding:spacing.sm,position:"absolute",textAlign:"center",top:point.y-46,width:290,zIndex:2}}>
        {item.icon?<div style={{alignItems:"center",border:`1px solid ${colors.line}`,borderRadius:radii.pill,color:colors.accent,display:"flex",height:48,justifyContent:"center",margin:"0 auto 8px",width:48}}><IconGlyph icon={item.icon} size={26}/></div>:null}
        <div style={{fontSize:27,fontWeight:800}}>{item.label}</div>
        {item.detail?<div style={{color:colors.textMuted,fontSize:19,lineHeight:1.25,marginTop:5}}>{item.detail}</div>:null}
      </div>;})}
    </div>
  </Stage>;
};

const IconScene=({scene}:{scene:SceneOf<"iconScene">})=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const columns=getAdaptiveGridColumns(scene.visual.items.length,3);
  return <Stage>
    <SceneTitle title={scene.visual.title??"Overzicht"}/>
    <div style={{display:"grid",gap:spacing.xxl,gridTemplateColumns:`repeat(${columns}, minmax(0, 1fr))`,width:"100%"}}>
      {scene.visual.items.map((item,index)=><div key={`${item.label}-${index}`} style={{...reveal(frame,fps,index*3),alignItems:"center",display:"flex",flexDirection:"column",minHeight:210,minWidth:0,padding:`${spacing.sm}px ${spacing.md}px`,textAlign:"center"}}>
        <div style={{alignItems:"center",border:`2px solid ${index%2===0?colors.accent:colors.warning}`,borderRadius:radii.pill,color:index%2===0?colors.accent:colors.warning,display:"flex",height:86,justifyContent:"center",width:86}}><IconGlyph icon={item.icon} size={46}/></div>
        <div style={{fontSize:34,fontWeight:820,lineHeight:1.08,marginTop:spacing.md}}>{item.label}</div>
        {item.detail?<div style={{...typography.body,color:colors.textMuted,fontSize:24,lineHeight:1.35,marginTop:spacing.xs}}>{item.detail}</div>:null}
      </div>)}
    </div>
  </Stage>;
};

const Stage=({children}:{children:ReactNode})=><div style={{display:"flex",flex:1,flexDirection:"column",justifyContent:"center",minHeight:0,width:"100%"}}>{children}</div>;
const SceneTitle=({title}:{title:string})=><div style={{...typography.heading,fontSize:52,lineHeight:1.05,marginBottom:spacing.xl,maxWidth:1200}}>{title}</div>;

const reveal=(frame:number,fps:number,delayFrames:number):CSSProperties=>{
  const progress=interpolate(frame,[delayFrames,delayFrames+Math.max(8,Math.round(fps*.35))],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return {opacity:progress,transform:`translateY(${(1-progress)*24}px)`};
};
