import {
  body,
  fail,
  member,
  own,
  reply,
  rpc,
  table,
  uuid,
  who,
} from "./shared.js";
import {relevantMemories} from './providers/context.js';
import { MILA_STYLES } from '../shared/mila-style.js';

export const SECTIONS = [
  "aelio",
  "dream-beyond",
  "technology",
  "create",
  "values",
  "campus",
  "live",
];
const styles = [
  "Tech Savvy",
  "Young & Hip",
  "Proper British",
  "Classy Gyal",
  "Good Energy",
  "Real Talk",
  "homegirl",
  "ceo",
  "auntie",
  "advisor",
  "teacher",
  "mom",
];
const invalid = (message) => fail(400, "invalid_workspace", message);
function bounded(value, max, required = false) {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    invalid("Complete the required fields within their length limits.");
  return value.trim();
}
export function workspaceFields(d, creating) {
  const out = {};
  if (creating || d.section !== undefined) {
    if (!SECTIONS.includes(d.section)) invalid("Choose a Brain section.");
    out.section = d.section;
  }
  if (creating || d.title !== undefined)
    out.title = bounded(d.title, 160, true);
  if (d.body !== undefined) out.body = bounded(d.body, 20000);
  if (d.kind !== undefined) {
    if (!["note", "goal", "project", "plan", "link", "task"].includes(d.kind))
      invalid("Choose an entry type.");
    out.kind = d.kind;
  }
  if (d.status !== undefined) {
    if (!["active", "done", "archived"].includes(d.status))
      invalid("Choose an entry status.");
    out.status = d.status;
  }
  if (d.pinned !== undefined) {
    if (typeof d.pinned !== "boolean")
      invalid("Choose whether to pin this entry.");
    out.pinned = d.pinned;
  }
  if (d.url !== undefined) {
    out.url = d.url === null || d.url === "" ? null : bounded(d.url, 2000);
    if (out.url) {
      let u;
      try {
        u = new URL(out.url);
      } catch {
        invalid("Use a complete HTTPS link.");
      }
      if (u.protocol !== "https:" || u.username || u.password)
        invalid("Use a complete HTTPS link without credentials.");
    }
  }
  return out;
}
export function echoSpec(d) {
  if (!["memory", "personality", "original"].includes(d.mode))
    invalid("Choose an ECHO creation mode.");
  const name = bounded(d.name, 80, true);
  if (
    [
      "aelio",
      "mila",
      "naomi",
      "angelo",
      "oliver",
      "simone",
      "chloe",
      "reggie",
    ].includes(name.toLowerCase())
  )
    invalid("Choose a name different from the permanent companions.");
  const subject = d.subject || "original";
  if (
    !["original", "self", "living", "deceased", "fictional"].includes(
      subject,
    ) ||
    (d.mode === "original" && !["original", "fictional"].includes(subject))
  )
    invalid("Choose a subject suitable for this ECHO.");
  if (d.disclosure_ack !== true)
    invalid("Acknowledge that an ECHO is an AI simulation.");
  if (subject === "living" && d.subject_consent !== true)
    invalid("Confirm consent for this realistic replica of a living person.");
  if (d.mode === "personality" && !styles.includes(d.base_style))
    invalid("Choose an available communication style.");
  return {
    name,
    mode: d.mode,
    subject,
    disclosure_ack: true,
    subject_consent: d.subject_consent === true,
    base_style: d.mode === "personality" ? d.base_style : null,
    memories_enabled: d.memories_enabled === true,
    subtitle: "ECHO · private AI simulation",
    specialty: bounded(d.specialty || "", 1000),
    instructions: bounded(d.instructions || "", 4000),
  };
}
export async function workspaces(req, env, path) {
  const u = await who(req, env);
  await member(env, u, "aelio");
  if (req.headers.get("x-aelio-product") === "pathd")
    fail(403, "pathd_agents", "Brain and ECHO belong to AELIO.");
  const wm = path.match(/^\/workspace(?:\/([a-f0-9-]+))?$/i);
  if (wm) {
    const id = wm[1];
    if (id) await own(env, "app_workspace_entries", id, u);
    if (req.method === "GET" && !id)
      return reply({
        entries: await table(
          env,
          "app_workspace_entries",
          "owner_id=eq." +
            u.id +
            "&order=pinned.desc,created_at.desc&limit=500",
          { token: u.token },
        ),
      });
    if (req.method === "DELETE" && id) {
      await table(
        env,
        "app_workspace_entries",
        "id=eq." + id + "&owner_id=eq." + u.id,
        { service: true, method: "DELETE" },
      );
      return reply({ ok: true });
    }
    if ((req.method === "POST" && !id) || (req.method === "PATCH" && id)) {
      const fields = workspaceFields(await body(req), !id);
      const rows = await table(
        env,
        "app_workspace_entries",
        id ? "id=eq." + id + "&owner_id=eq." + u.id : "",
        {
          service: true,
          method: id ? "PATCH" : "POST",
          data: id
            ? { ...fields, updated_at: new Date().toISOString() }
            : { ...fields, owner_id: u.id },
        },
      );
      return reply({ entry: rows[0] }, id ? 200 : 201);
    }
  }
  if (path === "/echo" && req.method === "GET")
    return reply({
      profiles: await table(env, "app_echo_profiles", "owner_id=eq." + u.id, {
        token: u.token,
      }),
    });
  if (path === "/echo" && req.method === "POST")
    return reply(
      await rpc(env, "app_create_echo", {
        uid: u.id,
        spec: echoSpec(await body(req)),
      }),
      201,
    );
  const em = path.match(
    /^\/echo\/([a-f0-9-]+)(?:\/memories(?:\/([a-f0-9-]+))?)?$/i,
  );
  if (em) {
    const agent = await own(env, "app_agents", em[1], u);
    const profile = (
      await table(
        env,
        "app_echo_profiles",
        "agent_id=eq." + agent.id + "&owner_id=eq." + u.id,
        { token: u.token },
      )
    )[0];
    if (agent.kind !== "custom" || !profile)
      fail(404, "not_found", "ECHO not found.");
    const memories = path.includes("/memories"),
      mid = em[2];
    if (!memories && req.method === "DELETE") {
      const chats = await table(
        env,
        "app_conversations",
        "owner_id=eq." +
          u.id +
          "&participants=cs." +
          encodeURIComponent("{" + agent.id + "}"),
        { token: u.token },
      );
      if (chats.some((c) => Date.parse(c.busy_until) > Date.now()))
        fail(
          409,
          "reply_in_progress",
          "Wait for the current reply before deleting this ECHO.",
        );
      return reply(
        await rpc(env, "app_delete_echo", { uid: u.id, echo: agent.id }),
      );
    }
    if (!memories && req.method === "PATCH") {
      const d = await body(req);
      if (typeof d.memories_enabled !== "boolean")
        invalid("Choose whether reviewed memories may be used.");
      await table(
        env,
        "app_echo_profiles",
        "agent_id=eq." + agent.id + "&owner_id=eq." + u.id,
        {
          service: true,
          method: "PATCH",
          data: { memories_enabled: d.memories_enabled },
        },
      );
      return reply({ ok: true });
    }
    if (memories && !mid && req.method === "GET")
      return reply({
        memories: await table(
          env,
          "app_echo_memories",
          "echo_id=eq." +
            agent.id +
            "&owner_id=eq." +
            u.id +
            "&order=created_at.asc&limit=200",
          { token: u.token },
        ),
      });
    if (memories && !mid && req.method === "POST") {
      const d = await body(req);
      if (
        !["memory", "story", "nickname", "photo", "conversation"].includes(
          d.kind,
        )
      )
        invalid("Choose a memory type.");
      const source = d.source || "typed";
      if (!["typed", "import-txt", "import-json"].includes(source))
        invalid("Choose a supported import source.");
      if (d.kind === "photo" && !uuid(d.file_id))
        invalid("Select an uploaded photograph.");
      if (d.file_id) {
        const f = await own(env, "app_files", d.file_id, u);
        if (f.status !== "ready" || !f.mime.startsWith("image/"))
          invalid("Select your own ready image.");
      }
      const content = bounded(d.content || "", 4000, d.kind !== "photo");
      const rows = await table(env, "app_echo_memories", "", {
        service: true,
        method: "POST",
        data: {
          owner_id: u.id,
          echo_id: agent.id,
          kind: d.kind,
          content,
          source,
          file_id: d.file_id || null,
          status: "pending",
        },
      });
      return reply({ memory: rows[0] }, 201);
    }
    if (memories && mid) {
      const m = await own(env, "app_echo_memories", mid, u);
      if (m.echo_id !== agent.id) fail(404, "not_found", "Memory not found.");
      if (req.method === "PATCH") {
        const d = await body(req);
        if (typeof d.approve !== "boolean")
          invalid("Approve or reject this memory.");
        await rpc(env, "app_review_echo_memory", {
          uid: u.id,
          memory: mid,
          approve: d.approve,
        });
        return reply({ ok: true });
      }
      if (req.method === "DELETE") {
        await table(
          env,
          "app_echo_memories",
          "id=eq." + mid + "&owner_id=eq." + u.id,
          { service: true, method: "DELETE" },
        );
        return reply({ ok: true });
      }
    }
  }
  fail(404, "not_found", "Not found.");
}

// Ordinary custom-agent memory is never an alternate path around ECHO review.
export async function withEchoContext(env, u, agents, memoryEnabled, content = "") {
  if (!u || !agents.some((a) => a.kind === "custom")) return agents;
  const profiles = await table(
    env,
    "app_echo_profiles",
    "owner_id=eq." + u.id,
    { token: u.token },
  );
  return Promise.all(
    agents.map(async (a) => {
      const p = profiles.find((p) => p.agent_id === a.id);
      if (!p) return a;
      const memories =
        memoryEnabled && p.memories_enabled
          ? await rpc(env, "app_echo_context", { uid: u.id, echo: a.id })
          : [];
      return {
        ...a,
        echo: { mode: p.mode, subject: p.subject, base_style: p.base_style },
        personality: p.base_style || a.personality,
        memory_enabled: !!memoryEnabled && p.memories_enabled,
        memories: relevantMemories(memories,content).map((m) => ({ kind: m.kind, content: m.content })),
        instructions: [
          a.instructions,
          "This ECHO is a private AI simulation, not the real person or communication with a deceased person. Never present generated dialogue as factual memory.",
          p.base_style ? "Communication style: " + (MILA_STYLES[p.base_style] || p.base_style) : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }),
  );
}
