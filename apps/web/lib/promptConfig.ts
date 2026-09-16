export type PromptExplanationMethod=
  |"auto"
  |"conceptual"
  |"example-driven"
  |"step-by-step"
  |"problem-solution"
  |"case-based"
  |"comparison"
  |"socratic"
  |"exam-focused";

export type PromptExplanationDepth="quick"|"balanced"|"deep";
export type PromptLearningGoal="understand"|"remember"|"apply"|"relationships"|"exam"|"evaluate"|"transfer";
export type PromptActiveRecall="off"|"low"|"medium"|"high";
export type PromptHumorLevel="off"|"light"|"playful";
export type PromptPersonalExampleMode="known-context"|"provided-context"|"ask-first";

export type PromptTeachingTechniques={
  personalExamples:boolean;
  realWorldExamples:boolean;
  analogies:boolean;
  counterExamples:boolean;
  misconceptions:boolean;
  activeRecall:PromptActiveRecall;
  humor:PromptHumorLevel;
  repeatKeyConcepts:boolean;
  connectConcepts:boolean;
  explainWhyItMatters:boolean;
  practicalApplications:boolean;
  sectionRecaps:boolean;
};

export type PromptTeachingConfig={
  method:PromptExplanationMethod;
  depth:PromptExplanationDepth;
  learningGoals:PromptLearningGoal[];
  techniques:PromptTeachingTechniques;
  personalExampleMode:PromptPersonalExampleMode;
  personalContext:string;
};

export type PromptTeachingPreset="balanced"|"deep-understanding"|"exam-prep"|"learn-by-examples"|"practical-application"|"teach-from-scratch";

export const defaultPromptTeachingConfig:PromptTeachingConfig={
  method:"auto",
  depth:"balanced",
  learningGoals:["understand","apply","remember"],
  techniques:{
    personalExamples:false,
    realWorldExamples:true,
    analogies:true,
    counterExamples:false,
    misconceptions:true,
    activeRecall:"medium",
    humor:"light",
    repeatKeyConcepts:false,
    connectConcepts:true,
    explainWhyItMatters:true,
    practicalApplications:true,
    sectionRecaps:true,
  },
  personalExampleMode:"known-context",
  personalContext:"",
};

export const teachingPresets:Record<PromptTeachingPreset,{label:string;description:string;config:PromptTeachingConfig}>={
  balanced:{
    label:"Balanced",
    description:"Clear explanations, concrete examples, metaphors, light humor and recall.",
    config:defaultPromptTeachingConfig,
  },
  "deep-understanding":{
    label:"Deep dive",
    description:"More mechanisms, relationships, nuance and misconceptions.",
    config:{
      ...defaultPromptTeachingConfig,
      method:"conceptual",
      depth:"deep",
      learningGoals:["understand","relationships","evaluate","apply"],
      techniques:{...defaultPromptTeachingConfig.techniques,counterExamples:true,repeatKeyConcepts:true,activeRecall:"medium",humor:"light"},
    },
  },
  "exam-prep":{
    label:"Exam mode",
    description:"Precise terminology, distinctions, retrieval practice and application questions.",
    config:{
      ...defaultPromptTeachingConfig,
      method:"exam-focused",
      depth:"balanced",
      learningGoals:["remember","understand","apply","exam"],
      techniques:{...defaultPromptTeachingConfig.techniques,analogies:false,counterExamples:true,activeRecall:"high",humor:"off",repeatKeyConcepts:true,sectionRecaps:true},
    },
  },
  "learn-by-examples":{
    label:"Examples first",
    description:"Lead with concrete examples and metaphors, then connect them to theory.",
    config:{
      ...defaultPromptTeachingConfig,
      method:"example-driven",
      depth:"balanced",
      learningGoals:["understand","apply","transfer"],
      techniques:{...defaultPromptTeachingConfig.techniques,realWorldExamples:true,analogies:true,counterExamples:true,activeRecall:"medium",humor:"light"},
    },
  },
  "practical-application":{
    label:"Practical",
    description:"Connect theory to decisions, workflows and real-world situations.",
    config:{
      ...defaultPromptTeachingConfig,
      method:"problem-solution",
      depth:"balanced",
      learningGoals:["apply","transfer","understand"],
      techniques:{...defaultPromptTeachingConfig.techniques,realWorldExamples:true,practicalApplications:true,explainWhyItMatters:true,activeRecall:"low",humor:"light"},
    },
  },
  "teach-from-scratch":{
    label:"Explain simply",
    description:"Build intuition step by step with examples, metaphors and a more playful tone.",
    config:{
      ...defaultPromptTeachingConfig,
      method:"step-by-step",
      depth:"balanced",
      learningGoals:["understand","remember"],
      techniques:{...defaultPromptTeachingConfig.techniques,realWorldExamples:true,analogies:true,connectConcepts:true,repeatKeyConcepts:true,activeRecall:"low",humor:"playful"},
    },
  },
};

