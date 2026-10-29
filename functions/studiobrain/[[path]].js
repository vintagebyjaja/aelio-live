// Pages: Brain app deep links load the app shell. Logic: _src/edge/app-shell.js
import { serveAppShell } from "../../_src/edge/app-shell.js";

export const onRequest = (context) => serveAppShell(context);
