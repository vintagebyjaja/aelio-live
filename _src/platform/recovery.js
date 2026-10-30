import {
  reply,
  fail,
  body,
  who,
  rate,
  table,
  rpc,
  sb,
  text,
  random,
  digest,
  audit,
  config,
} from "./shared.js";
const normalize = (s) =>
  s.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
// Versioned six-round PBKDF2-SHA256 chain (100k iterations per round), independent salt per answer.
// Workers limit individual PBKDF2 operations to 100k; total work is 600k. Codes have 256-bit entropy.
export async function slowHash(answer, salt = random()) {
  let material = new TextEncoder().encode(normalize(answer));
  let b;
  for (let round = 0; round < 6; round++) {
    const k = await crypto.subtle.importKey("raw", material, "PBKDF2", false, [
      "deriveBits",
    ]);
    b = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode(salt + ":" + round),
        iterations: 100000,
        hash: "SHA-256",
      },
      k,
      256,
    );
    material = new Uint8Array(b);
  }
  return {
    scheme: "pbkdf2-sha256-6x100k-v1",
    salt,
    hash: Array.from(new Uint8Array(b), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
function equal(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}
async function reauth(env, u, password) {
  const d = await sb(env, "/auth/v1/token?grant_type=password", {
    method: "POST",
    data: { email: u.email, password: text(password, 256) },
  });
  if (d?.user?.id !== u.id)
    fail(
      403,
      "reauthentication_required",
      "Reauthenticate to update recovery.",
    );
  return d;
}
export async function recovery(req, env, path) {
  await rate(req, env, "recovery", 5, 900);
  if (path === "/enroll") {
    const u = await who(req, env);
    const d = await body(req);
    await reauth(env, u, d.password);
    if (
      !Array.isArray(d.questions) ||
      !Array.isArray(d.answers) ||
      d.questions.length !== 2 ||
      d.answers.length !== 2
    )
      fail(400, "invalid_recovery", "Choose two questions and answers.");
    const qs = d.questions.map((q) => text(q, 160)),
      ans = d.answers.map((a) => text(a, 200));
    if (
      qs.some((q) => q.length < 8) ||
      qs[0] === qs[1] ||
      ans.some((a) => normalize(a).length < 3)
    )
      fail(
        400,
        "invalid_recovery",
        "Use two different questions and answers of at least three characters.",
      );
    const hashes = await Promise.all(ans.map((a) => slowHash(a)));
    const codes = Array.from({ length: 8 }, random);
    const codeHashes = await Promise.all(codes.map(digest));
    await rpc(env, "app_enroll_recovery", {
      uid: u.id,
      qs,
      hashes,
      codes: codeHashes,
    });
    return reply({ codes });
  }
  if (path === "/reset") {
    const d = await body(req);
    const email = text(d.email, 254).toLowerCase(),
      password = text(d.password, 256);
    if (password.length < 12)
      fail(
        400,
        "weak_password",
        "Use at least 12 characters for your new password.",
      );
    // Account email lookup is server-only; failures share a uniform response. No question lookup endpoint leaks identities.
    const uid=await lookup(env,email);
    const r=await rpc(env,'app_recovery_record',{uid});
    const answers = Array.isArray(d.answers) ? d.answers : [];
    let ok = !!r && answers.length === 2;
    for (let i = 0; i < 2; i++) {
      const h = r?.answer_hashes?.[i] || {
        salt: "invalid-account-fixed-work",
        hash: "0".repeat(64),
      };
      const result = await slowHash(text(answers[i] || "", 200), h.salt);
      ok = equal(result.hash, h.hash) && ok;
    }
    const code = await digest(text(d.code || "", 100).replace(/\s/g, ""));
    if (!ok || !(await rpc(env, "app_consume_recovery", { uid, code })))
      fail(
        400,
        "recovery_failed",
        "Recovery could not be verified. Check your answers and unused code, or use the email recovery option.",
      );
    // Single-use code is consumed before the privileged password operation; never restore it on an uncertain retry.
    await sb(env, "/auth/v1/admin/users/" + uid, {
      method: "PUT",
      service: true,
      data: { password },
    });
    // Supabase global sign-out requires a user JWT. Obtain one for the new password, revoke all sessions, then sign in normally.
    const s = await sb(env, "/auth/v1/token?grant_type=password", {
      method: "POST",
      data: { email, password },
    });
    await sb(env, "/auth/v1/logout?scope=global", {
      method: "POST",
      token: s.access_token,
      data: {},
    });
    await audit(env, { id: uid }, "recovery.password_reset");
    return reply({ ok: true, signInRequired: true });
  }
  fail(404, "not_found", "Not found.");
}
async function lookup(env, email) {
  // GoTrue admin list is paged and would be unsafe at scale; narrow, service-only database RPC instead.
  return (
    (await rpc(env, "app_recovery_user", { address: email })) ||
    "00000000-0000-4000-8000-000000000000"
  );
}
