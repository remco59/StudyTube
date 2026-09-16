import type {NormalizedScene} from "@studytube/core";
import {colors,radii,shadows,spacing,typography} from "@studytube/design-system";
import type {CSSProperties} from "react";
import {interpolate,useCurrentFrame,useVideoConfig} from "remotion";
import {getFlowchartPositions,type Point} from "./structuredLayout";

type FlowchartSceneType=Extract<NormalizedScene["scene"],{type:"flowchart"}>;

const CANVAS_WIDTH=1500;
const CANVAS_HEIGHT=500;
const NODE_WIDTH=270;
const NODE_HALF_WIDTH=NODE_WIDTH/2;
const NODE_HALF_HEIGHT=58;

export const getFlowchartLabelWidth=(label:string):number=>
  Math.min(280,Math.max(96,label.trim().length*12+28));

const edgePoint=(from:Point,to:Point):Point=>{
  const dx=to.x-from.x;
  const dy=to.y-from.y;
  if(dx===0&&dy===0)return from;
  const tx=dx===0?Number.POSITIVE_INFINITY:(NODE_HALF_WIDTH+8)/Math.abs(dx);
  const ty=dy===0?Number.POSITIVE_INFINITY:(NODE_HALF_HEIGHT+8)/Math.abs(dy);
  const t=Math.min(tx,ty);
  return {x:from.x+dx*t,y:from.y+dy*t};
};

export const SafeFlowchartScene=({scene}:{scene:FlowchartSceneType})=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const positions=getFlowchartPositions(scene.visual.nodes.length,CANVAS_WIDTH,CANVAS_HEIGHT);
  const positionById=new Map(scene.visual.nodes.map((node,index)=>[node.id,positions[index]]));
  const edges=scene.visual.edges.map((edge,index)=>{
    const fromCenter=positionById.get(edge.from);
    const toCenter=positionById.get(edge.to);
    if(!fromCenter||!toCenter)return null;
    const from=edgePoint(fromCenter,toCenter);
    const to=edgePoint(toCenter,fromCenter);
    const sameRow=Math.abs(fromCenter.y-toCenter.y)<20;
    const midX=(from.x+to.x)/2;
    const midY=(from.y+to.y)/2;
    const path=sameRow
      ?`M ${from.x} ${from.y} L ${to.x} ${to.y}`
      :`M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
    return {
      edge,
      index,
      path,
      labelX:midX,
      labelY:sameRow?Math.min(fromCenter.y,toCenter.y)-82:midY-36,
    };
  }).filter((value):value is NonNullable<typeof value>=>value!==null);

  return <div style={{display:"flex",flex:1,flexDirection:"column",justifyContent:"center",minHeight:0,minWidth:0,width:"100%"}}>
    <div style={{...typography.heading,fontSize:54,marginBottom:spacing.lg}}>{scene.visual.title??"Flowchart"}</div>
    <div style={{height:CANVAS_HEIGHT,margin:"0 auto",position:"relative",width:CANVAS_WIDTH}}>
      <svg height={CANVAS_HEIGHT} style={{left:0,overflow:"visible",position:"absolute",top:0,zIndex:1}} width={CANVAS_WIDTH}>
        <defs>
          <marker id="studytube-safe-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
            <path d="M0,0 L8,4 L0,8 z" fill={colors.accentStrong}/>
          </marker>
        </defs>
        {edges.map(({edge,index,path})=>{
          const progress=interpolate(frame,[6+index*2,18+index*2],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
          return <path
            key={`${edge.from}-${edge.to}-${index}`}
            d={path}
            fill="none"
            markerEnd="url(#studytube-safe-arrow)"
            opacity={progress}
            stroke={colors.accentStrong}
            strokeWidth={5}
          />;
        })}
      </svg>

      {edges.map(({edge,index,labelX,labelY})=>edge.label?<div
        key={`label-${edge.from}-${edge.to}-${index}`}
        style={{
          ...reveal(frame,fps,6+index*2),
          backgroundColor:colors.canvas,
          border:`1px solid ${colors.line}`,
          borderRadius:radii.pill,
          color:colors.textMuted,
          fontSize:20,
          fontWeight:650,
          left:labelX,
          lineHeight:1.12,
          maxWidth:280,
          padding:"6px 10px",
          position:"absolute",
          textAlign:"center",
          top:labelY,
          transform:"translate(-50%, -50%)",
          width:getFlowchartLabelWidth(edge.label),
          zIndex:4,
        }}
      >{edge.label}</div>:null)}

      {scene.visual.nodes.map((node,index)=>{
        const point=positions[index];
        const labelFontSize=node.label.length>24?24:node.label.length>16?26:29;
        return <div
          key={node.id}
          style={{
            ...reveal(frame,fps,index*2),
            backgroundColor:colors.surfaceRaised,
            border:`1px solid ${colors.line}`,
            borderRadius:radii.md,
            boxShadow:shadows.soft,
            left:point.x-NODE_HALF_WIDTH,
            minHeight:100,
            minWidth:0,
            padding:`${spacing.sm}px ${spacing.md}px`,
            position:"absolute",
            top:point.y-50,
            width:NODE_WIDTH,
            zIndex:2,
          }}
        >
          <div style={{fontSize:labelFontSize,fontWeight:800,lineHeight:1.05,overflowWrap:"anywhere"}}>{node.label}</div>
          {node.detail?<div style={{color:colors.textMuted,fontSize:21,lineHeight:1.2,marginTop:8,overflowWrap:"anywhere"}}>{node.detail}</div>:null}
        </div>;
      })}
    </div>
  </div>;
};

const reveal=(frame:number,fps:number,delayFrames:number):CSSProperties=>{
  const progress=interpolate(frame,[delayFrames,delayFrames+Math.max(8,Math.round(fps*.35))],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return {opacity:progress,transform:`translateY(${(1-progress)*24}px)`};
};
