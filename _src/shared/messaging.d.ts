export const OFFICIAL_KEYS:readonly string[];
export function isOfficialThread(thread:any):boolean;
export function inboxThreads(threads:any[],environment:string):any[];
export function conversationTitle(thread:any,agents:any[]):string;
export function bubbleInk(hex:string):string;

export function readableInk(background:string,preferred?:string):string;
