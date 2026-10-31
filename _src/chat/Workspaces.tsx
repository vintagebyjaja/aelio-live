import React, { useEffect, useRef, useState } from "react";
import { call, fileURL, upload } from "./client";
import { friendly } from "./Experience";

const SECTIONS = [
  ["aelio", "AELIO", "Companions, conversation tools and agent settings."],
  [
    "dream-beyond",
    "Dream Beyond",
    "Dream Spaces, goals, projects and guided planning.",
  ],
  [
    "technology",
    "Technology",
    "Dream Memory, Dream Cloud, Dream Guard and connected services.",
  ],
  [
    "create",
    "Create",
    "Content, Book, Animation and Game studio briefs and creative projects.",
  ],
  [
    "values",
    "Our Values",
    "Green Guardian, privacy, private notes and personal data.",
  ],
  [
    "campus",
    "Agent Campus",
    "Learning, mentoring, accountability and community plans.",
  ],
  ["live", "AELIO Live", "Plans, credits, agent creation and training notes."],
];
const EMPTY = { title: "", body: "", kind: "note", url: "", status: "active" };
export function BrainWorkspace({ signedIn, onSignIn, onNavigate }: any) {
  const [section, setSection] = useState("aelio"),
    [entries, setEntries] = useState<any[]>([]),
    [draft, setDraft] = useState<any>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
      setEntries((await call("/workspace")).entries);
      setError("");
    } catch (e) {
      setError(friendly(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (signedIn) load();
  }, [signedIn]);
  if (!signedIn) return <PrivateGate title="Brain" onSignIn={onSignIn} />;
  const current = SECTIONS.find((s) => s[0] === section)!;
  return (
    <section className="panel brain-workspace">
      <p className="workspace-eyebrow">YOUR PRIVATE WORKSPACE</p>
      <h1>Brain</h1>
      <p>
        Keep your own notes, goals and plans. Entries stay private to your
        account. These are planning spaces; unavailable tools do not run here.
      </p>
      <nav className="workspace-sections" aria-label="Brain sections">
        {SECTIONS.map(([id, label]) => (
          <button
            key={id}
            aria-pressed={section === id}
            onClick={() => {
              setSection(id);
              setDraft(null);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <h2>{current[1]}</h2>
      <p>{current[2]}</p>
      {section === "aelio" && (
        <button onClick={() => onNavigate("agents")}>Open companions</button>
      )}
      {section === "technology" && (
        <button onClick={() => onNavigate("connected-apps")}>
          Connected services
        </button>
      )}
      {section === "values" && (
        <button onClick={() => onNavigate("account")}>
          Account & privacy controls
        </button>
      )}
      {section === "live" && (
        <button onClick={() => onNavigate("account")}>
          View account and credits
        </button>
      )}
      {error && (
        <p role="alert">
          {error} <button onClick={load}>Retry</button>
        </p>
      )}
      {loading ? (
        <p role="status">Loading your entries…</p>
      ) : (
        <>
          <button onClick={() => setDraft({ ...EMPTY })}>New entry</button>
          <p className="muted">
            Showing up to 500 most recent entries across your Brain.
          </p>
        </>
      )}
      {draft && (
        <form
          className="workspace-form"
          onSubmit={async (e: any) => {
            e.preventDefault();
            setSaving(true);
            try {
              await call(
                "/workspace" + (draft.id ? "/" + draft.id : ""),
                draft.id ? "PATCH" : "POST",
                { ...draft, section },
              );
              setDraft(null);
              await load();
            } catch (e) {
              setError(friendly(e));
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
            Title
            <input
              required
              maxLength={160}
              value={draft.title}
              onChange={(e: any) =>
                setDraft({ ...draft, title: e.target.value })
              }
            />
          </label>
          <label>
            Type
            <select
              aria-label="Type"
              value={draft.kind}
              onChange={(e: any) =>
                setDraft({ ...draft, kind: e.target.value })
              }
            >
              {["note", "goal", "project", "plan", "link", "task"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Details
            <textarea
              maxLength={20000}
              value={draft.body}
              onChange={(e: any) =>
                setDraft({ ...draft, body: e.target.value })
              }
            />
          </label>
          <label>
            HTTPS link (optional)
            <input
              type="url"
              maxLength={2000}
              value={draft.url || ""}
              onChange={(e: any) => setDraft({ ...draft, url: e.target.value })}
            />
          </label>
          <label>
            Status
            <select
              aria-label="Status"
              value={draft.status}
              onChange={(e: any) =>
                setDraft({ ...draft, status: e.target.value })
              }
            >
              {["active", "done", "archived"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <button disabled={saving} type="submit">
            {saving ? "Saving…" : "Save entry"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setDraft(null)}
          >
            Cancel
          </button>
        </form>
      )}
      {!loading && !entries.some((e) => e.section === section) && (
        <p>No entries here yet. Start with a note or a goal.</p>
      )}
      {entries
        .filter((e) => e.section === section)
        .map((entry) => (
          <article className="workspace-entry" key={entry.id}>
            <h3>{entry.title}</h3>
            <small>
              {entry.kind} · {entry.status}
            </small>
            <p className="entry-body">{entry.body}</p>
            {entry.url && (
              <a href={entry.url} target="_blank" rel="noreferrer">
                Open saved link ↗
              </a>
            )}
            <div>
              <button onClick={() => setDraft({ ...entry })}>Edit</button>
              <button
                onClick={async () => {
                  if (!confirm("Delete this private Brain entry?")) return;
                  try {
                    await call("/workspace/" + entry.id, "DELETE");
                    await load();
                  } catch (e) {
                    setError(friendly(e));
                  }
                }}
              >
                Delete entry
              </button>
            </div>
          </article>
        ))}
      <h2>Other connected services</h2>
      <p>
        These links open their websites. They do not link accounts or grant
        access.
      </p>
      <div className="workspace-sections">
        {[
          ["VYBR8", "https://vybr8.live/"],
          ["Grooveville", "https://grooveville.org/"],
          ["PATHD", "https://mypathd.com/"],
          ["DrawUp", "https://drawup.studio/"],
        ].map(([name, url]) => (
          <a key={name} href={url} target="_blank" rel="noreferrer">
            {name} ↗
          </a>
        ))}
      </div>
    </section>
  );
}
function PrivateGate({ title, onSignIn }: any) {
  return (
    <section className="panel">
      <h1>{title}</h1>
      <p>Sign in to access your private workspace.</p>
      <button onClick={onSignIn}>Sign in</button>
    </section>
  );
}

const STYLES = [
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
export function EchoWorkspace({
  signedIn,
  onSignIn,
  agents,
  threads,
  onOpen,
  onChanged,
}: any) {
  const [profiles, setProfiles] = useState<any[]>([]),
    [selected, setSelected] = useState(""),
    [memories, setMemories] = useState<any[]>([]),
    [draft, setDraft] = useState<any>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [loading, setLoading] = useState(true),
    [memory, setMemory] = useState(""),
    [kind, setKind] = useState("memory"),
    [staged, setStaged] = useState<any[]>([]);
  const selectionRef = useRef(selected);
  selectionRef.current = selected;
  async function load() {
    setLoading(true);
    try {
      setProfiles((await call("/echo")).profiles);
      setError("");
    } catch (e) {
      setError(friendly(e));
    } finally {
      setLoading(false);
    }
  }
  async function loadMemories(id: string) {
    try {
      const result = await call("/echo/" + id + "/memories");
      if (selectionRef.current === id) setMemories(result.memories);
    } catch (e) {
      if (selectionRef.current === id) setError(friendly(e));
    }
  }
  useEffect(() => {
    if (signedIn) load();
  }, [signedIn]);
  useEffect(() => {
    setMemories([]);
    setStaged([]);
    setMemory("");
    if (selected) loadMemories(selected);
  }, [selected]);
  async function mutate(action: () => Promise<any>) {
    setSaving(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setSaving(false);
    }
  }
  if (!signedIn) return <PrivateGate title="ECHO" onSignIn={onSignIn} />;
  const profile = profiles.find((p) => p.agent_id === selected),
    agent = agents.find((a: any) => a.id === selected);
  return (
    <section className="panel echo-workspace">
      <p className="workspace-eyebrow">PRIVATE · TEXT ONLY</p>
      <h1>ECHO</h1>
      <p>
        An ECHO is an AI simulation, never the real person or communication with
        someone who has died. Generated conversation is not factual memory. Your
        permanent companions stay unchanged.
      </p>
      {error && (
        <p role="alert">
          {error} <button onClick={load}>Retry</button>
        </p>
      )}
      <div className="workspace-sections">
        {[
          ["memory", "Memory ECHO"],
          ["personality", "Personality ECHO"],
          ["original", "Original ECHO"],
        ].map(([mode, label]) => (
          <button
            key={mode}
            onClick={() =>
              setDraft({
                mode,
                name: "",
                subject: mode === "original" ? "original" : "self",
                base_style: STYLES[0],
                instructions: "",
                disclosure_ack: false,
                subject_consent: false,
                memories_enabled: false,
              })
            }
          >
            {label}
          </button>
        ))}
      </div>
      {draft && (
        <form
          className="workspace-form"
          onSubmit={(e: any) => {
            e.preventDefault();
            mutate(async () => {
              const result = await call("/echo", "POST", draft);
              setDraft(null);
              await onChanged();
              await load();
              setSelected(result.agent_id);
            });
          }}
        >
          <h2>Create {draft.mode} ECHO</h2>
          <label>
            Name
            <input
              required
              maxLength={80}
              value={draft.name}
              onChange={(e: any) =>
                setDraft({ ...draft, name: e.target.value })
              }
            />
          </label>
          <label>
            Who inspires this ECHO?
            <select
              aria-label="Who inspires this ECHO?"
              value={draft.subject}
              onChange={(e: any) =>
                setDraft({
                  ...draft,
                  subject: e.target.value,
                  subject_consent: false,
                })
              }
            >
              {(draft.mode === "original"
                ? ["original", "fictional"]
                : ["self", "living", "deceased", "fictional", "original"]
              ).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {draft.mode === "personality" && (
            <label>
              Communication style
              <select
                aria-label="Communication style"
                value={draft.base_style}
                onChange={(e: any) =>
                  setDraft({ ...draft, base_style: e.target.value })
                }
              >
                {STYLES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Personality and preferences
            <textarea
              maxLength={4000}
              value={draft.instructions}
              onChange={(e: any) =>
                setDraft({ ...draft, instructions: e.target.value })
              }
            />
          </label>
          <label className="check">
            <input
              required
              type="checkbox"
              checked={draft.disclosure_ack}
              onChange={(e: any) =>
                setDraft({ ...draft, disclosure_ack: e.target.checked })
              }
            />
            I understand this is an AI simulation, not the actual person.
          </label>
          {draft.subject === "living" && (
            <label className="check">
              <input
                required
                type="checkbox"
                checked={draft.subject_consent}
                onChange={(e: any) =>
                  setDraft({ ...draft, subject_consent: e.target.checked })
                }
              />
              I have the living person's consent to create this realistic
              replica.
            </label>
          )}
          <button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create private ECHO"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setDraft(null)}
          >
            Cancel
          </button>
        </form>
      )}
      {loading ? (
        <p role="status">Loading ECHOs…</p>
      ) : (
        !profiles.length && (
          <p>No ECHOs yet. Choose a creation mode to begin.</p>
        )
      )}
      <div className="workspace-sections">
        {profiles.map((p) => (
          <button
            key={p.agent_id}
            aria-pressed={selected === p.agent_id}
            onClick={() => setSelected(p.agent_id)}
          >
            {agents.find((a: any) => a.id === p.agent_id)?.name ||
              "Private ECHO"}
          </button>
        ))}
      </div>
      {profile && (
        <div>
          <h2>{agent?.name || "ECHO"}</h2>
          <p>{profile.mode} · AI simulation · private</p>
          <button
            onClick={() => {
              const t = threads.find(
                (t: any) =>
                  t.participants.length === 1 && t.participants[0] === selected,
              );
              if (t) onOpen(t);
              else setError("Reload your conversations to open this ECHO.");
            }}
          >
            Open conversation
          </button>
          <label className="check">
            <input
              type="checkbox"
              disabled={saving}
              checked={profile.memories_enabled}
              onChange={(e: any) => {
                const enabled = e.target.checked;
                mutate(async () => {
                  await call("/echo/" + selected, "PATCH", {
                    memories_enabled: enabled,
                  });
                  await load();
                });
              }}
            />
            Use approved memories when this conversation also has memory enabled
          </label>
          <p>
            Only memories you explicitly approve may be used. Turning memory off
            preserves saved memories.
          </p>
          <form
            className="workspace-form"
            onSubmit={(e: any) => {
              e.preventDefault();
              mutate(async () => {
                await call("/echo/" + selected + "/memories", "POST", {
                  kind,
                  content: memory,
                  source: "typed",
                });
                setMemory("");
                await loadMemories(selected);
              });
            }}
          >
            <label>
              Memory type
              <select
                aria-label="Memory type"
                value={kind}
                onChange={(e: any) => setKind(e.target.value)}
              >
                {["memory", "story", "nickname", "conversation"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label>
              New memory for review
              <textarea
                required
                maxLength={4000}
                value={memory}
                onChange={(e: any) => setMemory(e.target.value)}
              />
            </label>
            <button disabled={saving}>Add for review</button>
          </form>
          <label>
            Import TXT or JSON for review
            <input
              type="file"
              accept=".txt,.json,text/plain,application/json"
              onChange={async (e: any) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  if (f.size > 120000)
                    throw Error("Use a TXT or JSON file smaller than 120 KB.");
                  const raw = await f.text();
                  const parsed = f.name.toLowerCase().endsWith(".json")
                    ? JSON.parse(raw)
                    : raw.split(/\n\s*\n/).filter(Boolean);
                  if (!Array.isArray(parsed) || parsed.length > 30)
                    throw Error(
                      "Import an array of up to 30 strings or objects with kind and content.",
                    );
                  const source = f.name.toLowerCase().endsWith(".json")
                    ? "import-json"
                    : "import-txt";
                  const rows = parsed.map((v: any) => ({
                    kind: typeof v === "string" ? "memory" : v.kind || "memory",
                    content: typeof v === "string" ? v : v.content,
                    source,
                  }));
                  if (
                    rows.some(
                      (v: any) =>
                        ![
                          "memory",
                          "story",
                          "nickname",
                          "conversation",
                        ].includes(v.kind) ||
                        typeof v.content !== "string" ||
                        !v.content.trim() ||
                        v.content.length > 4000,
                    )
                  )
                    throw Error(
                      "Each memory must contain 1–4000 characters and a supported text type.",
                    );
                  setStaged(rows);
                } catch (e) {
                  setError(friendly(e));
                }
              }}
            />
          </label>
          {staged.length > 0 && (
            <div>
              <h3>Review import before saving</h3>
              {staged.map((m, i) => (
                <p className="entry-body" key={i}>
                  {m.kind}: {m.content}
                </p>
              ))}
              <button
                disabled={saving}
                onClick={() =>
                  mutate(async () => {
                    const remaining = [...staged];
                    while (remaining.length) {
                      await call(
                        "/echo/" + selected + "/memories",
                        "POST",
                        remaining[0],
                      );
                      remaining.shift();
                      setStaged([...remaining]);
                    }
                    await loadMemories(selected);
                  })
                }
              >
                Save as pending memories
              </button>
              <button disabled={saving} onClick={() => setStaged([])}>
                Discard import
              </button>
            </div>
          )}
          <label>
            Save a photograph reference
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={saving}
              onChange={(e: any) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f)
                  mutate(async () => {
                    const saved = await upload(f, "users");
                    await call("/echo/" + selected + "/memories", "POST", {
                      kind: "photo",
                      file_id: saved.id,
                      content: f.name,
                      source: "typed",
                    });
                    await loadMemories(selected);
                  });
              }}
            />
          </label>
          <p className="muted">
            Photo references are stored privately. Photo analysis/OCR, sharing,
            invitations, voice and video are unavailable.
          </p>
          {memories.map((m) => (
            <article className="workspace-entry" key={m.id}>
              <strong>
                {m.kind} · {m.status}
              </strong>
              <p className="entry-body">{m.content}</p>
              {m.kind === "photo" && (
                <p>Reference only; not sent to inference.</p>
              )}
              <button
                disabled={saving}
                onClick={() =>
                  mutate(async () => {
                    await call(
                      "/echo/" + selected + "/memories/" + m.id,
                      "PATCH",
                      { approve: true },
                    );
                    await loadMemories(selected);
                  })
                }
              >
                Approve memory
              </button>
              <button
                disabled={saving}
                onClick={() =>
                  mutate(async () => {
                    await call(
                      "/echo/" + selected + "/memories/" + m.id,
                      "PATCH",
                      { approve: false },
                    );
                    await loadMemories(selected);
                  })
                }
              >
                Reject memory
              </button>
              <button
                disabled={saving}
                onClick={() =>
                  mutate(async () => {
                    if (
                      !confirm(
                        "Delete this supplied memory? The original file, if any, is retained.",
                      )
                    )
                      return;
                    await call(
                      "/echo/" + selected + "/memories/" + m.id,
                      "DELETE",
                    );
                    await loadMemories(selected);
                  })
                }
              >
                Delete memory
              </button>
            </article>
          ))}
          <button
            disabled={saving}
            onClick={() => {
              if (
                !confirm(
                  "Delete this ECHO, its memories and its solo conversation history? It is removed from groups. Uploaded files stay in your private storage.",
                )
              )
                return;
              mutate(async () => {
                await call("/echo/" + selected, "DELETE");
                setSelected("");
                await onChanged();
                await load();
              });
            }}
          >
            Delete ECHO
          </button>
        </div>
      )}
    </section>
  );
}

export function ConversationProjects({ threads, onOpen }: any) {
  const [filter, setFilter] = useState("");
  const names = Array.from(
    new Set<string>(threads.map((t: any) => t.project).filter(Boolean)),
  ).sort();
  return (
    <section className="conversation-projects">
      <h2>Conversation projects</h2>
      <p>
        Use “Move to Project” in conversation settings to organize chats.
        Removing a project assignment keeps the conversation and files.
      </p>
      <label>
        Filter project
        <select
          aria-label="Filter project"
          value={filter}
          onChange={(e: any) => setFilter(e.target.value)}
        >
          <option value="">All projects</option>
          {names.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      {!names.length && <p>No conversation projects yet.</p>}
      {names
        .filter((n) => !filter || filter === n)
        .map((n) => (
          <article key={n}>
            <h3>{n}</h3>
            {threads
              .filter((t: any) => t.project === n)
              .map((t: any) => (
                <button key={t.id} onClick={() => onOpen(t)}>
                  {t.title}
                  {t.archived ? " · archived" : ""}
                </button>
              ))}
          </article>
        ))}
    </section>
  );
}
