export type CampusLocation={id:string;title:string;subtitle:string;x:number;y:number;icon:string;access:string;activities:string};
export const CAMPUS_LOCATIONS:readonly CampusLocation[];
export function campusLocation(id:string):CampusLocation|undefined;
export function mapZoom(n:number):number;
