import {describe,expect,it} from "vitest";
import {
  StudyTubeMigrationError,
  type StudyTubeVersionParser,
  type StudyTubeVersionedProject,
  upgradeStudyTubeProject,
} from "./migrations";

const parserFor=(version:string):StudyTubeVersionParser=>(input)=>{
  if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Project must be an object");
  const project=input as StudyTubeVersionedProject;
  if(project.version!==version)throw new Error(`Expected version ${version}`);
  return project;
};

const parsers={
  "1.0":parserFor("1.0"),
  "2.0":parserFor("2.0"),
};

describe("StudyTube schema migrations",()=>{
  it("passes a current-version project through its version parser",()=>{
    const project={version:"1.0",metadata:{title:"Existing project"}};
    expect(upgradeStudyTubeProject(project,{targetVersion:"1.0",parsers,migrations:[]})).toEqual(project);
  });

  it("upgrades a v1 project through a version-keyed v1 to v2 migration without losing project data",()=>{
    const project={version:"1.0",metadata:{title:"Existing project"},chapters:[{id:"intro"}]};
    const upgraded=upgradeStudyTubeProject(project,{
      targetVersion:"2.0",
      parsers,
      migrations:[{
        from:"1.0",
        to:"2.0",
        migrate:(input)=>({...input,version:"2.0"}),
      }],
    });

    expect(upgraded).toEqual({...project,version:"2.0"});
  });

  it("fails clearly when no migration path exists",()=>{
    expect(()=>upgradeStudyTubeProject({version:"1.0"},{targetVersion:"2.0",parsers,migrations:[]}))
      .toThrow(new StudyTubeMigrationError("No StudyTube schema migration path from 1.0 to 2.0"));
  });

  it("rejects migration steps that return the wrong version",()=>{
    expect(()=>upgradeStudyTubeProject({version:"1.0"},{
      targetVersion:"2.0",
      parsers,
      migrations:[{from:"1.0",to:"2.0",migrate:(input)=>input}],
    })).toThrow("Migration 1.0 -> 2.0 did not return version 2.0");
  });
});
