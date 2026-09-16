"use client";

import type {PromptAssetAmount,PromptAssetType} from "../lib/chatgptPrompt";

type Props={
  enabled:boolean;
  assetTypes:PromptAssetType[];
  amount:PromptAssetAmount;
  onEnabledChange:(enabled:boolean)=>void;
  onAssetTypesChange:(assetTypes:PromptAssetType[])=>void;
  onAmountChange:(amount:PromptAssetAmount)=>void;
};

const assetTypeChoices:{id:PromptAssetType;label:string;detail:string}[]=[
  {id:"web-images",label:"Web images",detail:"Find reusable images online"},
  {id:"generated-images",label:"Generated images",detail:"Create purpose-built visuals"},
  {id:"source-documents",label:"Source documents",detail:"Use pages from supplied files"},
];

const amountChoices:{id:PromptAssetAmount;label:string}[]=[
  {id:"few",label:"A few"},
  {id:"some",label:"Some"},
  {id:"many",label:"Many"},
  {id:"lots",label:"A lot"},
];

export const PromptAssetSettings=({enabled,assetTypes,amount,onEnabledChange,onAssetTypesChange,onAmountChange}:Props)=>{
  const toggleAssetType=(type:PromptAssetType)=>{
    if(assetTypes.includes(type)){
      if(assetTypes.length===1)return;
      onAssetTypesChange(assetTypes.filter((item)=>item!==type));
      return;
    }
    onAssetTypesChange([...assetTypes,type]);
  };

  return <div className={`assetPromptBlock${enabled?" enabled":""}`}>
    <button type="button" className="assetToggleButton" aria-pressed={enabled} onClick={()=>onEnabledChange(!enabled)}>
      <span className="assetToggleIndicator" aria-hidden="true"><span/></span>
      <span className="assetToggleCopy"><strong>Use assets</strong><small>Package images or documents in a .studytube.zip project.</small></span>
    </button>

    {enabled?<div className="assetPromptControls">
      <div className="assetPromptSection">
        <div className="assetPromptLabel"><strong>Asset types</strong><span>Choose one or more</span></div>
        <div className="assetChoiceGrid">
          {assetTypeChoices.map((choice)=>{
            const selected=assetTypes.includes(choice.id);
            return <button type="button" key={choice.id} className={`assetTypeOption${selected?" selected":""}`} aria-pressed={selected} onClick={()=>toggleAssetType(choice.id)}>
              <span className="assetChoiceCheck">{selected?"✓":""}</span>
              <span><strong>{choice.label}</strong><small>{choice.detail}</small></span>
            </button>;
          })}
        </div>
      </div>

      <div className="assetPromptSection">
        <div className="assetPromptLabel"><strong>Amount</strong><span>Relative density, not a fixed number</span></div>
        <div className="assetAmountOptions">
          {amountChoices.map((choice)=><button type="button" key={choice.id} className={`assetAmountOption${amount===choice.id?" selected":""}`} aria-pressed={amount===choice.id} onClick={()=>onAmountChange(choice.id)}>{choice.label}</button>)}
        </div>
      </div>
    </div>:null}
  </div>;
};
