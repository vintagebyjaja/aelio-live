import {AgentAvatar,CompanionNavigation,CompanionLibrary} from "./Companions";
import {companion} from "../shared/companions.js";
import {AelioLoading,FeatureBoundary,ConnectionNotice,friendly} from "./Experience";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { auth, call, upload, fileURL, download } from "./client";
import { AuthPanel } from "./Auth";
import "./styles.css";
import { DreamHome, Discover, TOPICS } from "./DreamHome";
import { Markdown } from "./Markdown";
import { Icon, Orb } from "./Icon";
import { ConnectedApps, HandoffCard } from "./ConnectedApps";
import "./premium.css";
import { AppearanceControls } from "./Appearance";
import { designOf, resolveAppearance, guestAppearance } from "./design-system";
const BACKGROUNDS = [
  "AELIO Original",
  "Space & Galaxies",
  "Nature & Waterfalls",
  "City Skyline",
  "Sunset & Beaches",
  "Sports Lounge",
  "Basketball Court",
  "Football Stadium",
  "Cigar Lounge",
  "Executive Office",
  "Luxury Penthouse",
  "Minimal Black",
  "Minimal White",
  "Custom Upload",
];
const SCENES: Record<string, string> = {
  "AELIO Original": "aelio-cinematic-home.webp",
  "Space & Galaxies": "aelio-scene-1.webp",
  "Nature & Waterfalls": "aelio-atmosphere-nature.webp",
  "City Skyline": "aelio-atmosphere-city.webp",
  "Sunset & Beaches": "aelio-scene-3.webp",
  "Sports Lounge": "aelio-atmosphere-studio.webp",
  "Basketball Court": "aelio-atmosphere-studio.webp",
  "Football Stadium": "aelio-atmosphere-city.webp",
  "Cigar Lounge": "aelio-atmosphere-studio.webp",
  "Executive Office": "aelio-architecture-scene.webp",
  "Luxury Penthouse": "aelio-architecture-scene.webp",
};
function App() {
  const [keyboardOpen,setKeyboardOpen]=useState(false),[waiting,setWaiting]=useState<Record<string,boolean>>({}),[retryable,setRetryable]=useState<Record<string,boolean>>({});
  const generations=useRef<Record<string,AbortController>>({}),attempts=useRef<Record<string,any>>({}),followScroll=useRef(true),messageScroller=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    let baseline=window.visualViewport?.height||window.innerHeight;
    const detect=()=>{const height=window.visualViewport?.height||window.innerHeight;const editable=document.activeElement?.matches('input,textarea');if(!editable)baseline=Math.max(baseline,height);setKeyboardOpen(!!editable&&baseline-height>Math.max(120,baseline*.18));};
    window.visualViewport?.addEventListener('resize',detect);window.addEventListener('resize',detect);document.addEventListener('focusin',detect);document.addEventListener('focusout',detect);
    return()=>{window.visualViewport?.removeEventListener('resize',detect);window.removeEventListener('resize',detect);document.removeEventListener('focusin',detect);document.removeEventListener('focusout',detect);};
  },[]);
  const [homeFiles, setHomeFiles] = useState<any[]>([]),
    [homeSending, setHomeSending] = useState(false),
    [handoffs, setHandoffs] = useState<Record<string, any[]>>({});
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try {
      return localStorage.getItem("aelio.voice.enabled") !== "false";
    } catch {
      return true;
    }
  });
  const [homeDraft, setHomeDraft] = useState("");
  const [home, setHome] = useState(
    !new URLSearchParams(location.search).has("companion"),
  );
  const [collapsed, setCollapsed] = useState(false);
  const [globalAppearance, setGlobalAppearance] =
    useState<any>(guestAppearance);
  const [globalPreview, setGlobalPreview] = useState<any>(null);
  const [appearanceMessage, setAppearanceMessage] = useState("");
  const [session, setSession] = useState<any>(undefined),
    [account, setAccount] = useState<any>(null),
    [accountError, setAccountError] = useState(""),
    [agents, setAgents] = useState<any[]>([]),
    [threads, setThreads] = useState<any[]>([]),
    [cur, setCur] = useState<any>(null),
    [messages, setMessages] = useState<Record<string, any[]>>({}),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [remaining, setRemaining] = useState<number | null>(null),
    [panel, setPanel] = useState(
      location.pathname.startsWith("/account") ||
        location.pathname.startsWith("/auth")
        ? "account"
        : "",
    ),
    [drawer, setDrawer] = useState(false),
    [search, setSearch] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState<Record<string, boolean>>({}),
    [consent, setConsent] = useState(false),
    [target, setTarget] = useState(""),
    [attachments, setAttachments] = useState<any[]>([]),
    [backgroundURL, setBackgroundURL] = useState(""),
    [suggestion, setSuggestion] = useState(""),
    [proposals, setProposals] = useState<Record<string, any[]>>({}),
    [allowReminders, setAllowReminders] = useState(false);
  const [mention,setMention]=useState(""),[searchHits,setSearchHits]=useState<any[]>([]);
  useEffect(()=>{let live=true;if(!session||search.trim().length<2){setSearchHits([]);return;}const timer=setTimeout(()=>{call('/conversations/search?q='+encodeURIComponent(search.trim().slice(0,100))).then(result=>{if(live)setSearchHits(result.conversations);}).catch(error=>{if(live)setErr(friendly(error));});},250);return()=>{live=false;clearTimeout(timer);};},[search,session?.user?.id]);
  const listedThreads=search.length>=2?[...searchHits,...threads.filter(thread=>!searchHits.some(found=>found.id===thread.id))]:threads;
  const [editor, setEditor] = useState<any>(null),
    [appearance, setAppearance] = useState<any>(null),
    [items, setItems] = useState<any[]>([]),
    [notifications, setNotifications] = useState<any[]>([]),
    [careerRecords, setCareerRecords] = useState<any[]>([]),
    [files, setFiles] = useState<any[]>([]);
  const backgroundCache = useRef<Map<string, string>>(new Map()),
    inflight = useRef<Set<string>>(new Set()),
    cache = useRef<Record<string, any[]>>({}),
    end = useRef<HTMLDivElement | null>(null),
    input = useRef<HTMLTextAreaElement | null>(null);
  function clearPrivateState(){
    Object.values(generations.current).forEach(controller=>controller.abort());
    setAccount(null);setAgents([]);setThreads([]);setCur(null);setMessages({});setDrafts({});setHomeDraft('');setHomeFiles([]);setAttachments([]);setBackgroundURL('');
    cache.current={};backgroundCache.current.forEach(url=>URL.revokeObjectURL(url));backgroundCache.current.clear();
  }
  useEffect(()=>{const changed=(event:StorageEvent)=>{if(event.key!=='aelio.auth')return;const id=(value:string|null)=>{try{return value?JSON.parse(value)?.user?.id:null;}catch{return null;}};if(!event.newValue||id(event.oldValue)!==id(event.newValue)){clearPrivateState();location.assign('/chat/');}};addEventListener('storage',changed);return()=>removeEventListener('storage',changed);},[]);
  async function reload() {
    setAccountError("");
    try {
      const s = await auth?.session();
      const identityChanged=!!session&&(!s||session.user?.id!==s.user?.id);
      if(identityChanged)clearPrivateState();
      setSession(s || null);
      if (s) {
        try {
          const a = await call("/account").catch(error=>{setAccountError(friendly(error));return null;});
          setAccount(a);
          if(a){setGlobalAppearance(a.preferences.appearance || {});setConsent(a.preferences.external_ai_consent);}
          const [as, cs] = await Promise.all([
            call("/agents"),
            call("/conversations"),
          ]);
          setAgents(as.agents);
          setThreads(cs.conversations);
          if (!cur || cur.guest_hash || identityChanged) {
            const q = new URLSearchParams(location.search);
            const mila = q.get("companion") === "mila";
            const agent = as.agents.find(
              (x: any) => x.kind === (mila ? "mila" : "aelio"),
            );
            const t = cs.conversations.find(
              (c: any) =>
                c.participants.length === 1 && c.participants[0] === agent?.id,
            );
            if (t) select(t, false);
            else if (agent)
              await newThread([agent.id], mila ? "MILA" : "AELIO");
            setHome(!new URLSearchParams(location.search).has("companion"));
          }
        } catch (e: any) {
          setAccountError(friendly(e));
        }
      } else {
        setAccount(null);
        const g = await call("/guest", "POST", {});
        setCur(g.conversation);
        setRemaining(g.remaining);
        loadMessages(g.conversation.id);
      }
    } catch (e: any) {
      setErr(friendly(e));
      setSession(null);
    }
  }
  useEffect(() => {
    reload();
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(false);
        setPanel("");
        setEditor(null);
        setAppearance(null);
      }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);
  useEffect(() => {
    if(followScroll.current)end.current?.scrollIntoView({ block: "end", behavior: "auto" });
  }, [messages, cur?.id]);
  useEffect(() => {
    const scenes = new Set<string>();
    for (const t of threads.slice(0, 30)) {
      const f = SCENES[t.appearance?.background || "AELIO Original"];
      if (f) scenes.add(f);
      if (scenes.size === 4) break;
    }
    for (const f of scenes) {
      const image = new Image();
      image.src = "/assets/img/" + f;
    }
  }, [threads]);
  useEffect(
    () => () => {
      for (const url of backgroundCache.current.values())
        URL.revokeObjectURL(url);
    },
    [],
  );
  async function loadMessages(id: string, force = false) {
    try {
      const r = await call("/conversations/" + id + "/messages");
      if (inflight.current.has(id) && !force) return;
      cache.current[id] = r.messages;
      setMessages((m) => ({ ...m, [id]: r.messages }));
    } catch (e: any) {
      setErr(friendly(e));
    }
  }
  function select(t: any, record = true) {
    followScroll.current=true;
    if (record)
      history.pushState({ aelioView: "chats", thread: t.id }, "", "#chats");
    setHome(false);
    setPanel("");
    setCur(t);
    setAppearance(null);
    setDrawer(false);
    setTarget("");
    setAttachments([]);
    setErr("");
    setSuggestion("");
    if (cache.current[t.id])
      setMessages((m) => ({ ...m, [t.id]: cache.current[t.id] }));
    if (!busy[t.id]) loadMessages(t.id);
    input.current?.focus();
  }
  async function openCompanion(agent:any){
    const thread=threads.find(t=>t.permanent_key===agent.kind)||threads.find(t=>t.participants.length===1&&t.participants[0]===agent.id);
    if(thread)select(thread);else await newThread([agent.id],companion(agent.kind)?.title||agent.name,agent.kind==='mila'?'pathd':'aelio');
  }
  async function newThread(ids: string[], title: string, product = "aelio") {
    try {
      const r = await call("/conversations", "POST", {
        participants: ids,
        title,
        product,
      });
      setThreads((ts) => [r.conversation, ...ts]);
      select(r.conversation);
      setPanel("");
      return r.conversation;
    } catch (e: any) {
      setErr(friendly(e));
    }
  }
  async function change(fields: any) {
    try {
      const r = await call("/conversations/" + cur.id, "PATCH", fields);
      setCur(r.conversation);
      setThreads((ts) => ts.map((t) => (t.id === cur.id ? r.conversation : t)));
      setAppearance(null);
    } catch (e: any) {
      setErr(friendly(e));
    }
  }
  async function remove() {
    if (!confirm("Delete this conversation and its message history?")) return;
    try {
      await call("/conversations/" + cur.id, "DELETE");
      setThreads((ts) => ts.filter((t) => t.id !== cur.id));
      setCur(null);
      setPanel("agents");
    } catch (e: any) {
      setErr(friendly(e));
    }
  }
  async function send(
    suggest = false,
    override?: { conversation: any; content: string; files: any[]; requestId?:string },
  ) {
    const conversation = override?.conversation || cur;
    if (!conversation || busy[conversation.id]) return;
    const id = conversation.id,
      content = override?.content ?? drafts[id] ?? "";
    const selectedFiles = override?.files ?? attachments;
    if (!content.trim() && !suggest) return;
    if (!consent) {
      setErr("Please accept the AI disclosure before sending.");
      return;
    }
    setErr("");
    followScroll.current=true;
    const previousRequest=attempts.current[id]?.request_id;
    const retrying=!!override?.requestId || (!!retryable[id] && attempts.current[id]?.content===content);
    let requestId=override?.requestId || (retrying?previousRequest:null) || crypto.randomUUID();
    attempts.current[id]={request_id:requestId,content,files:selectedFiles,conversation};
    const abort=new AbortController();generations.current[id]=abort;
    setWaiting(current=>({...current,[id]:true}));setRetryable(current=>({...current,[id]:false}));
    inflight.current.add(id);
    setBusy((b) => ({ ...b, [id]: true }));
    if (!suggest) {
      setDrafts((d) => ({ ...d, [id]: "" }));
      setMessages((m) => ({
        ...m,
        [id]: [
          ...(m[id] || []).filter(message=>!retrying||message.request_id!==previousRequest),
          { id:'local-user-'+requestId, role: "user", content, request_id:requestId, local:true },
        ],
      }));
    }
    const streams: Record<string, string> = {};
    let subtitle = "";
    let failed = false;
    try {
      const t = await auth?.accessToken();
      let r:Response;
      for(let attempt=0;;attempt++){r = await fetch(
        "/api/platform/conversations/" +
          id +
          (suggest ? "/suggest-subtitle" : "/respond"),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(t ? { authorization: "Bearer " + t } : {}),
          },
          signal:abort.signal,
          body: JSON.stringify({
            content,
            request_id:requestId,
            consent: true,
            target: override ? undefined : target || undefined,
            file_ids: selectedFiles.map((f) => f.id),
            allow_reminders: override ? false : allowReminders,
          }),
        },
      );
      if(r.ok)break;
      const detail=await r.json();
      if(detail.code==='retry_new_request'&&attempt===0){const oldId=requestId;requestId=crypto.randomUUID();attempts.current[id].request_id=requestId;setMessages(current=>({...current,[id]:(current[id]||[]).map(message=>message.local&&message.request_id===oldId?{...message,request_id:requestId,id:message.role==='user'?'local-user-'+requestId:message.id}:message)}));continue;}
      throw new Error(detail.error||'The response could not start.');
      }
      let saved=false;
      if (!r.body) throw new Error("The response stream is missing.");
      const reader = r.body.getReader(),
        decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const r = await reader.read();
        if (r.done) break;
        buf += decoder.decode(r.value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === "error") {
            failed = true;
            throw new Error(
              ev.message || "The Brain could not complete the reply.",
            );
          }
          if (ev.type === "ecosystem_handoff")
            setHandoffs((previous) => ({
              ...previous,
              [id]: [...(previous[id] || []), ev.proposal],
            }));
          if (ev.type === "reminder_proposal") {
            setProposals((ps) => ({
              ...ps,
              [id]: [
                ...(ps[id] || []),
                { ...ev.proposal, proposal_id: crypto.randomUUID() },
              ],
            }));
          }
          if(ev.type==='saved')saved=true;
          if (ev.type === "delta") {
            setWaiting(current=>({...current,[id]:false}));
            if (suggest) {
              subtitle += ev.text;
              setSuggestion(subtitle);
              continue;
            }
            const key = "stream-" + id + "-" + (ev.agent_id || "aelio");
            streams[key] = (streams[key] || "") + ev.text;
            setMessages((m) => ({
              ...m,
              [id]: [
                ...(m[id] || []).filter((x) => x.id !== key),
                {
                  id: key,
                  role: "assistant",
                  speaker: ev.speaker,
                  content: streams[key],
                  request_id:requestId,local:true,
                },
              ],
            }));
          }
          if (ev.type === "saved" && session === null && typeof ev.remaining==='number')
            setRemaining(ev.remaining);
        }
      }
      if(!saved)throw new Error("The connection ended before the reply was saved. Retry safely.");
      setAttachments([]);
      if (session)
        call("/account")
          .then(setAccount)
          .catch(error => setAccountError(friendly(error)));
      if (!suggest) await loadMessages(id, true);
    } catch (e: any) {
      setErr(e.name==='AbortError'?'Generation stopped. Your draft is available to retry.':friendly(e));
      if (!suggest){setDrafts((d) => ({ ...d, [id]: content }));setRetryable(current=>({...current,[id]:true}));}
    } finally {
      delete generations.current[id];setWaiting(current=>({...current,[id]:false}));
      inflight.current.delete(id);
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }
  async function stopGeneration(){const id=cur?.id;if(!id)return;generations.current[id]?.abort();const attempt=attempts.current[id];if(attempt)try{const result=await call('/conversations/'+id+'/cancel','POST',{request_id:attempt.request_id});if(result.complete)await loadMessages(id,true);}catch{setErr('Stopped locally. The server cancellation could not be confirmed; please wait before retrying.');}}
  async function retryGeneration(){const previous=attempts.current[cur?.id];if(previous)await send(false,{conversation:previous.conversation,content:previous.content,files:previous.files,requestId:previous.request_id});}
  async function show(p: string) {
    setErr("");
    setPanel(p);
    if (p) setHome(false);
    try {
      if (p === "reminders") {
        const [a, n, c] = await Promise.all([
          call("/career/reminders"),
          call("/career/notifications"),
          call("/career/records"),
        ]);
        setItems(a.items);
        setNotifications(n.items);
        setCareerRecords(c.items);
      }
      if (p === "files" || p === "projects")
        setFiles((await call("/files")).files);
    } catch (e: any) {
      setErr(friendly(e));
    }
  }
  function navigate(view: string, record = true) {
    setDrawer(false);
    if (view === "home") {
      setHome(true);
      setPanel("");
    } else if (view === "chats") {
      setHome(false);
      setPanel("history");
    } else {
      setHome(false);
      show(view);
    }
    if (record) history.pushState({ aelioView: view }, "", "#" + view);
  }
  useEffect(() => {
    const restore = () => {
      const state = history.state;
      const view = state?.aelioView || "home";
      if (view === "chats" && state?.thread) {
        const thread = threads.find((t) => t.id === state.thread);
        if (thread) {
          select(thread, false);
          return;
        }
      }
      if (
        [
          "home",
          "chats",
          "agents",
          "discover",
          "create",
          "projects",
          "connected-apps",
          "settings",
          "appearance",
          "account",
        ].includes(view)
      )
        navigate(view, false);
    };
    addEventListener("popstate", restore);
    return () => removeEventListener("popstate", restore);
  }, [threads]);
  async function sendFromHome() {
    if (homeSending || !homeDraft.trim()) return;
    if (!consent) {
      setErr("Please allow AI processing before sending.");
      return;
    }
    setHomeSending(true);
    try {
      let thread = cur;
      if (session) {
        const mainPal = agents.find((a) => a.kind === "aelio");
        if (!mainPal) {
          setErr(
            "Your Main Pal needs a moment. Try opening your space again.",
          );
          return;
        }
        thread = await newThread([mainPal.id], "New conversation");
      }
      if (!thread) {
        setErr("Chat is still connecting. Your draft is preserved.");
        return;
      }
      const content = homeDraft,
        selectedFiles = [...homeFiles];
      setHome(false);
      setPanel("");
      setAttachments(selectedFiles);
      setHomeDraft("");
      setHomeFiles([]);
      await send(false, {
        conversation: thread,
        content,
        files: selectedFiles,
      });
    } finally {
      setHomeSending(false);
    }
  }
  const activeAgents =
    cur?.participants
      ?.map((id: string) => agents.find((a) => a.id === id))
      .filter(Boolean) || [];
  const isMila = activeAgents.some((a: any) => a.kind === "mila");
  const globalAP = globalPreview || globalAppearance;
  const conversationAP = appearance || cur?.appearance || {};
  const ap =
    home || panel === "appearance"
      ? globalAP
      : resolveAppearance(
          globalAP,
          activeAgents.length === 1 ? activeAgents[0] : null,
          conversationAP,
        );
  const design = designOf(ap);
  async function startTopic(topic: any) {
    if (!topic) return;
    let t = cur;
    if (session) {
      const a = agents.find((a) => a.kind === "aelio");
      if (!a) {
        setErr("Your Main Pal needs a moment. Try opening your space again.");
        return;
      }
      t = await newThread([a.id], topic[0]);
    }
    if (!t) {
      setErr("Chat is still connecting. Try again shortly.");
      return;
    }
    setDrafts((d) => ({ ...d, [t.id]: topic[2] }));
    setHome(false);
    setPanel("");
    requestAnimationFrame(() => input.current?.focus());
  }
  async function saveGlobal() {
    try {
      const next = globalPreview || globalAppearance;
      if (session) await call("/account", "PATCH", { appearance: next });
      else localStorage.setItem("aelio.appearance", JSON.stringify(next));
      setGlobalAppearance(next);
      setGlobalPreview(null);
      setAppearanceMessage(
        "Appearance saved. Agents using your default will follow it.",
      );
    } catch (e: any) {
      setErr(friendly(e));
    }
  }
  const minimalBackground = ["Minimal Black", "Minimal White"].includes(
    ap.background,
  );
  const bg = minimalBackground
    ? ""
    : backgroundURL ||
      (SCENES[ap.background || ""]
        ? "/assets/img/" + SCENES[ap.background || ""]
        : design.scene
          ? "/assets/dream/" + design.scene
          : "");
  useEffect(() => {
    let live = true;
    const id = ap.file_id;
    setBackgroundURL(id ? backgroundCache.current.get(id) || "" : "");
    if (id && !backgroundCache.current.has(id))
      fileURL(id)
        .then((v) => {
          backgroundCache.current.set(id, v);
          while (backgroundCache.current.size > 8) {
            const first = backgroundCache.current.keys().next().value!;
            URL.revokeObjectURL(backgroundCache.current.get(first)!);
            backgroundCache.current.delete(first);
          }
          if (live) setBackgroundURL(v);
        })
        .catch((e: any) => setErr(friendly(e)));
    return () => {
      live = false;
    };
  }, [ap.file_id]);
  if (session === undefined)
    return <main className="loading"><AelioLoading onRetry={reload}/></main>;
  if (panel === "account" && !session)
    return (
      <main className="auth-page">
        <AuthPanel onDone={reload} />
      </main>
    );
  return (
    <div
      className={
        "dream-app " + (keyboardOpen?"keyboard-open ":"") +
        (design.light ? "light " : "") +
        (collapsed ? "collapsed " : "") +
        (home ? "at-home" : "")
      }
      data-design={design.id}
      data-motion={ap.motion || "system"}
      style={
        {
          "--home-scene-mobile": `url(/assets/dream/${design.mobileScene})`,
          "--home-scene": design.scene
            ? `url(/assets/dream/${design.scene})`
            : "none",
        } as any
      }
    >
      <ConnectionNotice/><header className="topbar">
        <button
          aria-label="Open conversations"
          aria-expanded={drawer || (!collapsed && innerWidth > 900)}
          onClick={() => {
            if (matchMedia("(min-width: 901px)").matches)
              setCollapsed(!collapsed);
            else setDrawer(!drawer);
          }}
        >
          <Icon name="menu" />
        </button>
        <a
          className="brand"
          href="/"
          onClick={(event: any) => {
            event.preventDefault();
            navigate("home");
          }}
        >
          AELIO<small>NEVER SAY NEVER.</small>
        </a>
        <label className="desktop-search">
          <Icon name="compass" size={18} />
          <span className="sr-only">Search conversations and ideas</span>
          <input
            value={search}
            placeholder="Search chats & ideas…"
            onChange={(event: any) => {
              setSearch(event.target.value);
              if (panel !== "discover") navigate("discover");
            }}
          />
        </label>
        <nav className="header-actions">
          <button
            aria-label="Discover experiences"
            onClick={() => navigate("discover")}
          >
            <Icon name="sparkle" />
          </button>
          <button
            className="profile-orb"
            aria-label={session ? "Account" : "Sign in"}
            onClick={() => navigate("account")}
          >
            <Orb small />
          </button>
        </nav>
      </header>
      {drawer && (
        <button
          className="drawer-backdrop"
          aria-label="Close conversations"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside className={"sidebar " + (drawer ? "open" : "")}>
        <a
          className="sidebar-brand"
          href="/"
          onClick={(event: any) => {
            event.preventDefault();
            navigate("home");
          }}
        >
          AELIO<small>NEVER SAY NEVER.</small>
        </a>
        <nav className="home-nav" aria-label="AELIO navigation">
          {[
            ["home", "Home", "home"],
            ["chats", "Chats", "chat"],
            ["agents", "Agents", "agents"],
            ["discover", "Discover", "compass"],
            ["create", "Create", "bulb"],
            ["projects", "Projects", "plus"],
            ["connected-apps", "Connected Apps", "sparkle"],
            ["settings", "Settings", "settings"],
          ].map(([view, label, icon]) => (
            <button
              key={view}
              title={label}
              aria-label={label}
              aria-current={
                (
                  view === "home"
                    ? home && !panel
                    : view === "chats"
                      ? (!home && !panel) || panel === "history"
                      : panel === view
                )
                  ? "page"
                  : undefined
              }
              onClick={() =>
                navigate(view === "agents" && !session ? "account" : view)
              }
            >
              <Icon name={icon} size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="side-head">
          <h2>Your space</h2>
          <button
            aria-label="Close conversations"
            onClick={() => setDrawer(false)}
          >
            ×
          </button>
        </div>
        <button
          className="primary"
          onClick={() => (session ? show("new") : show("account"))}
        >
          ＋ New chat
        </button>
        <label className="search">
          Search
          <input
            value={search}
            placeholder="Search conversations"
            onChange={(e: any) => setSearch(e.target.value)}
          />
        </label>
        {session?<CompanionNavigation agents={agents} threads={threads} current={cur} query={search} onOpen={openCompanion} onSelect={select}/>:<button className="permanent" onClick={()=>{setPanel("");setHome(false);}}>AELIO · Your Main Pal</button>}
        <div className="side-head"><h2>Recent Conversations</h2></div>
        {[...listedThreads]
          .filter(
            (t) =>
              !t.archived && (!t.permanent_key||!!search) &&
              [t.title, t.subtitle, t.search_preview, ...((messages[t.id]||cache.current[t.id]||t.app_messages||[]).map((m:any)=>m.content))]
                .join(" ")
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
          .sort((a, b) => Number(b.pinned) - Number(a.pinned))
          .map((t) => (
            <button
              key={t.id}
              className={"thread " + (cur?.id === t.id ? "selected" : "")}
              onClick={() => select(t)}
            >
              <AgentAvatar agent={agents.find(a=>a.id===t.participants[0])} group={t.participants.length>1}/>
              <span>
                <b>
                  {t.pinned ? "★ " : ""}
                  {t.title}
                </b>
                <small>
                  {t.subtitle ||
                    agents.find((a) => a.id === t.participants[0])?.subtitle ||
                    "Your conversation"}
                </small>
                <small>
                  {t.search_preview || (messages[t.id] || cache.current[t.id])
                    ?.slice(-1)[0]
                    ?.content?.slice(0, 70) ||
                    t.app_messages?.[0]?.content?.slice(0, 70) ||
                    "Open conversation"}
                </small>
                <small>{relativeTime(t.updated_at || t.created_at)}</small>
              </span>
            </button>
          ))}
        {threads.some((t) => t.archived) && (
          <details>
            <summary>Archived</summary>
            {threads
              .filter((t) => t.archived)
              .map((t) => (
                <button className="thread" key={t.id} onClick={() => select(t)}>
                  {t.title}
                </button>
              ))}
          </details>
        )}
        <nav className="side-tools">
          {session && (
            <>
              <button onClick={() => show("agents")}>Your agents</button>
              <button onClick={() => show("reminders")}>
                Reminders & career context
              </button>
              <button onClick={() => show("files")}>Private files</button>
              <button onClick={() => show("account")}>
                Account & recovery
              </button>
            </>
          )}
        </nav>
        <details className="legacy-links">
          <summary>More experiences</summary>
          <a href="/agent-campus/">Campus</a>
          <a href="/live/">Live</a>
          <a href="/brain/">Brain</a>
          <a href="/explore/">Explore AELIO</a>
        </details>
        <footer>
          One Mind. Your Energy.
          <br />
          {session
            ? "Your Free account"
            : remaining === null
              ? "Guest chat"
              : remaining + " guest messages remaining"}
        </footer>
      </aside>
      <main className="workspace"><FeatureBoundary key={panel||(home?"home":cur?.id||"chat")} onExit={()=>navigate("home")}>
        {err && (
          <div className="error" role="alert">
            {err}
            <button aria-label="Dismiss error" onClick={() => setErr("")}>
              ×
            </button>
          </div>
        )}
        {accountError && (
          <div className="error" role="alert">
            {accountError}
            <button onClick={reload}>Retry account connection</button>
          </div>
        )}
        {panel === "history" ? (
          <section className="panel">
            <p className="workspace-eyebrow">ROOM FOR EVERY CONVERSATION</p>
            <h1>Your conversations</h1>
            <label>
              Search history
              <input
                value={search}
                onChange={(event: any) => setSearch(event.target.value)}
              />
            </label>
            {threads
              .filter(
                (t) =>
                  !t.archived &&
                  [t.title, t.subtitle]
                    .join(" ")
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((t) => (
                <article key={t.id}>
                  <button onClick={() => select(t)}>{t.title}</button>
                  <p>{t.subtitle}</p>
                </article>
              ))}
            {!threads.length && (
              <>
                <p>
                  {session
                    ? "Your conversations will appear here."
                    : "Guest conversations have limited continuity. Sign in to save your history."}
                </p>
                {cur && (
                  <button onClick={() => select(cur)}>
                    Open current conversation
                  </button>
                )}
              </>
            )}
          </section>
        ) : panel === "discover" ? (
          <Discover
            onTopic={startTopic}
            onNavigate={navigate}
            search={search}
            onSearch={setSearch}
            threads={threads}
            onResume={select}
          />
        ) : panel === "connected-apps" ? (
          <ConnectedApps onPlan={(topic:any)=>startTopic(topic)} onMila={()=>{const mila=agents.find(a=>a.kind==="mila");if(mila)openCompanion(mila);else setPanel("account");}}/>
        ) : panel === "settings" ? (
          <section className="panel settings-workspace">
            <p className="workspace-eyebrow">MAKE YOURSELF AT HOME</p>
            <h1>Your AELIO, your way.</h1>
            <button onClick={() => navigate("appearance")}>
              <Icon name="sparkle" />
              Appearance & themes
            </button>
            <button onClick={() => navigate("account")}>
              <Icon name="settings" />
              {session
                ? "Account, privacy & recovery"
                : "Sign in or create an account"}
            </button>
            <button onClick={() => navigate("connected-apps")}>
              <Icon name="compass" />
              Connected Apps
            </button>
            <label className="voice-preference">
              <input
                type="checkbox"
                checked={voiceEnabled}
                onChange={(event: any) => {
                  setVoiceEnabled(event.target.checked);
                  try {
                    localStorage.setItem(
                      "aelio.voice.enabled",
                      String(event.target.checked),
                    );
                  } catch {
                    setErr("Your browser could not save the voice preference.");
                  }
                }}
              />
              Enable browser voice input
            </label>
            <p className="muted">
              Speech input depends on browser and microphone support. Your
              browser’s speech service may process audio remotely. This device
              preference does not change your agents.
            </p>
            <details>
              <summary>More AELIO experiences</summary>
              <a href="/agent-campus/">Campus</a>
              <a href="/live/">Live</a>
              <a href="/brain/">Brain</a>
              <a href="/explore/">Explore AELIO</a>
            </details>
          </section>
        ) : panel === "create" ? (
          <section className="panel create-workspace">
            <p className="workspace-eyebrow">
              FROM POSSIBILITY TO A FIRST STEP
            </p>
            <h1>What will you bring to life?</h1>
            <p>
              Work with AELIO on ideas, creative briefs and plans using your
              existing conversation system.
            </p>
            <div className="create-options">
              <button onClick={() => startTopic(TOPICS[1])}>
                <Icon name="bulb" />
                <strong>Explore an idea</strong>
                <span>Brainstorm and shape your next move.</span>
              </button>
              <button onClick={() => startTopic(TOPICS[4])}>
                <Icon name="sparkle" />
                <strong>Build a business plan</strong>
                <span>Strategy, structure and practical next steps.</span>
              </button>
              <button onClick={() => navigate("projects")}>
                <Icon name="plus" />
                <strong>Your project files</strong>
                <span>Find your private files and generated outputs.</span>
              </button>
            </div>
            <a href="/create/">
              Open existing AELIO creation experiences{" "}
              <Icon name="arrow" size={18} />
            </a>
            <p className="muted">
              Start with a brief, a story or a piece of code. You can develop the
              idea here and take it to your chosen creative tools.
            </p>
          </section>
        ) : panel === "projects" ? (
          <ProjectWorkspace
            files={files}
            threads={threads}
            onResume={select}
            refresh={() => show("projects")}
            setErr={setErr}
            signedIn={!!session}
            onSignIn={() => navigate("account")}
          />
        ) : panel === "appearance" ? (
          <section className="panel appearance-panel">
            <button
              onClick={() => {
                setGlobalPreview(null);
                setPanel("");
                setHome(true);
              }}
            >
              Back to Dream Box
            </button>
            <h1>Your AELIO appearance</h1>
            <p>
              Preview the whole interface. Chat backgrounds are separate. Your
              conversations and companions stay exactly where you left them.
            </p>
            <AppearanceControls
              value={globalAP}
              onChange={(v: any) => {
                setGlobalPreview(v);
                setAppearanceMessage("Preview — save to keep this design.");
              }}
              backgrounds={BACKGROUNDS}
              allowFile={!!session}
              onUpload={async (f: File) => {
                try {
                  const file = await upload(f, "users");
                  setGlobalPreview({
                    ...globalAP,
                    background: "Custom Upload",
                    file_id: file.id,
                  });
                } catch (e: any) {
                  setErr(friendly(e));
                }
              }}
            />
            <button onClick={saveGlobal}>Save global appearance</button>
            <button
              onClick={() => {
                setGlobalPreview(null);
                setAppearanceMessage("Preview cancelled.");
              }}
            >
              Cancel preview
            </button>
            <p role="status">{appearanceMessage}</p>
          </section>
        ) : panel === "account" && session ? (
          <Account
            account={account}
            reload={reload}
            setPanel={setPanel}
            setErr={setErr}
          />
        ) : panel === "agents" ? (
          <section className="panel">
            <h1>Your companions</h1>
            <p>
              AELIO is always AELIO. Your other agents have their own
              identities, memories and specialties.
            </p>
            <button
              onClick={() => {
                setEditor({
                  name: "",
                  subtitle: "",
                  specialty: "",
                  personality: "The Homie",
                  instructions: "",
                  memories: [],
                  memory_enabled: false,
                });
                setPanel("edit-agent");
              }}
            >
              Create agent
            </button>
            <CompanionLibrary agents={agents} threads={threads} onOpen={openCompanion} onSelect={select} onCustomize={a=>{setEditor(a);setPanel('companion-appearance');}} onEdit={a=>{setEditor(a);setPanel('edit-agent');}}/>

          </section>
        ) : panel === "companion-appearance" && editor ? (
          <section className="panel appearance-panel"><button onClick={()=>setPanel('agents')}>Back to companions</button><h1>{editor.name}’s appearance</h1>
          <label>Appearance<select value={editor.appearance_mode||'inherit'} onChange={(e:any)=>setEditor({...editor,appearance_mode:e.target.value})}><option value="inherit">Use AELIO Default</option><option value="custom">Customize This Agent</option></select></label>
          {editor.appearance_mode==='custom'&&<AppearanceControls value={editor.appearance||{}} onChange={(appearance:any)=>setEditor({...editor,appearance})} backgrounds={BACKGROUNDS} allowFile={!!session} onUpload={async(file:File)=>{const uploaded=await upload(file,'agents');setEditor({...editor,appearance:{...editor.appearance,background:'Custom Upload',file_id:uploaded.id}});}}/>}
          <button onClick={async()=>{try{const response=await call('/agents/'+editor.id,'PATCH',{appearance_mode:editor.appearance_mode||'inherit',appearance:editor.appearance||{}});setAgents(as=>as.map(a=>a.id===editor.id?response.agent:a));setPanel('agents');}catch(e){setErr(friendly(e));}}}>Save companion appearance</button><p>Switching to your default keeps this companion’s saved custom settings.</p></section>
        ) : panel === "edit-agent" && editor ? (
          <section className="panel">
            <h1>{editor.id ? "Edit" : "Create"} agent</h1>
            <div className="custom-portrait-editor"><AgentAvatar agent={{...editor,kind:'custom'}} shape="rounded"/><label>Agent portrait<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async(e:any)=>{const file=e.target.files?.[0];if(!file)return;try{const saved=await upload(file,'agents');setEditor({...editor,avatar_file_id:saved.id,avatar_crop:{x:50,y:35,zoom:1}});}catch(error){setErr(friendly(error));}}}/></label>
            {editor.avatar_file_id&&<><p>Position the portrait for your agent. Save the profile to keep your changes.</p>{[['x','Horizontal position',0,100,1],['y','Vertical position',0,100,1],['zoom','Zoom',1,3,.01]].map(([key,label,min,max,step])=><label key={String(key)}>{label}<input type="range" aria-label={String(label)} min={Number(min)} max={Number(max)} step={Number(step)} value={editor.avatar_crop?.[String(key)]??(key==='zoom'?1:key==='y'?35:50)} onChange={(e:any)=>setEditor({...editor,avatar_crop:{x:50,y:35,zoom:1,...editor.avatar_crop,[String(key)]:Number(e.target.value)}})}/></label>)}
            <button type="button" onClick={()=>setEditor({...editor,avatar_crop:{x:50,y:35,zoom:1}})}>Reset crop</button><button type="button" onClick={()=>setEditor({...editor,avatar_file_id:null,avatar_crop:{x:50,y:35,zoom:1}})}>Remove picture</button></>}
            </div>

            <form
              onSubmit={async (e: any) => {
                e.preventDefault();
                try {
                  const r = await call(
                    "/agents" + (editor.id ? "/" + editor.id : ""),
                    editor.id ? "PATCH" : "POST",
                    editor,
                  );
                  setAgents((as) => [
                    ...as.filter((a) => a.id !== r.agent.id),
                    r.agent,
                  ]);
                  setPanel("agents");
                } catch (e: any) {
                  setErr(friendly(e));
                }
              }}
            >
              {["name", "subtitle", "specialty", "instructions"].map((k) => (
                <label key={k}>
                  {k === "subtitle" ? "Chat Focus / Subtitle" : k}
                  <input
                    required={k === "name"}
                    maxLength={
                      k === "instructions"
                        ? 4000
                        : k === "specialty"
                          ? 1000
                          : k === "name"
                            ? 80
                            : 160
                    }
                    value={editor[k]}
                    onChange={(e: any) =>
                      setEditor({ ...editor, [k]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>
                Personality
                <select
                  value={editor.personality || ""}
                  onChange={(e: any) =>
                    setEditor({
                      ...editor,
                      personality: e.target.value || null,
                    })
                  }
                >
                  <option value="">Adaptive</option>
                  {[
                    "The Homie",
                    "Proper British",
                    "Classy Gyal",
                    "Creative",
                    "Analytical",
                    "Mindful",
                    "Tech Savvy",
                    "Young & Hip",
                    "Good Energy",
                    "Real Talk",
                  ].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={editor.memory_enabled}
                  onChange={(e: any) =>
                    setEditor({ ...editor, memory_enabled: e.target.checked })
                  }
                />
                Use these approved agent memories when conversation memory is
                enabled
              </label>
              <label>
                Approved memories (one per line)
                <textarea
                  value={editor.memories?.join("\n") || ""}
                  onChange={(e: any) =>
                    setEditor({
                      ...editor,
                      memories: e.target.value.split("\n").filter(Boolean),
                    })
                  }
                />
              </label>
              <h2>This agent’s environment</h2>
              <label>
                Appearance
                <select
                  value={editor.appearance_mode || "inherit"}
                  onChange={(e: any) =>
                    setEditor({ ...editor, appearance_mode: e.target.value })
                  }
                >
                  <option value="inherit">Use AELIO Default</option>
                  <option value="custom">Customize This Agent</option>
                </select>
              </label>
              <p>
                Visual settings never change personality, specialty or memory.
                Saved custom settings remain available when you switch back.
              </p>
              {editor.appearance_mode === "custom" && (
                <AppearanceControls
                  value={editor.appearance || {}}
                  onChange={(v: any) => setEditor({ ...editor, appearance: v })}
                  backgrounds={BACKGROUNDS}
                  allowFile={!!session}
                  onUpload={async (f: File) => {
                    try {
                      const file = await upload(f, "users");
                      setEditor({
                        ...editor,
                        appearance: {
                          ...editor.appearance,
                          background: "Custom Upload",
                          file_id: file.id,
                        },
                      });
                    } catch (e: any) {
                      setErr(friendly(e));
                    }
                  }}
                />
              )}
              <button>Save agent</button>
            </form>
            {editor.id && (
              <>
                <button
                  onClick={async () => {
                    try {
                      const r = await call(
                        "/agents/" + editor.id + "/publish",
                        "POST",
                        { description: editor.specialty },
                      );
                      download(
                        JSON.stringify(r.publication, null, 2),
                        "agent-publication-draft.json",
                        "application/json",
                      );
                    } catch (e: any) {
                      setErr(friendly(e));
                    }
                  }}
                >
                  Export marketplace profile draft
                </button>
                <p>
                  No private messages, memories, files or credentials are
                  included. This export is for your own use; it doesn’t create a public listing.
                </p>
              </>
            )}
          </section>
        ) : panel === "new" ? (
          <NewChat agents={agents} onCreate={newThread} />
        ) : panel === "reminders" ? (
          <Career
            items={items}
            notifications={notifications}
            records={careerRecords}
            refresh={() => show("reminders")}
            setErr={setErr}
          />
        ) : panel === "files" ? (
          <section className="panel">
            <h1>Your private files</h1>
            <label>
              Upload document or media
              <input
                type="file"
                onChange={async (e: any) => {
                  try {
                    if (e.target.files?.[0]) {
                      await upload(e.target.files[0]);
                      await show("files");
                    }
                  } catch (e: any) {
                    setErr(friendly(e));
                  }
                }}
              />
            </label>
            <p>
              25 MB per file. 250 MB total. Files remain private. Inference
              currently accepts text, JSON and PDF up to 1 MB; media storage
              does not imply voice or vision inference.
            </p>
            {files.map((f) => (
              <article key={f.id}>
                <b>{f.name}</b>
                <p>
                  {Math.ceil(f.size_bytes / 1024)} KB · {f.category}
                </p>
                <button
                  onClick={async () => {
                    try {
                      const url = await fileURL(f.id);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = f.name;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } catch (e: any) {
                      setErr(friendly(e));
                    }
                  }}
                >
                  Download
                </button>
                <button
                  onClick={async () => {
                    try {
                      await call("/files/" + f.id, "DELETE");
                      show("files");
                    } catch (e: any) {
                      setErr(friendly(e));
                    }
                  }}
                >
                  Delete
                </button>
              </article>
            ))}
          </section>
        ) : home ? (
          <DreamHome
            name={account?.user?.display_name}
            direct={homeDraft}
            setDirect={setHomeDraft}
            appearance={globalAP}
            onTopic={startTopic}
            recent={threads
              .filter((t) => !t.archived && (messages[t.id]||cache.current[t.id]||t.app_messages||[]).length>0)
              .map((t) => ({
                ...t,
                preview:
                  (messages[t.id] || cache.current[t.id])
                    ?.slice(-1)[0]
                    ?.content?.slice(0, 100) ||
                  t.app_messages?.[0]?.content?.slice(0, 100),
              }))}
            onResume={select}
            onNavigate={navigate}
            onSend={sendFromHome}
            sending={homeSending}
            consent={consent}
            onConsent={setConsent}
            files={homeFiles}
            onRemoveFile={(id: string) =>
              setHomeFiles((previous) => previous.filter((f) => f.id !== id))
            }
            signedIn={!!session}
            error={err}
            voiceEnabled={voiceEnabled}
            onFile={async (file: File) => {
              try {
                if (file.size > 1000000)
                  throw Error("Choose an attachment of 1 MB or smaller.");
                const uploaded = await upload(file, "documents");
                setHomeFiles((previous) => [...previous, uploaded].slice(0, 3));
              } catch (error: any) {
                setErr(friendly(error));
              }
            }}
          />
        ) : (
          <section
            className="chat"
            style={
              {
                "--scene": bg ? `url("${bg}")` : "none",
                "--chat-base":
                  ap.background === "Minimal Black"
                    ? "#08090d"
                    : ap.background === "Minimal White"
                      ? "#fffdf8"
                      : "var(--page)",
                "--dim": (ap.dim ?? 45) / 100,
                "--blur": (ap.blur || 0) + "px",
                "--outgoing":
                  ap.outgoing ||
                  (design.id === "ocean-fresh"
                    ? "#296d85"
                    : design.id === "chocolate-cream"
                      ? "#795139"
                      : "#d95713"),
                "--incoming":
                  ap.incoming ||
                  (design.light
                    ? "#fff8f1"
                    : design.id === "chocolate-cream"
                      ? "#31211c"
                      : "#181b23"),
                "--message-text":
                  ap.text || (design.light ? "#17191f" : "#fff9f0"),
              } as any
            }
          >
            <div className="chat-header">
              <AgentAvatar agent={activeAgents[0]} group={activeAgents.length>1}/>
              <div>
                <h1>{cur?.permanent_key==='dream-team'?'Dream Team':activeAgents.length===1?(companion(activeAgents[0]?.kind)?.title||cur?.title||'AELIO'):cur?.title||'AELIO'}</h1>
                <p>
                  {cur?.subtitle ||
                    activeAgents.map((a: any) => a.subtitle).join(" · ") ||
                    "Your Original Main Pal"}
                </p>
              </div>
              {isMila && (
                <a className="path-link" href="https://mypathd.com">
                  Go to Your PATH ↗
                </a>
              )}
              {session && cur && (
                <button
                  onClick={() => show("conversation-settings")}
                  aria-label="Conversation settings"
                >
                  ⚙
                </button>
              )}
            </div>
            <div
              className="messages" ref={messageScroller} onScroll={()=>{const element=messageScroller.current;if(element)followScroll.current=element.scrollHeight-element.scrollTop-element.clientHeight<100;}}
              aria-live="polite"
              aria-busy={!!busy[cur?.id]}
            >
              {!(messages[cur?.id] || []).length && (
                <div className="welcome">
                  <h2>{cur?.permanent_key==="dream-team"?"Meet your Dream Team.":"Hey, I’m "+(activeAgents[0]?.name||"AELIO")+"."}</h2>
                  <p>
                    {isMila
                      ? account?.preferences?.mila_welcomed
                        ? "Your career matters. So does your life outside of it. What are we working toward?"
                        : "My Inspiration, Life & Ambition. Your homegirl who wants to see you win — in your career and in life. What are we working toward?"
                      : "What’s on your mind today?"}
                  </p>
                  {isMila && !account?.preferences?.mila_welcomed && (
                    <button
                      onClick={async () => {
                        try {
                          await call("/account", "PATCH", {
                            mila_welcomed: true,
                          });
                          reload();
                        } catch (e: any) {
                          setErr(friendly(e));
                        }
                      }}
                    >
                      Got it — skip introduction
                    </button>
                  )}
                  <div className="prompts">
                    {[
                      "Help me untangle an idea",
                      "Let’s plan my week",
                      "I could use some motivation",
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() =>
                          setDrafts((d) => ({ ...d, [cur?.id]: s }))
                        }
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {(messages[cur?.id] || []).map((m: any) => (
                <article key={m.id} className={"bubble " + m.role}>
                  {m.role === "assistant" && <b className="message-speaker"><AgentAvatar agent={agents.find(a=>a.id===m.agent_id||a.name===m.speaker)||activeAgents[0]}/>{m.speaker || "AELIO"}</b>}
                  <Markdown text={m.content}/>
                  {m.role === "assistant" && session && (
                    <button
                      className="save-output"
                      onClick={async () => {
                        try {
                          await upload(
                            new File([m.content], "agent-output.txt", {
                              type: "text/plain",
                            }),
                            "generated-assets",
                            cur.id,
                          );
                          setErr("Output saved to your private files.");
                        } catch (e: any) {
                          setErr(friendly(e));
                        }
                      }}
                    >
                      Save output
                    </button>
                  )}
                </article>
              ))}
              {busy[cur?.id] && waiting[cur?.id] && (
                <p className="writing" role="status">
                  Writing…
                </p>
              )}
              <div ref={end} />
            </div>
            <div className="compose-area">
              {busy[cur?.id]&&<button type="button" onClick={stopGeneration}>Stop generation</button>}
              {!busy[cur?.id]&&retryable[cur?.id]&&<button type="button" onClick={retryGeneration}>Retry response</button>}
              {(handoffs[cur?.id] || []).map((proposal, index) => (
                <HandoffCard
                  proposal={proposal}
                  key={index}
                  onMila={() => {
                    const mila = agents.find((a) => a.kind === "mila");
                    const existing = threads.find(
                      (t) =>
                        t.participants.length === 1 &&
                        t.participants[0] === mila?.id,
                    );
                    if (existing) select(existing);
                    else if (mila) newThread([mila.id], "MILA");
                    else navigate("account");
                  }}
                />
              ))}
              {(proposals[cur?.id] || []).map((p) => (
                <article key={p.proposal_id}>
                  <b>Reminder draft: {p.title}</b>
                  <p>
                    {new Date(p.due_at).toLocaleString()} · {p.timezone} ·{" "}
                    {p.recurrence}
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        await call("/career/reminders", "POST", {
                          title: p.title,
                          due_at: p.due_at,
                          timezone: p.timezone,
                          recurrence: p.recurrence,
                        });
                        setProposals((ps) => ({
                          ...ps,
                          [cur.id]: (ps[cur.id] || []).filter(
                            (x) => x.proposal_id !== p.proposal_id,
                          ),
                        }));
                        setErr(
                          "Reminder confirmed and saved. View Reminders for its schedule.",
                        );
                      } catch (e: any) {
                        setErr(friendly(e));
                      }
                    }}
                  >
                    Confirm reminder
                  </button>
                </article>
              ))}
              {isMila&&<label className="disclosure">MILA’s communication style<select aria-label="MILA communication style" value={account?.preferences?.mila_style||'homegirl'} onChange={async(event:any)=>{try{const mila_style=event.target.value;await call('/account','PATCH',{mila_style});if(account)setAccount({...account,preferences:{...account.preferences,mila_style}});}catch(error){setErr(friendly(error));}}}>{['Homegirl','CEO','Auntie','Advisor','Teacher','Mom'].map(name=><option value={name.toLowerCase()} key={name}>{name}</option>)}</select></label>}
              {isMila && (
                <label className="disclosure">
                  <input
                    type="checkbox"
                    checked={allowReminders}
                    onChange={(e: any) => setAllowReminders(e.target.checked)}
                  />
                  Allow MILA to draft reminders for my confirmation
                </label>
              )}
              {activeAgents.length > 1 && (
                <label>
                  Address
                  <select
                    value={target}
                    onChange={(e: any) => setTarget(e.target.value)}
                  >
                    <option value="">{cur.permanent_key==='dream-team'?'Let the team choose':activeAgents[0]?.name}</option>{cur.permanent_key==='dream-team'&&<option value={activeAgents[0]?.id}>{activeAgents[0]?.name}</option>}
                    {activeAgents.slice(1).map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                    <option value="group">{cur.permanent_key==='dream-team'?'The team chooses relevant speakers':'The group (up to four agents)'}</option>
                  </select>
                </label>
              )}
              {!consent && (
                <label className="disclosure">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e: any) => {
                      setConsent(e.target.checked);
                      if (session)
                        call("/account", "PATCH", {
                          external_ai_consent: e.target.checked,
                        }).catch((x) => setErr(friendly(x)));
                    }}
                  />
                  I agree to send these messages and selected files to the
                  external AI service. Replies may be inaccurate.
                  AELIO Native is still in research.
                </label>
              )}
              <form
                className="composer"
                onSubmit={(e: any) => {
                  e.preventDefault();
                  send();
                }}
              >
                {session && (
                  <label
                    className="attach"
                    title="Attach a text, JSON or PDF file"
                  >
                    ＋
                    <input
                      aria-label="Attach file"
                      type="file"
                      accept=".txt,.md,.json,.pdf"
                      onChange={async (e: any) => {
                        try {
                          if (e.target.files?.[0]) {
                            const f = await upload(
                              e.target.files[0],
                              "documents",
                              cur.id,
                            );
                            setAttachments((a) => [...a, f].slice(0, 3));
                          }
                        } catch (e: any) {
                          setErr(friendly(e));
                        }
                      }}
                    />
                  </label>
                )}
                <textarea onKeyUp={(e:any)=>{const match=e.currentTarget.value.slice(0,e.currentTarget.selectionStart).match(/@([a-z]*)$/i);setMention(match?match[1]:"__closed");}}
                  ref={input}
                  aria-label="Message"
                  rows={2}
                  value={drafts[cur?.id] || ""}
                  placeholder={"Message " + (cur?.title || "AELIO") + "…"}
                  onChange={(e: any) =>
                    setDrafts((d) => ({ ...d, [cur?.id]: e.target.value }))
                  }
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button
                  aria-label="Send message"
                  disabled={!cur || busy[cur.id] || !drafts[cur.id]?.trim()}
                >
                  ↗
                </button>
              </form>
              {activeAgents.length>1&&mention!=="__closed"&&drafts[cur?.id]?.includes('@')&&<div className="mention-choices" role="group" aria-label="Mention a companion">{activeAgents.filter((a:any)=>a.name.toLowerCase().startsWith(mention.toLowerCase())).map((a:any)=><button key={a.id} onClick={()=>{setDrafts(d=>({...d,[cur.id]:(d[cur.id]||'').replace(/@[a-z]*$/i,'@'+a.name+' ')}));setMention('__closed');input.current?.focus();}}>{a.name}</button>)}</div>}
              {attachments.map((f) => (
                <button
                  key={f.id}
                  onClick={() =>
                    setAttachments((a) => a.filter((x) => x.id !== f.id))
                  }
                >
                  {f.name} ×
                </button>
              ))}
              {!session && (
                <p className="guest-note">
                  {remaining ?? 10} guest messages remaining ·{" "}
                  <button onClick={() => show("account")}>
                    Sign in to save your conversation
                  </button>
                </p>
              )}
              {session && (
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      const r = await call("/guest/claim", "POST", {});
                      setErr(r.count + " guest conversation saved.");
                      reload();
                    } catch (e: any) {
                      setErr(friendly(e));
                    }
                  }}
                >
                  Import my eligible guest conversation
                </button>
              )}
            </div>
          </section>
        )}
        {panel === "conversation-settings" && cur && (
          <section className="settings-panel panel">
            <button onClick={() => setPanel("")}>Close settings</button>
            <h2>My Pal, My Space</h2>
            <label>
              Conversation title
              <input
                value={cur.title}
                disabled={cur.permanent_key==='dream-team'}
                onChange={(e: any) => setCur({ ...cur, title: e.target.value })}
                onBlur={() => change({ title: cur.title })}
              />
            </label>
            <label>
              Conversation topic / subtitle
              <input
                value={cur.subtitle}
                disabled={cur.permanent_key==='dream-team'}
                onChange={(e: any) =>
                  setCur({ ...cur, subtitle: e.target.value })
                }
                onBlur={() => change({ subtitle: cur.subtitle })}
              />
            </label>
            <button disabled={busy[cur.id]} onClick={() => send(true)}>
              Suggest subtitle with AI
            </button>
            {suggestion && (
              <div>
                <p>{suggestion}</p>
                <button
                  onClick={() => {
                    change({ subtitle: suggestion.slice(0, 160) });
                    setSuggestion("");
                  }}
                >
                  Apply suggestion
                </button>
              </div>
            )}
            <label>
              <input
                type="checkbox"
                checked={cur.memory_enabled}
                onChange={(e: any) =>
                  change({ memory_enabled: e.target.checked })
                }
              />
              Use this agent’s approved memories
            </label>
            <p>
              Conversation overrides → custom agent → your global AELIO
              appearance. Group chats use the global default unless overridden
              here.
            </p>
            <AppearanceControls
              value={conversationAP}
              onChange={setAppearance}
              backgrounds={BACKGROUNDS}
              allowFile={!!session}
              onUpload={async (f: File) => {
                try {
                  const file = await upload(f, "users");
                  setAppearance({
                    ...conversationAP,
                    background: "Custom Upload",
                    file_id: file.id,
                  });
                } catch (e: any) {
                  setErr(friendly(e));
                }
              }}
            />
            <button onClick={() => change({ appearance: conversationAP })}>
              Save appearance
            </button>
            <button onClick={() => setAppearance(null)}>Cancel preview</button>
            <button onClick={() => change({ appearance: {} })}>
              Use inherited appearance
            </button>
            <button onClick={() => change({ pinned: !cur.pinned })}>
              {cur.pinned ? "Unpin" : "Pin"} conversation
            </button>
            <button onClick={() => change({ archived: !cur.archived })}>
              {cur.archived ? "Unarchive" : "Archive"}
            </button>
            {!cur.permanent_key&&<button onClick={remove}>Delete conversation</button>}
          </section>
        )}
      </FeatureBoundary></main>
      <nav className="mobile-nav" aria-label="Main navigation">
        {[
          ["home", "Home", "home"],
          ["agents", "Agents", "agents"],
          ["discover", "Discover", "compass"],
          ["settings", "Settings", "settings"],
        ].map(([view, label, icon]) => (
          <button
            key={view}
            aria-label={label}
            aria-current={
              (view === "home" ? home && !panel : panel === view)
                ? "page"
                : undefined
            }
            onClick={() =>
              navigate(view === "agents" && !session ? "account" : view)
            }
          >
            <Icon name={icon} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
function ProjectWorkspace({
  files,
  threads,
  onResume,
  refresh,
  setErr,
  signedIn,
  onSignIn,
}: any) {
  if (!signedIn)
    return (
      <section className="panel">
        <h1>Your projects</h1>
        <p>Sign in to access your private project files and outputs.</p>
        <button onClick={onSignIn}>Sign in</button>
      </section>
    );
  const projectFiles = files.filter((file: any) =>
    ["code-projects", "generated-assets"].includes(file.category),
  );
  return (
    <section className="panel project-workspace">
      <p className="workspace-eyebrow">YOUR WORK, WITH ROOM TO GROW</p>
      <h1>Project files & outputs</h1>
      <label>
        Add a private project file
        <input
          type="file"
          onChange={async (event: any) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              await upload(file, "code-projects");
              refresh();
            } catch (error: any) {
              setErr(friendly(error));
            }
            event.target.value = "";
          }}
        />
      </label>
      {projectFiles.length ? (
        projectFiles.map((file: any) => (
          <article key={file.id}>
            <strong>{file.name}</strong>
            <small>
              {Math.ceil(file.size_bytes / 1024)}KB · {file.category}
            </small>
            <button
              onClick={async () => {
                try {
                  const url = await fileURL(file.id);
                  const anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = file.name;
                  anchor.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (error: any) {
                  setErr(friendly(error));
                }
              }}
            >
              Download
            </button>
            <button
              onClick={async () => {
                if (!confirm("Delete this private file?")) return;
                try {
                  await call("/files/" + file.id, "DELETE");
                  refresh();
                } catch (error: any) {
                  setErr(friendly(error));
                }
              }}
            >
              Delete file
            </button>
          </article>
        ))
      ) : (
        <p>Your saved project files and generated outputs will appear here.</p>
      )}
      <h2>Continue a conversation</h2>
      {threads
        .filter((t: any) => !t.archived)
        .slice(0, 8)
        .map((t: any) => (
          <button key={t.id} onClick={() => onResume(t)}>
            {t.title}
          </button>
        ))}
      <p>
        <a href="/brain/my/">Open existing Brain projects and earlier tools</a>
      </p>
      <p className="muted">
        Files use the existing private storage and ownership checks. This
        workspace does not invent project records or claim code execution is
        available.
      </p>
    </section>
  );
}
function relativeTime(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? minutes + "m"
      : minutes < 1440
        ? Math.floor(minutes / 60) + "h"
        : Math.floor(minutes / 1440) + "d";
}
function NewChat({ agents, onCreate }: any) {
  const [ids, setIds] = useState<string[]>([]),
    [title, setTitle] = useState(""),
    [product, setProduct] = useState("aelio");
  return (
    <section className="panel">
      <h1>Start a conversation</h1>
      <form
        onSubmit={(e: any) => {
          e.preventDefault();
          onCreate(ids, title || "New conversation", product);
        }}
      >
        <label>
          Conversation name
          <input
            value={title}
            onChange={(e: any) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Space
          <select
            value={product}
            onChange={(e: any) => {
              setProduct(e.target.value);
              setIds([]);
            }}
          >
            <option value="aelio">AELIO</option>
            <option value="pathd">PATHD Career Space</option>
          </select>
        </label>
        {agents
          .filter((a: any) => product === "aelio" || a.kind !== "custom")
          .map((a: any) => (
            <label key={a.id}>
              <input
                type="checkbox"
                checked={ids.includes(a.id)}
                onChange={(e: any) =>
                  setIds(
                    e.target.checked
                      ? [...ids, a.id]
                      : ids.filter((id) => id !== a.id),
                  )
                }
              />
              {a.name} · {a.subtitle}
            </label>
          ))}
        <button disabled={!ids.length}>
          Create {ids.length > 1 ? "group chat" : "chat"}
        </button>
      </form>
    </section>
  );
}
function Account({ account, reload, setPanel, setErr }: any) {
  const [name, setName] = useState(account?.user.display_name || ""),
    [recover, setRecover] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [pw, setPw] = useState("");
  if (!account)
    return (
      <section className="panel">
        <h1>Let’s open your space.</h1>
        <p>
          Your sign-in is safe. I’m having trouble opening your account right now.
          Let’s try again.
        </p>
        <button onClick={reload}>Retry</button>
      </section>
    );
  if (recover)
    return (
      <AuthPanel
        enroll
        onDone={() => {
          setRecover(false);
          reload();
        }}
      />
    );
  return (
    <section className="panel">
      <h1>Your account</h1>
      <p>{account.user.email}</p>
      <label>
        Display name
        <input value={name} onChange={(e: any) => setName(e.target.value)} />
      </label>
      <button
        onClick={async () => {
          try {
            await call("/account", "PATCH", { display_name: name });
            reload();
          } catch (e: any) {
            setErr(friendly(e));
          }
        }}
      >
        Save name
      </button>
      <h2>Connected Apps</h2>
      {account.plans.map((p: any) => (
        <article key={p.product}>
          <b>{p.product.toUpperCase()} — Connected</b>
          <p>
            {p.plan} ·{" "}
            {p.unlimited
              ? "Approved personal/founder allowance"
              : p.credits + " message credits remaining this month"}
          </p>
          <a href={p.product === "pathd" ? "https://mypathd.com" : "/chat/"}>
            Open {p.product.toUpperCase()}
          </a>
        </article>
      ))}
      <p>Your subscriptions and usage stay separate. Free is the available plan today.</p>
      {account.role === "founder" && (
        <a href="/studiobrain/">Open Studio Brain (MFA required)</a>
      )}
      <p>
        <a href="/brain/my/">
          Open existing Brain agents, wallet and earlier conversation history
        </a>
      </p>
      <h2>Privacy & recovery</h2>
      {["external_ai_consent", "career_consent", "career_outside_mila"].map(
        (k) => (
          <label key={k}>
            <input
              type="checkbox"
              checked={!!account.preferences[k]}
              onChange={async (e: any) => {
                try {
                  await call("/account", "PATCH", { [k]: e.target.checked });
                  reload();
                } catch (e: any) {
                  setErr(friendly(e));
                }
              }}
            />
            {
              {
                external_ai_consent: "Allow external AI processing",
                career_consent:
                  "Allow MILA to use my authorized PATHD career context",
                career_outside_mila: "Allow career context outside MILA chats",
              }[k]
            }
          </label>
        ),
      )}
      <button onClick={() => setRecover(true)}>
        Update recovery methods (reauthentication required)
      </button>
      <button
        onClick={async () => {
          try {
            download(
              JSON.stringify(await call("/account/export"), null, 2),
              "AELIO-data-export.json",
              "application/json",
            );
          } catch (e: any) {
            setErr(friendly(e));
          }
        }}
      >
        Export my data
      </button>
      <button onClick={() => setConfirmDelete(!confirmDelete)}>
        Delete shared account…
      </button>
      {confirmDelete && (
        <div>
          <p>
            This removes your shared AELIO and PATHD identity and owned data. It
            affects both websites.
          </p>
          <input
            type="password"
            aria-label="Confirm password for account deletion"
            value={pw}
            onChange={(e: any) => setPw(e.target.value)}
          />
          <button
            onClick={async () => {
              const phrase = prompt(
                "Enter DELETE MY SHARED ACCOUNT to confirm.",
              );
              if (!phrase) return;
              try {
                await call("/account/delete", "POST", {
                  confirm: phrase,
                  password: pw,
                });
                await auth?.signOut();
                location.assign("/chat/");
              } catch (e: any) {
                setErr(friendly(e));
              }
            }}
          >
            Confirm shared account deletion
          </button>
        </div>
      )}
      <button
        onClick={async () => {
          try {
            await auth?.signOut();
            location.assign("/chat/");
          } catch (e: any) {
            await reload();
            setPanel("");
            setErr(friendly(e));
          }
        }}
      >
        Sign out
      </button>
      <button onClick={() => setPanel("")}>Back to Chat</button>
    </section>
  );
}
function Career({ items, notifications, records, refresh, setErr }: any) {
  const [title, setTitle] = useState(""),
    [due, setDue] = useState(""),
    [recurrence, setRecurrence] = useState("once"),
    [source, setSource] = useState(""),
    [recordTitle, setRecordTitle] = useState(""),
    [kind, setKind] = useState("goal"),
    [detail, setDetail] = useState("");
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  async function act(fn: () => Promise<any>) {
    try {
      await fn();
      refresh();
    } catch (e: any) {
      setErr(friendly(e));
    }
  }
  return (
    <section className="panel">
      <h1>Career & life reminders</h1>
      <p>
        In-app reminders use your timezone: {zone}. Job-search criteria can be
        saved; automatic job monitoring is unavailable until an authorized
        provider is connected.
      </p>
      <form
        onSubmit={(e: any) => {
          e.preventDefault();
          act(() =>
            call("/career/reminders", "POST", {
              title,
              due_at: new Date(due).toISOString(),
              timezone: zone,
              recurrence,
              source_id: source || null,
            }),
          );
        }}
      >
        <label>
          Reminder
          <input
            required
            value={title}
            onChange={(e: any) => setTitle(e.target.value)}
          />
        </label>
        <label>
          When
          <input
            required
            type="datetime-local"
            value={due}
            onChange={(e: any) => setDue(e.target.value)}
          />
        </label>
        <label>
          Repeat
          <select
            value={recurrence}
            onChange={(e: any) => setRecurrence(e.target.value)}
          >
            <option>once</option>
            <option>daily</option>
            <option>weekly</option>
          </select>
        </label>
        <label>
          Related opportunity
          <select
            value={source}
            onChange={(e: any) => setSource(e.target.value)}
          >
            <option value="">None</option>
            {records.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <button>Create reminder</button>
      </form>
      {items.map((r: any) => (
        <article key={r.id}>
          <h2>{r.title}</h2>
          <p>
            {new Date(r.due_at).toLocaleString()} · {r.recurrence}{" "}
            {r.paused ? "· Paused" : ""}
          </p>
          <button
            onClick={() =>
              act(() =>
                call("/career/reminders/" + r.id, "PATCH", {
                  paused: !r.paused,
                }),
              )
            }
          >
            {r.paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={() => {
              const t = prompt("Reminder title", r.title);
              if (t)
                act(() =>
                  call("/career/reminders/" + r.id, "PATCH", { title: t }),
                );
            }}
          >
            Edit title
          </button>
          <button
            onClick={() => {
              const t = prompt(
                "New date and time with timezone (ISO format)",
                r.due_at,
              );
              if (t)
                act(() =>
                  call("/career/reminders/" + r.id, "PATCH", { due_at: t }),
                );
            }}
          >
            Reschedule
          </button>
          <button
            onClick={() =>
              act(() => call("/career/reminders/" + r.id, "DELETE"))
            }
          >
            Delete
          </button>
        </article>
      ))}
      <h2>Notifications</h2>
      {!notifications.length && <p>No notifications yet.</p>}
      {notifications.map((n: any) => (
        <article key={n.id}>
          {n.title} · {new Date(n.scheduled_for).toLocaleString()}
          {!n.read_at && (
            <button
              onClick={() =>
                act(() => call("/career/notifications/" + n.id, "PATCH", {}))
              }
            >
              Mark read
            </button>
          )}
        </article>
      ))}
      <h2>Career context</h2>
      <form
        onSubmit={(e: any) => {
          e.preventDefault();
          act(() =>
            call("/career/records", "POST", {
              kind,
              title: recordTitle,
              data: { notes: detail },
            }),
          );
        }}
      >
        <label>
          Type
          <select value={kind} onChange={(e: any) => setKind(e.target.value)}>
            {["profile", "job", "application", "event", "goal", "search"].map(
              (k) => (
                <option key={k}>{k}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Title
          <input
            required
            value={recordTitle}
            onChange={(e: any) => setRecordTitle(e.target.value)}
          />
        </label>
        <label>
          Details
          <textarea
            value={detail}
            onChange={(e: any) => setDetail(e.target.value)}
          />
        </label>
        <button>Save career record</button>
      </form>
      {records.map((r: any) => (
        <article key={r.id}>
          <b>{r.title}</b>
          <p>{r.kind}</p>
          <button
            onClick={() => act(() => call("/career/records/" + r.id, "DELETE"))}
          >
            Delete
          </button>
        </article>
      ))}
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