const methodInstructions:Record<PromptExplanationMethod,string>={
  auto:"Choose the most appropriate explanation method per concept. Use definitions for terminology, step-by-step explanation for processes, examples for abstract ideas, comparisons where concepts are easily confused, and questions where retrieval practice helps.",
  conceptual:"Start from the underlying idea, mechanism or relationship. Build a mental model before moving to details and examples.",
  "example-driven":"Lead with concrete examples and infer or explain the theory from them. Move back and forth between the example and the abstract concept.",
  "step-by-step":"Break processes and reasoning into clear sequential steps. Make prerequisites and transitions explicit.",
  "problem-solution":"Frame important sections around a problem, why it matters, possible approaches and how the theory helps resolve it.",
  "case-based":"Use a coherent case or scenario across sections where possible, and connect each theoretical concept back to that case.",
  comparison:"Explain unfamiliar or confusable ideas through explicit contrasts, similarities and carefully chosen analogies.",
  socratic:"Use guiding questions to surface assumptions and lead the learner toward the concept before giving the explanation.",
  "exam-focused":"Prioritize precise definitions, distinctions between similar concepts, common traps, retrieval practice and application questions, while still explaining why the answers are correct.",
};

const depthInstructions:Record<PromptExplanationDepth,string>={
  quick:"Keep explanations compact and intuitive. Cover the essential idea, terminology and one useful example without spending much time on nuance.",
  balanced:"Give enough explanation to build understanding, then reinforce it with examples, relationships and concise recaps.",
  deep:"Go beyond definitions. Explain mechanisms, assumptions, relationships, boundary conditions and important nuances where the source supports them.",
};

const learningGoalLabels:Record<PromptLearningGoal,string>={
  understand:"understand the concepts and mental models",
  remember:"remember important terminology and distinctions",
  apply:"apply the knowledge to questions or situations",
  relationships:"recognize relationships between concepts",
  exam:"prepare for assessment or exam-style questions",
  evaluate:"critically evaluate claims, choices or approaches",
  transfer:"transfer the ideas to practical contexts",
};

const activeRecallInstructions:Record<Exclude<PromptActiveRecall,"off">,string>={
  low:"Use a small number of active-recall questions at major transitions.",
  medium:"Use active-recall questions regularly after important concepts or sections, without interrupting the flow too often.",
  high:"Use frequent active-recall and short application questions throughout the video, including some delayed retrieval of earlier concepts.",
};

const humorInstructions:Record<Exclude<PromptHumorLevel,"off">,string>={
  light:"Use occasional light humor, playful phrasing or a short joke when it naturally fits the concept. Keep jokes brief, never let them replace the explanation, and avoid forcing humor into serious or sensitive material.",
  playful:"Use a noticeably more playful YouTube-style tone with recurring light jokes, amusing comparisons or visual-gag opportunities where they help attention and memory. Keep the factual explanation primary and avoid humor in serious or sensitive material.",
};

const cloneConfig=(config:PromptTeachingConfig):PromptTeachingConfig=>({
  ...config,
  learningGoals:[...config.learningGoals],
  techniques:{...config.techniques},
});

export const applyTeachingPreset=(preset:PromptTeachingPreset):PromptTeachingConfig=>cloneConfig(teachingPresets[preset].config);

