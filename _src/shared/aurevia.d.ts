export interface Destination {id:string;title:string;subtitle:string;image:string;position:number[];look:number[]}
export const DESTINATIONS: readonly Destination[];
export const destination:(id:string)=>Destination|undefined;
export const QUALITY:readonly string[];
export function walkPosition(current:number[],dx:number,dz:number,obstacles?:number[][]):number[];
