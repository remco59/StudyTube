import {z} from "zod";

export const STUDYTUBE_SCHEMA_VERSION = "1.0" as const;

export const motionIntentSchema = z.enum([
  "fade",
  "slide",
  "scale",
  "slam",
  "draw",
  "reveal",
  "cameraPush",
  "parallax",
  "counter",
]);

const idSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "Use letters, numbers, hyphens or underscores only");

const sourceReferenceSchema = z.object({
  label: z.string().min(1).max(160),
  url: z.string().url().optional(),
  note: z.string().max(500).optional(),
}).strict();

const sceneBaseShape = {
  id: idSchema,
  narration: z.string().min(1).max(4000),
  motion: motionIntentSchema.optional(),
  sources: z.array(sourceReferenceSchema).max(12).optional(),
};

const titleSceneSchema = z.object({...sceneBaseShape,type:z.literal("title"),visual:z.object({eyebrow:z.string().max(80).optional(),title:z.string().min(1).max(140),subtitle:z.string().max(240).optional()}).strict()}).strict();
const chapterIntroSceneSchema = z.object({...sceneBaseShape,type:z.literal("chapterIntro"),visual:z.object({chapterLabel:z.string().max(80).optional(),title:z.string().min(1).max(140),subtitle:z.string().max(240).optional()}).strict()}).strict();
const kineticTextSceneSchema = z.object({...sceneBaseShape,type:z.literal("kineticText"),visual:z.object({text:z.string().min(1).max(180),emphasis:z.array(z.string().min(1).max(80)).max(4).optional()}).strict()}).strict();
const definitionSceneSchema = z.object({...sceneBaseShape,type:z.literal("definition"),visual:z.object({term:z.string().min(1).max(100),definition:z.string().min(1).max(360),example:z.string().max(240).optional()}).strict()}).strict();
const bigNumberSceneSchema = z.object({...sceneBaseShape,type:z.literal("bigNumber"),visual:z.object({value:z.string().min(1).max(40),label:z.string().min(1).max(140),context:z.string().max(260).optional()}).strict()}).strict();

const comparisonSideSchema=z.object({title:z.string().min(1).max(100),body:z.string().max(280).optional(),icon:z.string().max(100).optional()}).strict();
const comparisonSceneSchema=z.object({...sceneBaseShape,type:z.literal("comparison"),visual:z.object({left:comparisonSideSchema,right:comparisonSideSchema,versusLabel:z.string().max(40).optional()}).strict()}).strict();
const timelineItemSchema=z.object({label:z.string().min(1).max(60),title:z.string().min(1).max(100),description:z.string().max(220).optional()}).strict();
const timelineSceneSchema=z.object({...sceneBaseShape,type:z.literal("timeline"),visual:z.object({title:z.string().max(140).optional(),items:z.array(timelineItemSchema).min(2).max(8)}).strict()}).strict();
const processStepSchema=z.object({title:z.string().min(1).max(100),description:z.string().max(220).optional(),icon:z.string().max(100).optional()}).strict();
const processSceneSchema=z.object({...sceneBaseShape,type:z.literal("process"),visual:z.object({title:z.string().max(140).optional(),steps:z.array(processStepSchema).min(2).max(8)}).strict()}).strict();
const flowNodeSchema=z.object({id:idSchema,label:z.string().min(1).max(120),detail:z.string().max(180).optional()}).strict();
const flowEdgeSchema=z.object({from:idSchema,to:idSchema,label:z.string().max(80).optional()}).strict();
const flowchartSceneSchema=z.object({...sceneBaseShape,type:z.literal("flowchart"),visual:z.object({title:z.string().max(140).optional(),nodes:z.array(flowNodeSchema).min(2).max(12),edges:z.array(flowEdgeSchema).min(1).max(20)}).strict()}).strict();
const diagramItemSchema=z.object({label:z.string().min(1).max(100),detail:z.string().max(200).optional(),icon:z.string().max(100).optional()}).strict();
const diagramSceneSchema=z.object({...sceneBaseShape,type:z.literal("diagram"),visual:z.object({center:z.string().min(1).max(120),items:z.array(diagramItemSchema).min(2).max(8)}).strict()}).strict();
const iconSceneItemSchema=z.object({icon:z.string().min(1).max(100),label:z.string().min(1).max(100),detail:z.string().max(180).optional()}).strict();
const iconSceneSchema=z.object({...sceneBaseShape,type:z.literal("iconScene"),visual:z.object({title:z.string().max(140).optional(),items:z.array(iconSceneItemSchema).min(1).max(6)}).strict()}).strict();

