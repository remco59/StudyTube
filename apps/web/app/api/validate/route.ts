import {parseStudyTubeProject,type StudyTubeProject,StudyTubeValidationError} from "@studytube/schema";
import {findLatestCompletedJobByTitle,readJobProjectFile} from "@/lib/jobs";
import {diffStudyTubeProjects,type ProjectDiffSummary} from "@/lib/projectDiff";
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
    const summary=await summarizeProjectPackage(parsed);
    const diff=await diffAgainstLastRender(parsed.project.metadata.title,parsed.project);
    return Response.json(diff?{...summary,diff}:summary);
  }catch(error){
    if(error instanceof StudyTubeValidationError)return Response.json({valid:false,issues:error.issues},{status:422});
    if(error instanceof StudyTubePackageError)return Response.json({valid:false,issues:[{path:"",message:error.message}]},{status:error.status});
    return Response.json({valid:false,issues:[{path:"",message:error instanceof Error?error.message:"Invalid StudyTube project"}]},{status:400});
  }
}

const diffAgainstLastRender=async(title:string,current:StudyTubeProject):Promise<(ProjectDiffSummary&{previousJobId:string;previousRenderedAt:string})|null>=>{
  try{
    const previousJob=await findLatestCompletedJobByTitle(title);
    if(!previousJob)return null;
    const previousProject=parseStudyTubeProject(JSON.parse(await readJobProjectFile(previousJob.jobId)));
    return {...diffStudyTubeProjects(current,previousProject),previousJobId:previousJob.jobId,previousRenderedAt:previousJob.updatedAt};
  }catch(error){
    console.error(`StudyTube validate: could not diff against a previous render of "${title}"`,error);
    return null;
  }
};
