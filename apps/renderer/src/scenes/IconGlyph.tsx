import type {ReactNode} from "react";

const aliases:Record<string,string>={
  questionnaire:"form",clipboard:"form",list:"form",survey:"form",
  microphone:"mic",interview:"mic",audio:"mic",
  group:"users",people:"users","focus-group":"users",participants:"users",
  observation:"eye",observe:"eye",view:"eye",
  document:"file",documents:"file",paper:"file",
  magnifier:"search",find:"search",
  reading:"book",literature:"book",
  idea:"lightbulb",insight:"lightbulb",
  graph:"chart",analytics:"chart",statistics:"chart",
  time:"clock",duration:"clock",
  goal:"target",aim:"target",
  success:"check",done:"check",
  settings:"gear",process:"gear",
  computer:"laptop",technology:"laptop",
  mobile:"phone",smartphone:"phone",
  data:"database",storage:"database",
  world:"globe",web:"globe",
  secure:"lock",security:"lock",
  person:"user",participant:"user",
  date:"calendar",schedule:"calendar",
  chat:"message",comment:"message",
  photo:"image",picture:"image",
  play:"video",movie:"video",
  headphones:"headphones",listening:"headphones",
  experiment:"flask",research:"flask",science:"flask",
  stack:"layers",layer:"layers",
  favorite:"star",favourite:"star",
  location:"map-pin",pin:"map-pin",
  programming:"code",developer:"code",
  external:"link",url:"link",
  next:"arrow-right",arrow:"arrow-right",
};

const normalize=(value:string)=>value.trim().toLowerCase().replace(/[\s_]+/g,"-");

const canonical=(value:string)=>{
  const normalized=normalize(value);
  return aliases[normalized]??normalized;
};

const isTextGlyph=(value:string)=>{
  const trimmed=value.trim();
  if(!trimmed) return false;
  return !/^[a-z][a-z0-9 _-]*$/i.test(trimmed);
};

const iconContents=(name:string):ReactNode=>{
  switch(name){
    case "form": return <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>;
    case "mic": return <><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></>;
    case "users": return <><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 16.5a4.5 4.5 0 0 1 6.5 3.5"/></>;
    case "eye": return <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>;
    case "file": return <><path d="M6 2.5h8l4 4V21H6Z"/><path d="M14 2.5v4h4M9 11h6M9 15h6"/></>;
    case "search": return <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></>;
    case "book": return <><path d="M3 5.5A3.5 3.5 0 0 1 6.5 4H11v15H6.5A3.5 3.5 0 0 0 3 20.5ZM21 5.5A3.5 3.5 0 0 0 17.5 4H13v15h4.5a3.5 3.5 0 0 1 3.5 1.5Z"/></>;
    case "lightbulb": return <><path d="M8.5 15.5a6 6 0 1 1 7 0c-1 .8-1.5 1.5-1.5 2.5h-4c0-1-.5-1.7-1.5-2.5Z"/><path d="M10 21h4M10 18h4"/></>;
    case "chart": return <><path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M3 20h18"/></>;
    case "clock": return <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>;
    case "target": return <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></>;
    case "check": return <path d="m5 12 4 4 10-10"/>;
    case "gear": return <><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>;
    case "laptop": return <><rect x="5" y="4" width="14" height="11" rx="1.5"/><path d="M3 19h18l-2-4H5Z"/></>;
    case "phone": return <><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10 5h4M11 18.5h2"/></>;
    case "database": return <><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></>;
    case "globe": return <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>;
    case "lock": return <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>;
    case "user": return <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>;
    case "calendar": return <><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 17h2"/></>;
    case "message": return <path d="M4 4h16v12H9l-5 4Z"/>;
    case "image": return <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m5 18 5-5 3 3 2-2 4 4"/></>;
    case "video": return <><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-3v10l-4-3Z"/></>;
    case "headphones": return <><path d="M4 13v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="12" width="4" height="7" rx="2"/><rect x="17" y="12" width="4" height="7" rx="2"/></>;
    case "flask": return <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M8 15h8"/></>;
    case "layers": return <><path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>;
    case "star": return <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>;
    case "heart": return <path d="M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.1a5 5 0 0 0 0-7.1Z"/>;
    case "map-pin": return <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>;
    case "code": return <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/></>;
    case "download": return <><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></>;
    case "upload": return <><path d="M12 17V5M7 10l5-5 5 5M4 20h16"/></>;
    case "link": return <><path d="M9.5 14.5 7 17a4 4 0 1 1-5.7-5.7l3-3A4 4 0 0 1 10 8"/><path d="m14.5 9.5 2.5-2.5a4 4 0 1 1 5.7 5.7l-3 3A4 4 0 0 1 14 16"/><path d="m8 12 8 0"/></>;
    case "arrow-right": return <><path d="M4 12h16M14 6l6 6-6 6"/></>;
    default: return <><circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/></>;
  }
};

export const IconGlyph=({icon,size=54}:{icon:string;size?:number})=>{
  const trimmed=icon.trim();
  if(isTextGlyph(trimmed)) return <span style={{fontSize:size,lineHeight:1}}>{trimmed}</span>;

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      style={{display:"block"}}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
    >
      {iconContents(canonical(trimmed))}
    </svg>
  );
};
