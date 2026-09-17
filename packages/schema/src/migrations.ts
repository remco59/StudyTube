export type StudyTubeVersionedProject=Record<string,unknown>&{version:string};

export type StudyTubeVersionParser=(input:unknown)=>StudyTubeVersionedProject;

export type StudyTubeProjectMigration={
  from:string;
  to:string;
  migrate:(project:StudyTubeVersionedProject)=>StudyTubeVersionedProject;
};

export type StudyTubeMigrationPlan={
  targetVersion:string;
  parsers:Readonly<Record<string,StudyTubeVersionParser>>;
  migrations:readonly StudyTubeProjectMigration[];
};

export class StudyTubeMigrationError extends Error{
  constructor(message:string){super(message);this.name="StudyTubeMigrationError";}
}

export const getStudyTubeProjectVersion=(input:unknown):string|undefined=>{
  if(!input||typeof input!=="object"||Array.isArray(input))return undefined;
  const version=(input as Record<string,unknown>).version;
  return typeof version==="string"&&version.trim()?version:undefined;
};

export const parseStudyTubeProjectVersion=(input:unknown,parsers:StudyTubeMigrationPlan["parsers"]):StudyTubeVersionedProject=>{
  const version=getStudyTubeProjectVersion(input);
  if(!version)throw new StudyTubeMigrationError("StudyTube project is missing a schema version");
  const parser=parsers[version];
  if(!parser)throw new StudyTubeMigrationError(`Unsupported StudyTube schema version: ${version}`);
  const parsed=parser(input);
  if(parsed.version!==version)throw new StudyTubeMigrationError(`Parser for StudyTube schema ${version} returned version ${parsed.version}`);
  return parsed;
};

export const upgradeStudyTubeProject=(input:unknown,plan:StudyTubeMigrationPlan):StudyTubeVersionedProject=>{
  if(!plan.targetVersion.trim())throw new StudyTubeMigrationError("Target StudyTube schema version is required");
  let project=parseStudyTubeProjectVersion(input,plan.parsers);
  const visited=new Set<string>();

  while(project.version!==plan.targetVersion){
    if(visited.has(project.version))throw new StudyTubeMigrationError(`StudyTube schema migration cycle detected at version ${project.version}`);
    visited.add(project.version);
    const migration=plan.migrations.find((candidate)=>candidate.from===project.version);
    if(!migration)throw new StudyTubeMigrationError(`No StudyTube schema migration path from ${project.version} to ${plan.targetVersion}`);
    const migrated=migration.migrate(project);
    if(getStudyTubeProjectVersion(migrated)!==migration.to){
      throw new StudyTubeMigrationError(`Migration ${migration.from} -> ${migration.to} did not return version ${migration.to}`);
    }
    project=parseStudyTubeProjectVersion(migrated,plan.parsers);
  }

  return project;
};
