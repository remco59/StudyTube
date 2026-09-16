import type {NormalizedScene,NormalizedStudyTubeProject} from "@studytube/core";
import {colors,spacing,video} from "@studytube/design-system";
import {AbsoluteFill,useCurrentFrame,useVideoConfig} from "remotion";
import {getSceneMotionStyle} from "../motion";
import {SceneRouter} from "../scenes/SceneRouter";

export type SceneFrameProps={chapterTitle:string;normalizedScene:NormalizedScene;project:NormalizedStudyTubeProject["project"];hasCaptions?:boolean;documentPages?:Record<string,string>};

export const SceneFrame=({normalizedScene,project,hasCaptions=false,documentPages}:SceneFrameProps)=>{
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const {scene,durationInFrames}=normalizedScene;
  const fullBleed=scene.type==="video";
  const immersive=scene.type==="title"||scene.type==="chapterIntro";
  const animatedStyle=getSceneMotionStyle({frame,durationInFrames,fps,intent:scene.motion??"fade"});
  const captionReserve=hasCaptions?112:0;
  const contentPadding=fullBleed?0:immersive?`0 0 ${captionReserve}px`:`${spacing.md}px 0 ${spacing.md+captionReserve}px`;

  // The ring slowly rotates and its dot orbits along with it; the lower blur
  // drifts on a slower, independent cycle, so the backdrop keeps a gentle
  // sense of motion even during long, mostly-static scenes.
  const orbitAngle=(frame/fps)*8;
  const orbitAngleRad=(orbitAngle*Math.PI)/180;
  const ringRadius=150;
  const ringCenterX=80+ringRadius;
  const ringCenterY=44+ringRadius;
  const dotX=ringCenterX+Math.sin(orbitAngleRad)*ringRadius;
  const dotY=ringCenterY-Math.cos(orbitAngleRad)*ringRadius;
  const drift=Math.sin(frame/fps/3)*16;

  return <AbsoluteFill style={{background:`radial-gradient(circle at 84% 18%, ${colors.accentSoft} 0%, transparent 30%), linear-gradient(135deg, ${colors.canvas} 0%, ${colors.canvasSoft} 100%)`,overflow:"hidden",paddingTop:fullBleed?0:video.safeArea.top,paddingRight:fullBleed?0:video.safeArea.right,paddingBottom:fullBleed?0:video.safeArea.bottom,paddingLeft:fullBleed?0:video.safeArea.left}}>
    <div style={{border:`2px solid ${colors.line}`,borderRadius:"50%",height:300,opacity:.72,position:"absolute",right:80,top:44+drift*.2,transform:`rotate(${orbitAngle}deg)`,width:300}}/>
    <div style={{backgroundColor:colors.accent,borderRadius:"50%",boxShadow:`0 0 30px ${colors.accent}`,height:18,opacity:.9,position:"absolute",left:dotX-9,top:dotY-9+drift*.2,width:18}}/>
    <div style={{border:`1px solid ${colors.line}`,borderRadius:"50%",bottom:-185+drift,height:430,left:-175+drift*.5,opacity:.32,position:"absolute",width:430}}/>
    <div style={{...animatedStyle,display:"flex",flex:1,flexDirection:"column",minHeight:0,minWidth:0,position:"relative",zIndex:1}}>
      <div style={{alignItems:"stretch",display:"flex",flex:1,justifyContent:"center",minHeight:0,minWidth:0,padding:contentPadding}}><SceneRouter normalizedScene={normalizedScene} project={project} documentPages={documentPages}/></div>
    </div>
  </AbsoluteFill>;
};
