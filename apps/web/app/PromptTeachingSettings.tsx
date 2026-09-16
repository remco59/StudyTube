"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {
  applyTeachingPreset,
  matchesTeachingPreset,
  summarizeTeachingConfig,
  teachingPresets,
  type PromptActiveRecall,
  type PromptExplanationDepth,
  type PromptExplanationMethod,
  type PromptHumorLevel,
  type PromptLearningGoal,
  type PromptPersonalExampleMode,
  type PromptTeachingConfig,
  type PromptTeachingPreset,
} from "../lib/promptConfig";

type Props={
  value:PromptTeachingConfig;
  onChange:(value:PromptTeachingConfig)=>void;
};

const methodChoices:{id:PromptExplanationMethod;label:string;detail:string}[]=[
  {id:"auto",label:"Auto",detail:"Choose the best method per concept"},
  {id:"conceptual",label:"Conceptual",detail:"Build the mental model first"},
  {id:"example-driven",label:"Example-driven",detail:"Start concrete, then explain theory"},
  {id:"step-by-step",label:"Step-by-step",detail:"Break reasoning into clear stages"},
  {id:"problem-solution",label:"Problem → solution",detail:"Explain through problems and approaches"},
  {id:"case-based",label:"Case-based",detail:"Follow one coherent case or scenario"},
  {id:"comparison",label:"Comparison",detail:"Teach through contrasts and similarities"},
  {id:"socratic",label:"Socratic",detail:"Guide with questions before answers"},
  {id:"exam-focused",label:"Exam-focused",detail:"Definitions, distinctions and application"},
];

const depthChoices:{id:PromptExplanationDepth;label:string;detail:string}[]=[
  {id:"quick",label:"Quick",detail:"Essential idea + one useful example"},
  {id:"balanced",label:"Balanced",detail:"Understanding, examples and reinforcement"},
  {id:"deep",label:"Deep",detail:"Mechanisms, nuance and relationships"},
];

const learningGoalChoices:{id:PromptLearningGoal;label:string}[]=[
  {id:"understand",label:"Understand concepts"},
  {id:"remember",label:"Remember terminology"},
  {id:"apply",label:"Apply knowledge"},
  {id:"relationships",label:"Recognize relationships"},
  {id:"exam",label:"Prepare for exam"},
  {id:"evaluate",label:"Critically evaluate"},
  {id:"transfer",label:"Transfer to practice"},
];

const techniqueChoices:{key:Exclude<keyof PromptTeachingConfig["techniques"],"activeRecall"|"humor"|"realWorldExamples"|"analogies">;label:string;detail:string}[]=[
  {key:"personalExamples",label:"Personal examples",detail:"Use relevant context you have actually shared"},
  {key:"counterExamples",label:"Counterexamples",detail:"Show what a concept is not"},
  {key:"misconceptions",label:"Common misconceptions",detail:"Correct likely confusion explicitly"},
  {key:"repeatKeyConcepts",label:"Spaced reinforcement",detail:"Revisit key ideas later in a new way"},
  {key:"connectConcepts",label:"Connect concepts",detail:"Link new ideas to earlier ones"},
  {key:"explainWhyItMatters",label:"Explain why it matters",detail:"Make relevance and consequences clear"},
  {key:"practicalApplications",label:"Practical applications",detail:"Connect theory to practice"},
  {key:"sectionRecaps",label:"Section recaps",detail:"Synthesize the key idea after sections"},
];

const recallChoices:{id:PromptActiveRecall;label:string}[]=[
  {id:"off",label:"Off"},
  {id:"low",label:"Low"},
  {id:"medium",label:"Medium"},
  {id:"high",label:"High"},
];

const humorChoices:{id:PromptHumorLevel;label:string}[]=[
  {id:"off",label:"Off"},
  {id:"light",label:"Light"},
  {id:"playful",label:"Playful"},
];

const personalModes:{id:PromptPersonalExampleMode;label:string;detail:string}[]=[
  {id:"known-context",label:"Use known context",detail:"Use relevant chat or memory context when available"},
  {id:"provided-context",label:"Only context I provide",detail:"Limit personalization to the text below"},
  {id:"ask-first",label:"Ask me first",detail:"Request context before relying on personal examples"},
];

