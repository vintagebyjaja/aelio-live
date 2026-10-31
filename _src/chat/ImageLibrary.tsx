import React, { useEffect, useRef, useState } from "react";
import { call, fileURL } from "./client";
import { friendly } from "./Experience";
export function ImageLibrary({
  signedIn,
  onSignIn,
  agents,
  threads,
  onOpen,
}: any) {
  const [files, setFiles] = useState<any[]>([]),
    [next, setNext] = useState<any>(null),
    [filters, setFilters] = useState({
      q: "",
      agent: "",
      conversation: "",
      from: "",
      to: "",
    }),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<any>(null);
  const generation = useRef(0),
    imageRequest = useRef(0),
    dialog = useRef<HTMLDialogElement | null>(null),
    urls = useRef(new Set<string>());
  const close = () => {
    imageRequest.current++;
    setPreview(null);
    dialog.current?.close();
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current.clear();
  };
  useEffect(
    () => () => {
      imageRequest.current++;
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );
  async function load(more = false) {
    const turn = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams({
        library: "1",
        ...filters,
        ...(more ? next : {}),
      });
      const r = await call("/files?" + p);
      if (turn === generation.current) {
        setFiles((old) =>
          more
            ? [
                ...old,
                ...r.files.filter((f: any) => !old.some((x) => x.id === f.id)),
              ]
            : r.files,
        );
        setNext(r.next);
      }
    } catch (e) {
      if (turn === generation.current) setError(friendly(e));
    } finally {
      if (turn === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (!signedIn) return;
    const timer = setTimeout(() => load(), 250);
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [signedIn, JSON.stringify(filters)]);
  async function open(file: any) {
    const request = ++imageRequest.current;
    try {
      const url = await fileURL(file.id);
      if (request !== imageRequest.current) {
        URL.revokeObjectURL(url);
        return;
      }
      urls.current.add(url);
      setPreview({ ...file, url });
      dialog.current?.showModal();
    } catch (e) {
      setError(friendly(e));
    }
  }
  async function download(file: any) {
    try {
      const url = await fileURL(file.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(friendly(e));
    }
  }
  if (!signedIn)
    return (
      <section className="panel">
        <h1>Image Library</h1>
        <p>Sign in to see your private saved images.</p>
        <button onClick={onSignIn}>Sign in</button>
      </section>
    );
  return (
    <section className="panel image-library">
      <p className="workspace-eyebrow">YOUR PRIVATE COLLECTION</p>
      <h1>Image Library</h1>
      <p>
        Images saved from your conversations, all in one place. This gallery
        shows actual saved files; it does not generate new images.
      </p>
      <div className="library-filters">
        <label>
          Search images
          <input
            value={filters.q}
            onChange={(e: any) => setFilters({ ...filters, q: e.target.value })}
          />
        </label>
        <label>
          Companion
          <select
            aria-label="Filter companion"
            value={filters.agent}
            onChange={(e: any) =>
              setFilters({ ...filters, agent: e.target.value })
            }
          >
            <option value="">All companions</option>
            {agents.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Conversation
          <select
            aria-label="Filter conversation"
            value={filters.conversation}
            onChange={(e: any) =>
              setFilters({ ...filters, conversation: e.target.value })
            }
          >
            <option value="">All conversations</option>
            {threads.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={filters.from}
            onChange={(e: any) =>
              setFilters({ ...filters, from: e.target.value })
            }
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.to}
            onChange={(e: any) =>
              setFilters({ ...filters, to: e.target.value })
            }
          />
        </label>
      </div>
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => load()}>Retry</button>
        </p>
      )}
      {loading && <p role="status">Loading images…</p>}
      {!loading && !error && !files.length && (
        <p>No saved images match these filters.</p>
      )}
      <div className="image-grid">
        {files.map((f) => (
          <article key={f.id}>
            <PrivateThumbnail file={f} onOpen={() => open(f)} />
            <h2>{f.name}</h2>
            <small>{new Date(f.created_at).toLocaleDateString()}</small>
            <div>
              <button onClick={() => open(f)}>Preview</button>
              <button onClick={() => download(f)}>Download</button>
              {threads.some((t: any) => t.id === f.conversation_id) && (
                <button
                  onClick={() =>
                    onOpen(threads.find((t: any) => t.id === f.conversation_id))
                  }
                >
                  Open conversation
                </button>
              )}
              <button
                onClick={async () => {
                  if (
                    !confirm(
                      "Delete this saved image from your private Library and storage? Your conversation history stays. Photo references to this file are removed.",
                    )
                  )
                    return;
                  try {
                    await call("/files/" + f.id, "DELETE");
                    setFiles((old) => old.filter((x) => x.id !== f.id));
                    if (preview?.id === f.id) close();
                  } catch (e) {
                    setError(friendly(e));
                  }
                }}
              >
                Delete image
              </button>
            </div>
          </article>
        ))}
      </div>
      {next && (
        <button disabled={loading} onClick={() => load(true)}>
          Load more images
        </button>
      )}
      <dialog
        ref={dialog}
        className="image-preview"
        onCancel={close}
        onClick={(e: any) => {
          if (e.target === dialog.current) close();
        }}
      >
        {preview && (
          <>
            <button aria-label="Close image preview" onClick={close}>
              ×
            </button>
            <h2>{preview.name}</h2>
            <img src={preview.url} alt={preview.name} />
            <button onClick={() => download(preview)}>Download image</button>
          </>
        )}
      </dialog>
    </section>
  );
}
function PrivateThumbnail({ file, onOpen }: any) {
  const ref = useRef<HTMLButtonElement | null>(null),
    [url, setUrl] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true,
      owned = "";
    const observer = new IntersectionObserver(async (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      try {
        const value = await fileURL(file.id);
        owned = value;
        if (live) setUrl(value);
        else URL.revokeObjectURL(value);
      } catch {
        if (live) setFailed(true);
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => {
      live = false;
      observer.disconnect();
      if (owned) URL.revokeObjectURL(owned);
    };
  }, [file.id]);
  return (
    <button
      ref={ref}
      className="image-tile"
      aria-label={"Preview " + file.name}
      onClick={onOpen}
    >
      {url ? (
        <img src={url} alt={file.name} />
      ) : (
        <span>{failed ? "Preview unavailable" : "Loading preview…"}</span>
      )}
    </button>
  );
}
