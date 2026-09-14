import {parseStudyTubeProject,StudyTubeValidationError} from "@studytube/schema";

export const runtime="nodejs";

export async function POST(request:Request){
  try{
    const body=await request.json() as {text?:unknown};
    if(typeof body.text!=="string") return Response.json({valid:false,issues:[{path:"",message:"Missing project JSON text"}]},{status:400});
    const project=parseStudyTubeProject(JSON.parse(body.text));
    const scenes=project.chapters.flatMap((chapter)=>chapter.scenes);
    const assets=Object.entries(project.assets??{}).map(([id,asset])=>({id,type:asset.type,path:asset.path,fileName:asset.path.split("/").at(-1)??asset.path}));
    return Response.json({valid:true,summary:{title:project.metadata.title,language:project.metadata.language,targetDuration:project.metadata.targetDuration,chapters:project.chapters.length,scenes:scenes.length,assets:assets.length},assets});
  }catch(error){
    if(error instanceof StudyTubeValidationError) return Response.json({valid:false,issues:error.issues},{status:422});
    return Response.json({valid:false,issues:[{path:"",message:error instanceof Error?error.message:"Invalid JSON"}]},{status:400});
  }
}