const documentSceneSchema=z.object({...sceneBaseShape,type:z.literal("document"),visual:z.object({assetId:idSchema,page:z.number().int().positive().optional(),caption:z.string().max(180).optional()}).strict()}).strict();
const documentHighlightSceneSchema=z.object({...sceneBaseShape,type:z.literal("documentHighlight"),visual:z.object({assetId:idSchema,page:z.number().int().positive(),highlightText:z.string().min(1).max(500),caption:z.string().max(180).optional()}).strict()}).strict();
const imageSceneSchema=z.object({...sceneBaseShape,type:z.literal("image"),visual:z.object({assetId:idSchema,fit:z.enum(["contain","cover"]).optional(),caption:z.string().max(180).optional()}).strict()}).strict();
const videoSceneSchema=z.object({...sceneBaseShape,type:z.literal("video"),visual:z.object({assetId:idSchema,fit:z.enum(["contain","cover"]).optional(),caption:z.string().max(180).optional()}).strict()}).strict();
const questionSceneSchema=z.object({...sceneBaseShape,type:z.literal("question"),visual:z.object({question:z.string().min(1).max(220),prompt:z.string().max(160).optional()}).strict()}).strict();

export const visualGagPresetSchema=z.enum(["giantReport","absurdScale","redArrow","fakeLoading","spotlight"]);
const visualGagSceneSchema=z.object({...sceneBaseShape,type:z.literal("visualGag"),visual:z.object({preset:visualGagPresetSchema,label:z.string().max(140).optional(),punchline:z.string().max(180).optional()}).strict()}).strict();
const recapSceneSchema=z.object({...sceneBaseShape,type:z.literal("recap"),visual:z.object({title:z.string().max(140).optional(),points:z.array(z.string().min(1).max(180)).min(2).max(6)}).strict()}).strict();
const bulletRevealSceneSchema=z.object({...sceneBaseShape,type:z.literal("bulletReveal"),visual:z.object({title:z.string().max(140).optional(),points:z.array(z.string().min(1).max(180)).min(2).max(6)}).strict()}).strict();
const annotationSchema=z.object({label:z.string().min(1).max(100),x:z.number().min(0).max(100),y:z.number().min(0).max(100),targetX:z.number().min(0).max(100).optional(),targetY:z.number().min(0).max(100).optional()}).strict();
const annotatedImageSceneSchema=z.object({...sceneBaseShape,type:z.literal("annotatedImage"),visual:z.object({assetId:idSchema,fit:z.enum(["contain","cover"]).optional(),title:z.string().max(140).optional(),annotations:z.array(annotationSchema).min(1).max(8),caption:z.string().max(180).optional()}).strict()}).strict();
const chartDatumSchema=z.object({label:z.string().min(1).max(60),value:z.number().finite().min(0)}).strict();
const dataChartSceneSchema=z.object({...sceneBaseShape,type:z.literal("dataChart"),visual:z.object({title:z.string().max(140).optional(),chartType:z.enum(["bar","line","donut"]),data:z.array(chartDatumSchema).min(2).max(8),unit:z.string().max(24).optional(),sourceLabel:z.string().max(120).optional()}).strict()}).strict();
const matrixQuadrantSchema=z.object({title:z.string().min(1).max(80),detail:z.string().max(180).optional()}).strict();
const matrixSceneSchema=z.object({...sceneBaseShape,type:z.literal("matrix"),visual:z.object({title:z.string().max(140).optional(),xAxis:z.object({low:z.string().max(60),high:z.string().max(60)}).strict().optional(),yAxis:z.object({low:z.string().max(60),high:z.string().max(60)}).strict().optional(),quadrants:z.object({topLeft:matrixQuadrantSchema,topRight:matrixQuadrantSchema,bottomLeft:matrixQuadrantSchema,bottomRight:matrixQuadrantSchema}).strict()}).strict()}).strict();
const cycleStepSchema=z.object({title:z.string().min(1).max(80),detail:z.string().max(160).optional(),icon:z.string().max(100).optional()}).strict();
const cycleSceneSchema=z.object({...sceneBaseShape,type:z.literal("cycle"),visual:z.object({title:z.string().max(140).optional(),center:z.string().max(100).optional(),steps:z.array(cycleStepSchema).min(3).max(8)}).strict()}).strict();
const multipleChoiceOptionSchema=z.object({label:z.string().min(1).max(140),explanation:z.string().max(180).optional()}).strict();
const multipleChoiceSceneSchema=z.object({...sceneBaseShape,type:z.literal("multipleChoice"),visual:z.object({question:z.string().min(1).max(220),options:z.array(multipleChoiceOptionSchema).min(2).max(5),correctIndex:z.number().int().min(0).max(4),revealAfterSeconds:z.number().min(0).max(30).optional()}).strict()}).strict();
const workedExampleStepSchema=z.object({label:z.string().max(60).optional(),title:z.string().min(1).max(100),body:z.string().min(1).max(260)}).strict();
const workedExampleSceneSchema=z.object({...sceneBaseShape,type:z.literal("workedExample"),visual:z.object({title:z.string().max(140).optional(),problem:z.string().min(1).max(260),steps:z.array(workedExampleStepSchema).min(1).max(5),result:z.string().max(220).optional()}).strict()}).strict();
const hierarchyLevelSchema=z.object({label:z.string().min(1).max(100),detail:z.string().max(180).optional()}).strict();
const hierarchySceneSchema=z.object({...sceneBaseShape,type:z.literal("hierarchy"),visual:z.object({title:z.string().max(140).optional(),direction:z.enum(["topDown","bottomUp"]).optional(),levels:z.array(hierarchyLevelSchema).min(2).max(6)}).strict()}).strict();
const quoteSceneSchema=z.object({...sceneBaseShape,type:z.literal("quote"),visual:z.object({quote:z.string().min(1).max(700),author:z.string().max(120).optional(),work:z.string().max(180).optional(),locator:z.string().max(100).optional(),context:z.string().max(220).optional()}).strict()}).strict();

