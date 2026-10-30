export const COMPANIONS:Array<{id:string;intro:string;name:string;title:string;subtitle:string;portrait:string|null;description:string}>;
export const DREAM_TEAM:typeof COMPANIONS;
export function companion(id:string):typeof COMPANIONS[number]|undefined;
export function coordinateTeam(agents:any[],input:string):any[];
