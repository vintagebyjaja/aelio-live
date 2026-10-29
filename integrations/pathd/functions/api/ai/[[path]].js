// mypathd.com/api/ai/* -> AELIO Core (private service binding). Copy into the PATHD repo.
import { aelioCore } from "../../../aelio-core-proxy.js";
export const onRequest = aelioCore;
