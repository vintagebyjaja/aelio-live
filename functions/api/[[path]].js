// Pages uses the same Worker dispatcher/authorization boundary as the production Worker.
import worker from "../../_src/edge/worker.js";
export const onRequest = context => worker.fetch(context.request, context.env);
