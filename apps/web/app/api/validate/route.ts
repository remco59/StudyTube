import {StudyTubeValidationError} from "@studytube/schema";
import {parseProjectPackage,StudyTubePackageError,summarizeProjectPackage} from "@/lib/projectPackage";

export const runtime="nodejs";

export async function POST(request:Request){
  try{
    const form=await request.formData();
    const projectFile=form.get("project");
    if(!(projectFile instanceof File)){
      return Response.json({valid:false,issues:[{path:"",message:"Upload a .studytube.json or .studytube.zip project file"}]},{status:400});
    }
    const parsed=await parseProjectPackage(projectFile);
    return Response.json(summarizeProjectPackage(parsed));
  }catch(error){
    if(error instanceof StudyTubeValidationError)return Response.json({valid:false,issues:error.issues},{status:422});
    if(error instanceof StudyTubePackageError)return Response.json({valid:false,issues:[{path:"",message:error.message}]},{status:error.status});
    return Response.json({valid:false,issues:[{path:"",message:error instanceof Error?error.message:"Invalid StudyTube project"}]},{status:400});
  }
}
