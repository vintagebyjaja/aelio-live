import {studioPage} from "../../_src/platform/studio.js";
export const onRequest = context => studioPage(context.request,context.env);
