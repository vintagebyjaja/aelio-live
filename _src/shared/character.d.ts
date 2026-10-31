export type CharacterConfig={style:string;presentation:string;body:string;skin:string;face:string;hair:string;hairColor:string;texture:string;eyeColor:string;outfit:string;clothingColor:string;shoes:string;accessories:string[];height:number;nose:number;eyes:number;jaw:number};
export const CHARACTER_DEFAULT:CharacterConfig;
export const CHARACTER_OPTIONS:Record<string,string[]>;
export function characterConfig(value:unknown):CharacterConfig;
export function characterDocument(value:any):{version:number;current:CharacterConfig;presets:{id:string;name:string;config:CharacterConfig}[]};
