// aelio.live/api/* -> AELIO engine (same origin). Logic: _src/edge/engine-proxy.js
import { proxyToEngine } from "../../_src/edge/engine-proxy.js";

export const onRequest = (context) => proxyToEngine(context);
