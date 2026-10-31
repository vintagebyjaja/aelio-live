// aelio.live/webhooks/* (Stripe) -> AELIO engine (same origin). Logic: _src/edge/engine-proxy.js
import { proxyToEngine } from "../../_src/edge/engine-proxy.js";

import { platform } from "../../_src/platform/index.js";
export const onRequest = (context) => new URL(context.request.url).pathname==='/webhooks/ai-subscriptions'?platform(context.request,context.env):proxyToEngine(context);
