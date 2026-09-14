import type {NormalizedChapter,NormalizedScene,NormalizedStudyTubeProject} from "@studytube/core";

const FPS=30;

const project={
  version:"1.0",
  metadata:{title:"StudyTube scene library demo",language:"nl-NL",targetDuration:150,style:"educational-explainer",description:"Developer fixture covering production, structured and media/document scenes."},
  assets:{
    architecture:{type:"image",path:"assets/studytube-architecture.svg",alt:"StudyTube pipeline diagram"},
    designPaper:{type:"document",path:"documents/design-science.txt",title:"An Introduction to Design Science"}
  },
  chapters:[
    {id:"intro",title:"Waarom StudyTube?",scenes:[
      {id:"intro-title",type:"title",narration:"Van studiemateriaal naar een video zonder handmatige montage.",motion:"scale",visual:{eyebrow:"StudyTube",title:"Leren als een YouTube-video",subtitle:"Een renderer die inhoud omzet in een visueel verhaal."}},
      {id:"intro-kinetic",type:"kineticText",narration:"Inhoud wordt scenes en scenes worden video.",motion:"reveal",visual:{text:"Inhoud wordt scenes. Scenes worden video.",emphasis:["scenes","video"]}},
      {id:"intro-definition",type:"definition",narration:"Een scene is één duidelijke visuele gedachte met een eigen doel.",visual:{term:"Scene",definition:"Eén visuele gedachte die precies ondersteunt wat de voice-over uitlegt.",example:"Een definitie, vergelijking, vraag of opvallend getal."}}
    ]},
    {id:"visual-storytelling",title:"Visueel vertellen",scenes:[
      {id:"visual-number",type:"bigNumber",narration:"Een video kan meer dan honderd visuele momenten bevatten.",motion:"slam",visual:{value:"100+",label:"visuele momenten",context:"Snelle afwisseling voorkomt een gesproken PowerPoint."}},
      {id:"visual-comparison",type:"comparison",narration:"Slides en storytelling sturen aandacht anders.",visual:{left:{title:"Slides",body:"Veel tekst tegelijk",icon:"▤"},right:{title:"Storytelling",body:"Eén idee per moment",icon:"▶"},versusLabel:"→"}},
      {id:"visual-question",type:"question",narration:"Wat moet blijven hangen?",visual:{question:"Wat moet blijven hangen?",prompt:"Dat bepaalt welke visual nodig is."}},
      {id:"visual-recap",type:"recap",narration:"Kortom: maak het visueel en gericht.",visual:{title:"Drie regels",points:["Eén gedachte per scene","Stuur aandacht met beweging","Laat visuals uitleggen"]}}
    ]},
    {id:"structured-information",title:"Structuur zichtbaar maken",scenes:[
      {id:"structured-timeline",type:"timeline",narration:"Een tijdlijn maakt ontwikkeling zichtbaar.",visual:{title:"Van probleem naar oplossing",items:[{label:"1",title:"Probleem"},{label:"2",title:"Onderzoek"},{label:"3",title:"Ontwerp"},{label:"4",title:"Evaluatie"},{label:"5",title:"Iteratie"}]}},
      {id:"structured-process",type:"process",narration:"Een proces toont opeenvolgende handelingen.",visual:{title:"Design Science-cyclus",steps:[{title:"Probleem",icon:"?"},{title:"Doelen",icon:"◎"},{title:"Bouwen",icon:"◆"},{title:"Testen",icon:"✓"},{title:"Leren",icon:"↻"}]}},
      {id:"structured-flow",type:"flowchart",narration:"Een flowchart laat relaties expliciet zien.",visual:{title:"Hoe bewijs stroomt",nodes:[{id:"context",label:"Context"},{id:"evidence",label:"Evidence"},{id:"artifact",label:"Artefact"},{id:"evaluation",label:"Evaluatie"},{id:"knowledge",label:"Kennis"}],edges:[{from:"context",to:"evidence"},{from:"evidence",to:"artifact"},{from:"artifact",to:"evaluation"},{from:"evaluation",to:"knowledge"}]}},
      {id:"structured-diagram",type:"diagram",narration:"Een diagram verbindt een centraal concept aan factoren.",visual:{center:"Digitale transformatie",items:[{label:"Mensen",icon:"●"},{label:"Proces",icon:"↻"},{label:"Technologie",icon:"⌘"},{label:"Leiderschap",icon:"▲"},{label:"Cultuur",icon:"◇"}]}},
      {id:"structured-icons",type:"iconScene",narration:"Een icon scene groepeert voorbeelden.",visual:{title:"Artefacten",items:[{icon:"▣",label:"App"},{icon:"◇",label:"Model"},{icon:"⚙",label:"Proces"},{icon:"▤",label:"Dashboard"},{icon:"◎",label:"Interventie"},{icon:"↗",label:"Prototype"}]}}
    ]},
    {id:"media",title:"Bronnen en beeld",scenes:[
      {id:"media-image",type:"image",narration:"Project-local afbeeldingen kunnen direct onderdeel van een scene worden.",motion:"cameraPush",visual:{assetId:"architecture",fit:"contain",caption:"Een lokale SVG uit het StudyTube-project."}},
      {id:"media-document",type:"document",narration:"Documenten krijgen een herkenbare paper-weergave.",visual:{assetId:"designPaper",page:3,caption:"De bron blijft zichtbaar zonder een browser PDF-viewer nodig te hebben."}},
      {id:"media-highlight",type:"documentHighlight",narration:"Belangrijke passages kunnen gericht worden uitgelicht.",motion:"reveal",visual:{assetId:"designPaper",page:4,highlightText:"Design Science verbindt het begrijpen van een probleem aan het ontwerpen en evalueren van een artefact.",caption:"Highlight uit het studiemateriaal"}},
      {id:"media-gag",type:"visualGag",narration:"En soms mag een uitleg ook gewoon een kleine visuele grap maken.",motion:"slam",visual:{preset:"giantReport",label:"Literatuuronderzoek",punchline:"Want blijkbaar waren 12 pagina's niet genoeg."}}
    ]}
  ]
} satisfies NormalizedStudyTubeProject["project"];

