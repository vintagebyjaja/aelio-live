// Minimal ambient declarations so `tsc --noEmit` works without @types packages.
// Run `npm install -D @types/react @types/react-dom` and delete this file for full React typings.
declare module "react" {
  export function useState<T = any>(init?: T | (() => T)): [T, (v: T | ((p: T) => T)) => void];
  export function useEffect(fn: () => void | (() => void), deps?: any[]): void;
  export function useRef<T = any>(init?: T): { current: T };
  export function useCallback<T extends (...a: any[]) => any>(fn: T, deps: any[]): T;
  export function useMemo<T>(fn: () => T, deps: any[]): T;
  export const Fragment: any;
  const React: any;
  export default React;
}
declare module "react-dom/client" {
  export function createRoot(el: Element): { render(node: any): void };
}
declare module "react/jsx-runtime" {
  export const jsx: any; export const jsxs: any; export const Fragment: any;
}
declare namespace JSX {
  interface IntrinsicElements { [name: string]: any }
  interface Element {}
}
declare const firebase: any;
declare module "*.css";