export const studyTubeSceneSchema=z.discriminatedUnion("type",[
  titleSceneSchema,chapterIntroSceneSchema,kineticTextSceneSchema,definitionSceneSchema,bigNumberSceneSchema,comparisonSceneSchema,timelineSceneSchema,processSceneSchema,flowchartSceneSchema,diagramSceneSchema,iconSceneSchema,documentSceneSchema,documentHighlightSceneSchema,imageSceneSchema,videoSceneSchema,questionSceneSchema,visualGagSceneSchema,recapSceneSchema,bulletRevealSceneSchema,annotatedImageSceneSchema,dataChartSceneSchema,matrixSceneSchema,cycleSceneSchema,multipleChoiceSceneSchema,workedExampleSceneSchema,hierarchySceneSchema,quoteSceneSchema,
]);

export const stockProviderSchema=z.enum(["pixabay","pexels","unsplash"]);
const stockImageProviderPreferenceSchema=z.enum(["auto","pixabay","pexels","unsplash"]);
const stockVideoProviderPreferenceSchema=z.enum(["auto","pixabay","pexels"]);
const stockSourceSchema=z.object({provider:stockProviderSchema,providerId:z.string().min(1).max(160),query:z.string().min(1).max(240).optional(),creator:z.string().max(160).optional(),creatorUrl:z.string().url().optional(),sourceUrl:z.string().url().optional(),attributionText:z.string().max(300).optional(),licenseLabel:z.string().max(120).optional()}).strict();

const imageAssetSchema=z.object({type:z.literal("image"),path:z.string().min(1).max(500),alt:z.string().max(300).optional(),source:stockSourceSchema.optional()}).strict();
const videoAssetSchema=z.object({type:z.literal("video"),path:z.string().min(1).max(500),alt:z.string().max(300).optional(),source:stockSourceSchema.optional()}).strict();
const documentAssetSchema=z.object({type:z.literal("document"),path:z.string().min(1).max(500),title:z.string().max(200).optional()}).strict();
const stockImageAssetSchema=z.object({type:z.literal("stockImage"),path:z.literal("").default(""),query:z.string().min(1).max(240),provider:stockImageProviderPreferenceSchema.optional(),alt:z.string().max(300).optional()}).strict();
const stockVideoAssetSchema=z.object({type:z.literal("stockVideo"),path:z.literal("").default(""),query:z.string().min(1).max(240),provider:stockVideoProviderPreferenceSchema.optional(),alt:z.string().max(300).optional()}).strict();

export const studyTubeAssetSchema=z.discriminatedUnion("type",[imageAssetSchema,videoAssetSchema,documentAssetSchema,stockImageAssetSchema,stockVideoAssetSchema]);

const chapterSchema=z.object({id:idSchema,title:z.string().min(1).max(160),scenes:z.array(studyTubeSceneSchema).min(1)}).strict();
const metadataSchema=z.object({title:z.string().min(1).max(200),language:z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/,"Use a language tag such as nl-NL"),targetDuration:z.number().int().min(30).max(7200),style:z.enum(["educational-explainer","midnight-focus"]),description:z.string().max(600).optional()}).strict();

