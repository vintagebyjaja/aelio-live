export function imageIntent(content,{hasImage=false,action}={}){
 const text=String(content||'').trim();
 if(['create','edit','variation'].includes(action))return action;
 if(/\b(can|could|do)\s+you\s+(create|generate|make|edit)\s+(an?\s+)?images?\b/i.test(text))return 'inquire';
 if(/\b(create|generate|draw|paint|render|design|make)\b.{0,45}\b(image|picture|portrait|illustration|flyer|poster|logo|photo|artwork|city|scene|landscape)\b/i.test(text)||/\bshow me what this room could look like\b/i.test(text))return 'create';
 if(hasImage&&/^(please\s+)?(make|remove|change|edit|keep|replace|add|turn|adjust|recolor|regenerate|create a variation)\b/i.test(text))return 'edit';
 return null;
}
