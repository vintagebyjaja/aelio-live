export const PLAZA_VIEWS:Record<string,{label:string;position:number[];look:number[]}>;
export const PLAZA_OBSTACLES:readonly number[][];
export function plazaStep(current:number[],dx:number,dz:number):number[];

export function plazaWalkable(position:number[]):boolean;