export const matchesTeachingPreset=(config:PromptTeachingConfig,preset:PromptTeachingPreset)=>{
  const presetConfig=teachingPresets[preset].config;
  return config.method===presetConfig.method
    &&config.depth===presetConfig.depth
    &&config.personalExampleMode===presetConfig.personalExampleMode
    &&config.personalContext===presetConfig.personalContext
    &&config.learningGoals.length===presetConfig.learningGoals.length
    &&config.learningGoals.every((goal,index)=>goal===presetConfig.learningGoals[index])
    &&Object.entries(presetConfig.techniques).every(([key,presetValue])=>config.techniques[key as keyof PromptTeachingTechniques]===presetValue);
};

export const buildTeachingPromptSection=(config:PromptTeachingConfig=defaultPromptTeachingConfig)=>{
  const lines:string[]=[
    "TEACHING STRATEGY",
    `- Primary explanation method: ${config.method}. ${methodInstructions[config.method]}`,
    `- Explanation depth: ${config.depth}. ${depthInstructions[config.depth]}`,
  ];

  if(config.learningGoals.length>0){
    lines.push(`- Learning emphasis: ${config.learningGoals.map((goal)=>learningGoalLabels[goal]).join("; ")}.`);
  }

  const {techniques}=config;
  if(techniques.personalExamples){
    if(config.personalExampleMode==="provided-context"){
      const context=config.personalContext.trim();
      lines.push(context
        ?`- Use personally relevant examples when useful. The learner explicitly provided this context: ${context}. Do not invent any personal details beyond this context.`
        :"- Use personal examples only if the learner provides relevant context in the chat. Do not invent personal details.");
    }else if(config.personalExampleMode==="ask-first"){
      lines.push("- Before relying on personal examples, ask the learner for one short piece of relevant context if none is already available. Do not invent personal details.");
    }else{
      lines.push("- Use personally relevant examples when useful, but only from context the learner has actually shared in the conversation or available memory. If no relevant context exists, use a neutral example instead. Never invent personal details.");
    }
  }
  if(techniques.realWorldExamples)lines.push("- Use concrete real-world examples regularly, normally at least one useful example for each major abstract concept. Keep examples concise and do not let them introduce factual claims that are not supported by the study material.");
  if(techniques.analogies)lines.push("- Use metaphors and analogies proactively for difficult or abstract ideas so the learner can form an intuitive mental picture. Prefer memorable everyday comparisons, and make clear where the comparison stops being accurate when that limitation matters.");
  if(techniques.counterExamples)lines.push("- Use counterexamples or non-examples where they help define the boundaries of a concept.");
  if(techniques.misconceptions)lines.push("- Surface likely misconceptions or easily confused concepts and explicitly correct them using the supplied material.");
  if(techniques.activeRecall!=="off")lines.push(`- ${activeRecallInstructions[techniques.activeRecall]}`);
  if(techniques.humor!=="off")lines.push(`- ${humorInstructions[techniques.humor]}`);
  if(techniques.repeatKeyConcepts)lines.push("- Revisit the most important concepts later in the video using different wording or a new application instead of merely repeating the same sentence.");
  if(techniques.connectConcepts)lines.push("- Explicitly connect new concepts to earlier concepts when a meaningful relationship exists.");
  if(techniques.explainWhyItMatters)lines.push("- Explain why important concepts matter for understanding the subject, making decisions or solving problems.");
  if(techniques.practicalApplications)lines.push("- Show practical applications where the source supports them, and distinguish source-backed applications from illustrative examples.");
  if(techniques.sectionRecaps)lines.push("- End substantial sections with a short synthesis of the key idea rather than a verbatim repetition of previous narration.");

  return lines.join("\n");
};

export const summarizeTeachingConfig=(config:PromptTeachingConfig)=>{
  const method=config.method==="auto"?"adaptive explanation":config.method.split("-").join(" ");
  const parts=[`${config.depth} depth`,method];
  if(config.techniques.realWorldExamples)parts.push("examples");
  if(config.techniques.analogies)parts.push("metaphors");
  if(config.techniques.humor!=="off")parts.push(`${config.techniques.humor} humor`);
  if(config.techniques.personalExamples)parts.push("personal examples when relevant");
  if(config.techniques.activeRecall!=="off")parts.push(`${config.techniques.activeRecall} active recall`);
  return parts.join(" · ");
};