const durationBySceneId:Record<string,number>={
  "intro-title":150,"intro-kinetic":135,"intro-definition":165,
  "visual-number":135,"visual-comparison":180,"visual-question":150,"visual-recap":180,
  "structured-timeline":210,"structured-process":210,"structured-flow":225,"structured-diagram":195,"structured-icons":195,
  "media-image":180,"media-document":165,"media-highlight":180,"media-gag":150
};

const buildSampleProject=():NormalizedStudyTubeProject=>{
  let cursor=0;let globalSceneIndex=0;
  const chapters:NormalizedChapter[]=project.chapters.map((chapter,chapterIndex)=>{
    const chapterStart=cursor;
    const scenes:NormalizedScene[]=chapter.scenes.map((scene,sceneIndex)=>{
      const durationInFrames=durationBySceneId[scene.id];
      if(!durationInFrames) throw new Error(`Missing sample duration for scene ${scene.id}`);
      const startFrame=cursor;cursor+=durationInFrames;const durationSeconds=durationInFrames/FPS;
      const normalizedScene:NormalizedScene={scene,chapterId:chapter.id,chapterIndex,sceneIndex,globalSceneIndex,startFrame,endFrameExclusive:cursor,durationInFrames,narrationDurationSeconds:Math.max(.1,durationSeconds-.35),durationSeconds};
      globalSceneIndex+=1;return normalizedScene;
    });
    return {id:chapter.id,title:chapter.title,chapterIndex,startFrame:chapterStart,endFrameExclusive:cursor,durationInFrames:cursor-chapterStart,durationSeconds:(cursor-chapterStart)/FPS,scenes};
  });
  return {project,fps:FPS,startFrame:0,endFrameExclusive:cursor,totalFrames:cursor,totalDurationSeconds:cursor/FPS,chapters};
};

export const SAMPLE_NORMALIZED_PROJECT=buildSampleProject();
