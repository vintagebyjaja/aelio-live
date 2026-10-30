import {
  reply,
  fail,
  who,
  member,
  table,
  own,
  limited,
  text,
  uuid,
  rpc,
  audit,
} from "./shared.js";
const types = {
  "text/plain": [
    "txt",
    "md",
    "csv",
    "log",
    "py",
    "js",
    "ts",
    "tsx",
    "jsx",
    "css",
    "html",
    "sql",
  ],
  "application/json": ["json"],
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "audio/mpeg": ["mp3"],
  "audio/wav": ["wav"],
  "audio/ogg": ["ogg"],
  "video/mp4": ["mp4"],
  "video/webm": ["webm"],
  "application/zip": ["zip"],
};
const categories = [
  "users",
  "agents",
  "voice",
  "documents",
  "code-projects",
  "generated-assets",
];
export function validateFile(name, mime, data) {
  const ext = name.split(".").at(-1)?.toLowerCase();
  if (!types[mime]?.includes(ext) || !data.length)
    fail(
      415,
      "file_type_denied",
      "Use a supported document, image, audio, video, JSON or ZIP file.",
    );
  const s = new TextDecoder("latin1").decode(data.slice(0, 16));
  if (
    (mime === "application/pdf" && !s.startsWith("%PDF-")) ||
    (mime === "image/png" && !(data[0] === 137 && s.slice(1, 4) === "PNG")) ||
    (mime === "image/jpeg" && !(data[0] === 255 && data[1] === 216)) ||
    (mime === "image/webp" &&
      !(s.startsWith("RIFF") && s.slice(8, 12) === "WEBP")) ||
    (mime === "application/zip" && !s.startsWith("PK")) ||
    (mime === "audio/wav" &&
      !(s.startsWith("RIFF") && s.slice(8, 12) === "WAVE")) ||
    (mime === "audio/ogg" && !s.startsWith("OggS")) ||
    (mime === "video/mp4" && s.slice(4, 8) !== "ftyp") ||
    (mime === "video/webm" && !(data[0] === 26 && data[1] === 69))
  )
    fail(
      415,
      "file_content_mismatch",
      "The file content does not match its type.",
    );
  if (mime === "application/json") {
    try {
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
    } catch {
      fail(415, "invalid_json_file", "Invalid JSON file.");
    }
  }
}
export async function storage(req, env, path) {
  const u = await who(req, env);
  await member(env, u);
  if (!env.AELIO_STORAGE)
    fail(503, "storage_not_configured", "Private storage is not connected.");
  if (path === "" && req.method === "GET")
    return reply({
      files: await table(
        env,
        "app_files",
        "owner_id=eq." +
          u.id +
          "&status=eq.ready&order=created_at.desc&limit=100",
        { token: u.token },
      ),
    });
  if (path === "" && req.method === "POST") {
    const name = text(
      decodeURIComponent(req.headers.get("x-file-name") || ""),
      180,
    );
    if (!name || /[\x00-\x1f\\/]/.test(name) || name === "." || name === "..")
      fail(400, "invalid_filename", "Choose a simple file name.");
    const mime = (req.headers.get("content-type") || "").split(";")[0];
    const category = req.headers.get("x-file-category") || "documents";
    if (!categories.includes(category))
      fail(400, "invalid_category", "Invalid file category.");
    const data = await limited(req, 25 * 1024 * 1024);
    validateFile(name, mime, data);
    const conversation_id = req.headers.get("x-conversation-id") || null,
      agent_id = req.headers.get("x-agent-id") || null;
    if (conversation_id)
      await own(env, "app_conversations", conversation_id, u);
    if (agent_id) await own(env, "app_agents", agent_id, u);
    const id = crypto.randomUUID(),
      key = `${category}/${u.id}/${id}`;
    const days = Number(req.headers.get("x-retention-days") || 0);
    if (!Number.isInteger(days) || days < 0 || days > 365)
      fail(400, "invalid_retention", "Retention must be 0 to 365 days.");
    const record = {
      id,
      owner_id: u.id,
      object_key: key,
      name,
      mime,
      size_bytes: data.length,
      category,
      conversation_id,
      agent_id,
      expires_at: days
        ? new Date(Date.now() + days * 86400000).toISOString()
        : null,
    };
    // Reserve quota in one DB transaction before uploading. Pending objects count toward quota too.
    await rpc(env, "app_reserve_file", { record });
    try {
      await env.AELIO_STORAGE.put(key, data, {
        httpMetadata: { contentType: mime },
        customMetadata: { owner: u.id, id },
      });
      await table(env, "app_files", "id=eq." + id + "&owner_id=eq." + u.id, {
        method: "PATCH",
        service: true,
        data: { status: "ready" },
      });
    } catch (e) {
      await env.AELIO_STORAGE.delete(key).catch(() => {});
      await table(env, "app_files", "id=eq." + id + "&owner_id=eq." + u.id, {
        method: "DELETE",
        service: true,
      });
      throw e;
    }
    await audit(env, u, "file.upload", id);
    return reply({ file: { ...record, status: "ready" } }, 201);
  }
  const id = path.slice(1);
  const f = await own(env, "app_files", id, u);
  if (req.method === "DELETE") {
    await table(env, "app_files", "id=eq." + id + "&owner_id=eq." + u.id, {
      method: "PATCH",
      service: true,
      data: { status: "deleting" },
    });
    await env.AELIO_STORAGE.delete(f.object_key);
    await table(env, "app_files", "id=eq." + id + "&owner_id=eq." + u.id, {
      method: "DELETE",
      service: true,
    });
    await audit(env, u, "file.delete", id);
    return reply({ ok: true });
  }
  if (req.method !== "GET")
    fail(405, "method_not_allowed", "Method not allowed.");
  if (
    f.status !== "ready" ||
    (f.expires_at && Date.parse(f.expires_at) <= Date.now())
  )
    fail(404, "not_found", "Not found.");
  const obj = await env.AELIO_STORAGE.get(f.object_key);
  if (!obj) fail(404, "not_found", "File not found.");
  return new Response(obj.body, {
    headers: {
      "content-type": f.mime,
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
export async function sweepFiles(env) {
  if (!env.AELIO_STORAGE) return;
  const files = await table(
    env,
    "app_files",
    "or=(expires_at.lt." +
      new Date().toISOString() +
      ",status.eq.deleting,and(status.eq.pending,created_at.lt." +
      new Date(Date.now() - 3600000).toISOString() +
      "))&limit=100",
    { service: true },
  );
  for (const f of files) {
    await env.AELIO_STORAGE.delete(f.object_key);
    await table(env, "app_files", "id=eq." + f.id, {
      method: "DELETE",
      service: true,
    });
  }
}
