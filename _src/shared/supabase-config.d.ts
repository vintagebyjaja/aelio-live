export const DEFAULT_SUPABASE_URL: string;
export function publicKeyProblem(key:string,serviceKey?:string):string|null;
export function resolveSupabaseConfig(env?:Record<string,unknown>,built?:{url?:string;anonKey?:string}):{url:string;anonKey:string;source:string;errorCode:string|null;error:string|null};