export const PromptTeachingSettings=({value,onChange}:Props)=>{
  const [open,setOpen]=useState(false);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);

  const closeModal=useCallback(()=>{
    setOpen(false);
    window.requestAnimationFrame(()=>triggerRef.current?.focus());
  },[]);

  useEffect(()=>{
    if(!open)return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    closeRef.current?.focus();
    const handleKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape")closeModal();
    };
    window.addEventListener("keydown",handleKeyDown);
    return()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener("keydown",handleKeyDown);
    };
  },[closeModal,open]);

  const setTechnique=(key:Exclude<keyof PromptTeachingConfig["techniques"],"activeRecall"|"humor">,enabled:boolean)=>{
    onChange({...value,techniques:{...value.techniques,[key]:enabled}});
  };

  const toggleLearningGoal=(goal:PromptLearningGoal)=>{
    const selected=value.learningGoals.includes(goal);
    if(selected&&value.learningGoals.length===1)return;
    onChange({...value,learningGoals:selected?value.learningGoals.filter((item)=>item!==goal):[...value.learningGoals,goal]});
  };

  const applyPreset=(preset:PromptTeachingPreset)=>onChange(applyTeachingPreset(preset));
  const summary=summarizeTeachingConfig(value);

  return <>
    <button
      ref={triggerRef}
      type="button"
      className="teachingStrategyButton"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={()=>setOpen(true)}
    >
      <span className="teachingStrategyButtonCopy">
        <strong>Teaching mode</strong>
        <small>{summary}</small>
      </span>
      <span className="teachingStrategyButtonAction">Customize</span>
    </button>

    {open?<div className="teachingStrategyModalBackdrop" onMouseDown={closeModal}>
      <section
        className="teachingStrategyModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="teaching-strategy-title"
        aria-describedby="teaching-strategy-description"
        onMouseDown={(event)=>event.stopPropagation()}
      >
        <header className="teachingStrategyModalHeader">
          <div>
            <p className="eyebrow">Teaching mode</p>
            <h2 id="teaching-strategy-title">How should StudyTube teach this?</h2>
            <p id="teaching-strategy-description">Pick a preset, then optionally adjust examples, metaphors and humor. Everything else lives under Advanced.</p>
          </div>
          <button ref={closeRef} type="button" className="teachingStrategyModalClose" aria-label="Close teaching mode" onClick={closeModal}>×</button>
        </header>

        <div className="teachingStrategyModalBody">
          <div className="teachingPromptBlock">
            <div className="teachingPromptSection teachingPromptSectionFirst">
              <div className="assetPromptLabel"><strong>Teaching preset</strong><span>One click changes the overall teaching style</span></div>
              <div className="teachingPresetGrid">
                {(Object.keys(teachingPresets) as PromptTeachingPreset[]).map((id)=>{
                  const preset=teachingPresets[id];
                  const selected=matchesTeachingPreset(value,id);
                  return <button type="button" key={id} className={`teachingPresetOption${selected?" selected":""}`} aria-pressed={selected} onClick={()=>applyPreset(id)}>
                    <strong>{preset.label}</strong><small>{preset.description}</small>
                  </button>;
                })}
              </div>
            </div>

            <div className="teachingPromptSection">
              <div className="assetPromptLabel"><strong>Quick style controls</strong><span>The settings most likely to change the feel of the video</span></div>
              <div className="teachingQuickGrid">
                <button type="button" className={`teachingQuickToggle${value.techniques.realWorldExamples?" selected":""}`} aria-pressed={value.techniques.realWorldExamples} onClick={()=>setTechnique("realWorldExamples",!value.techniques.realWorldExamples)}>
                  <span className="assetChoiceCheck">{value.techniques.realWorldExamples?"✓":""}</span>
                  <span><strong>More examples</strong><small>Explain abstract ideas through concrete situations</small></span>
                </button>
                <button type="button" className={`teachingQuickToggle${value.techniques.analogies?" selected":""}`} aria-pressed={value.techniques.analogies} onClick={()=>setTechnique("analogies",!value.techniques.analogies)}>
                  <span className="assetChoiceCheck">{value.techniques.analogies?"✓":""}</span>
                  <span><strong>Metaphors</strong><small>Use memorable comparisons to build intuition</small></span>
                </button>
                <div className="teachingHumorCard">
                  <span><strong>Humor</strong><small>Keep the explanation human without turning it into a comedy sketch</small></span>
                  <div className="teachingHumorOptions">
                    {humorChoices.map((choice)=><button type="button" key={choice.id} className={value.techniques.humor===choice.id?"selected":""} aria-pressed={value.techniques.humor===choice.id} onClick={()=>onChange({...value,techniques:{...value.techniques,humor:choice.id}})}>{choice.label}</button>)}
                  </div>
                </div>
              </div>
            </div>

            <details className="teachingAdvanced">
              <summary><span><strong>Advanced settings</strong><small>Explanation method, depth, learning goals, recall and detailed teaching techniques</small></span><span className="teachingAdvancedChevron" aria-hidden="true">⌄</span></summary>
              <div className="teachingAdvancedBody">
                <div className="teachingPromptSection teachingPromptSectionFirst">
                  <div className="assetPromptLabel"><strong>Explanation method</strong><span>Auto can vary method per concept</span></div>
                  <div className="teachingMethodGrid">
                    {methodChoices.map((choice)=><button type="button" key={choice.id} className={`teachingMethodOption${value.method===choice.id?" selected":""}`} aria-pressed={value.method===choice.id} onClick={()=>onChange({...value,method:choice.id})}>
                      <strong>{choice.label}</strong><small>{choice.detail}</small>
                    </button>)}
                  </div>
                </div>

                <div className="teachingPromptSection">
                  <div className="assetPromptLabel"><strong>Explanation depth</strong><span>Independent from academic level</span></div>
                  <div className="teachingDepthOptions">
                    {depthChoices.map((choice)=><button type="button" key={choice.id} className={`teachingDepthOption${value.depth===choice.id?" selected":""}`} aria-pressed={value.depth===choice.id} onClick={()=>onChange({...value,depth:choice.id})}>
                      <strong>{choice.label}</strong><small>{choice.detail}</small>
                    </button>)}
                  </div>
                </div>

                <div className="teachingPromptSection">
                  <div className="assetPromptLabel"><strong>Learning emphasis</strong><span>Choose one or more</span></div>
                  <div className="teachingGoalGrid">
                    {learningGoalChoices.map((choice)=>{
                      const selected=value.learningGoals.includes(choice.id);
                      return <button type="button" key={choice.id} className={`teachingGoalOption${selected?" selected":""}`} aria-pressed={selected} onClick={()=>toggleLearningGoal(choice.id)}>
                        <span>{selected?"✓":""}</span>{choice.label}
                      </button>;
                    })}
                  </div>
                </div>

                <div className="teachingPromptSection">
                  <div className="assetPromptLabel"><strong>Teaching techniques</strong><span>Fine-tune the preset</span></div>
                  <div className="teachingTechniqueGrid">
                    {techniqueChoices.map((choice)=>{
                      const selected=value.techniques[choice.key];
                      return <button type="button" key={choice.key} className={`teachingTechniqueOption${selected?" selected":""}`} aria-pressed={selected} onClick={()=>setTechnique(choice.key,!selected)}>
                        <span className="assetChoiceCheck">{selected?"✓":""}</span>
                        <span><strong>{choice.label}</strong><small>{choice.detail}</small></span>
                      </button>;
                    })}
                  </div>
                </div>

                <div className="teachingPromptSection">
                  <div className="assetPromptLabel"><strong>Active recall</strong><span>How often the video should ask the learner to retrieve or apply knowledge</span></div>
                  <div className="assetAmountOptions">
                    {recallChoices.map((choice)=><button type="button" key={choice.id} className={`assetAmountOption${value.techniques.activeRecall===choice.id?" selected":""}`} aria-pressed={value.techniques.activeRecall===choice.id} onClick={()=>onChange({...value,techniques:{...value.techniques,activeRecall:choice.id}})}>{choice.label}</button>)}
                  </div>
                </div>

                {value.techniques.personalExamples?<div className="teachingPromptSection personalExampleSettings">
                  <div className="assetPromptLabel"><strong>Personal examples</strong><span>Never invent learner details</span></div>
                  <div className="personalModeGrid">
                    {personalModes.map((choice)=><button type="button" key={choice.id} className={`personalModeOption${value.personalExampleMode===choice.id?" selected":""}`} aria-pressed={value.personalExampleMode===choice.id} onClick={()=>onChange({...value,personalExampleMode:choice.id})}>
                      <strong>{choice.label}</strong><small>{choice.detail}</small>
                    </button>)}
                  </div>
                  {value.personalExampleMode==="provided-context"?<label className="personalContextField"><span>Personal example context <em>optional</em></span><textarea rows={2} value={value.personalContext} onChange={(event)=>onChange({...value,personalContext:event.target.value})} placeholder="e.g. I race bicycles and work in media production"/></label>:null}
                </div>:null}
              </div>
            </details>
          </div>
        </div>

        <footer className="teachingStrategyModalFooter">
          <div className="teachingPromptSummary"><strong>Prompt behavior</strong><span>{summary}</span></div>
          <button type="button" className="teachingStrategyDoneButton" onClick={closeModal}>Done</button>
        </footer>
      </section>
    </div>:null}
  </>;
};