export const studyTubeProjectSchema=z.object({version:z.literal(STUDYTUBE_SCHEMA_VERSION),metadata:metadataSchema,assets:z.record(idSchema,studyTubeAssetSchema).optional(),chapters:z.array(chapterSchema).min(1).max(40)}).strict().superRefine((project,context)=>{
  const chapterIds=new Set<string>();const sceneIds=new Set<string>();const assets=project.assets??{};
  project.chapters.forEach((chapter,chapterIndex)=>{
    if(chapterIds.has(chapter.id))context.addIssue({code:"custom",path:["chapters",chapterIndex,"id"],message:`Duplicate chapter id: ${chapter.id}`});
    chapterIds.add(chapter.id);
    chapter.scenes.forEach((scene,sceneIndex)=>{
      if(sceneIds.has(scene.id))context.addIssue({code:"custom",path:["chapters",chapterIndex,"scenes",sceneIndex,"id"],message:`Duplicate scene id: ${scene.id}`});
      sceneIds.add(scene.id);
      if(scene.type==="flowchart"){
        const nodeIds=new Set(scene.visual.nodes.map((node)=>node.id));
        scene.visual.edges.forEach((edge,edgeIndex)=>{
          if(!nodeIds.has(edge.from))context.addIssue({code:"custom",path:["chapters",chapterIndex,"scenes",sceneIndex,"visual","edges",edgeIndex,"from"],message:`Unknown flowchart node: ${edge.from}`});
          if(!nodeIds.has(edge.to))context.addIssue({code:"custom",path:["chapters",chapterIndex,"scenes",sceneIndex,"visual","edges",edgeIndex,"to"],message:`Unknown flowchart node: ${edge.to}`});
        });
      }
      if(scene.type==="multipleChoice"&&scene.visual.correctIndex>=scene.visual.options.length)context.addIssue({code:"custom",path:["chapters",chapterIndex,"scenes",sceneIndex,"visual","correctIndex"],message:"correctIndex must reference an existing option"});
      if(scene.type==="image"||scene.type==="annotatedImage"||scene.type==="video"||scene.type==="document"||scene.type==="documentHighlight"){
        const asset=assets[scene.visual.assetId];
        if(!asset){context.addIssue({code:"custom",path:["chapters",chapterIndex,"scenes",sceneIndex,"visual","assetId"],message:`Unknown asset: ${scene.visual.assetId}`});return;}
        if(scene.type==="image"||scene.type==="annotatedImage"){
          if(asset.type!=="image"&&asset.type!=="stockImage")context.addIssue({code:"custom",path:["chapters",chapterIndex,"scenes",sceneIndex,"visual","assetId"],message:`Scene ${scene.type} requires an image or stockImage asset`});
          return;
        }
        if(scene.type==="video"){
          if(asset.type!=="video"&&asset.type!=="stockVideo")context.addIssue({code:"custom",path:["chapters",chapterIndex,"scenes",sceneIndex,"visual","assetId"],message:"Scene video requires a video or stockVideo asset"});
          return;
        }
        if(asset.type!=="document")context.addIssue({code:"custom",path:["chapters",chapterIndex,"scenes",sceneIndex,"visual","assetId"],message:`Scene ${scene.type} requires a document asset`});
      }
    });
  });
});

export type MotionIntent=z.infer<typeof motionIntentSchema>;
export type StockProvider=z.infer<typeof stockProviderSchema>;
export type StudyTubeAsset=z.infer<typeof studyTubeAssetSchema>;
export type StudyTubeScene=z.infer<typeof studyTubeSceneSchema>;
export type StudyTubeProject=z.infer<typeof studyTubeProjectSchema>;
export type StudyTubeValidationIssue={path:string;message:string};

export class StudyTubeValidationError extends Error{
  readonly issues:StudyTubeValidationIssue[];
  constructor(issues:StudyTubeValidationIssue[]){super("The StudyTube project is invalid");this.name="StudyTubeValidationError";this.issues=issues;}
}

const formatPath=(path:PropertyKey[]):string=>{
  if(path.length===0)return "$";
  return path.reduce<string>((result,segment)=>typeof segment==="number"?`${result}[${segment}]`:result==="$"?`$.${String(segment)}`:`${result}.${String(segment)}`,"$");
};
export const formatStudyTubeValidationIssues=(error:z.ZodError):StudyTubeValidationIssue[]=>error.issues.map((issue)=>({path:formatPath(issue.path),message:issue.message}));
export const safeParseStudyTubeProject=(input:unknown)=>studyTubeProjectSchema.safeParse(input);
export const parseStudyTubeProject=(input:unknown):StudyTubeProject=>{const result=safeParseStudyTubeProject(input);if(!result.success)throw new StudyTubeValidationError(formatStudyTubeValidationIssues(result.error));return result.data;};
export const parseStudyTubeJson=(json:string):StudyTubeProject=>{let input:unknown;try{input=JSON.parse(json);}catch(error){const message=error instanceof Error?error.message:"Invalid JSON";throw new StudyTubeValidationError([{path:"$",message}]);}return parseStudyTubeProject(input);};
