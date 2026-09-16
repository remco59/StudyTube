export type ImageFit="contain"|"cover";

export type Size={
  width:number;
  height:number;
};

export type Rect=Size&{
  left:number;
  top:number;
};

export type Point={
  x:number;
  y:number;
};

const isUsableSize=(size:Size|null|undefined)=>Boolean(size&&Number.isFinite(size.width)&&Number.isFinite(size.height)&&size.width>0&&size.height>0);

export const fittedImageRect=(container:Size,image:Size|null|undefined,fit:ImageFit):Rect=>{
  if(!isUsableSize(container)||!isUsableSize(image))return {left:0,top:0,width:Math.max(0,container.width),height:Math.max(0,container.height)};

  const scale=fit==="cover"
    ?Math.max(container.width/image!.width,container.height/image!.height)
    :Math.min(container.width/image!.width,container.height/image!.height);
  const width=image!.width*scale;
  const height=image!.height*scale;

  return {
    left:(container.width-width)/2,
    top:(container.height-height)/2,
    width,
    height,
  };
};

export const percentPointInRect=(rect:Rect,x:number,y:number):Point=>({
  x:rect.left+rect.width*(x/100),
  y:rect.top+rect.height*(y/100),
});

export const percentPointInSize=(size:Size,x:number,y:number):Point=>({
  x:size.width*(x/100),
  y:size.height*(y/100),
});
