import { useState, useEffect, useRef } from "react";
import { call } from "./client";
import { Icon, Orb } from "./Icon";
export const TOPICS = [
  [
    "Just Chat",
    "Chop it up about anything",
    "Let’s just chat.",
    "just-chat.webp",
  ],
  [
    "New Ideas",
    "Brainstorm & create",
    "I’d like to brainstorm some new ideas. Help me explore possibilities.",
    "new-ideas.webp",
  ],
  [
    "Travel Ideas",
    "Get inspired. Plan it out.",
    "Help me plan a trip. Ask about my destination, budget and travel dates.",
    "travel.webp",
  ],
  [
    "Lunch Ideas",
    "Nearby spots & meals",
    "Help me find lunch ideas. Ask about my preferences and location before suggesting nearby places.",
    "food.webp",
  ],
  [
    "Business",
    "Strategy & next steps",
    "Help me think through a business idea or challenge.",
    "business.webp",
  ],
  [
    "Date Night",
    "Vibes, ideas & planning",
    "Help me plan a thoughtful date night. Ask what we enjoy and our budget.",
    "date-night.webp",
  ],
  [
    "Random Thoughts",
    "Follow your curiosity",
    "Let’s explore an interesting question together.",
    "",
  ],
  [
    "Conspiracies",
    "Curiosity, with evidence",
    "Let’s discuss mysteries and unusual theories, clearly distinguishing evidence from speculation.",
    "",
  ],
  [
    "Bible Verse",
    "A moment of reflection",
    "Share an accurately referenced Bible verse. Name the translation and invite a reflection.",
    "",
  ],
  [
    "Affirmations",
    "A little encouragement",
    "Help me create a few thoughtful affirmations for today.",
    "",
  ],
  [
    "Inspiration",
    "Find your spark",
    "I could use some creative encouragement today.",
    "",
  ],
  [
    "Quick News",
    "Reliable, attributed sources",
    "Help me catch up on current news with reliable sources, links and publication dates. If live source access is unavailable, say so; do not present older knowledge as today’s news.",
    "",
  ],
  ["More", "Make it your own", "I have something else on my mind.", ""],
];
export function dayContext(date = new Date()) {
  const h = date.getHours();
  return h >= 5 && h < 12
    ? {
        greeting: "Good Morning",
        picks: ["Inspiration", "Bible Verse", "Affirmations"],
        food: "Lunch",
      }
    : h >= 12 && h < 17
      ? {
          greeting: "Good Afternoon",
          picks: ["Lunch Ideas", "Business", "Travel Ideas"],
          food: "Lunch",
        }
      : h >= 17 && h < 22
        ? {
            greeting: "Good Evening",
            picks: ["Date Night", "Inspiration", "Just Chat"],
            food: "Dinner",
          }
        : {
            greeting: "Good Night",
            picks: ["Random Thoughts", "Affirmations", "Just Chat"],
            food: "Dinner",
          };
}
const FEATURES = [
  {
    label: "IDEAS",
    title: "Turn your ideas into reality.",
    image: "ideas-horizon.webp",
    topic: 1,
  },
  {
    label: "GROWTH",
    title: "A better you, every day.",
    image: "new-ideas.webp",
    topic: 10,
  },
  {
    label: "TRAVEL",
    title: "Explore new places.",
    image: "just-chat.webp",
    topic: 2,
  },
  {
    label: "CREATIVE",
    title: "Bring your vision to life.",
    image: "business.webp",
    topic: 1,
  },
];
interface DreamHomeProps {
  name?: string;
  onTopic: (topic: string[] | undefined) => void;
  appearance: any;
  recent: any[];
  onResume: (thread: any) => void;
  onNavigate: (view: string) => void;
  direct: string;
  setDirect: (value: string | ((previous: string) => string)) => void;
  onSend: () => Promise<void>;
  sending: boolean;
  consent: boolean;
  onConsent: (value: boolean) => void;
  files: any[];
  onFile: (file: File) => Promise<void>;
  onRemoveFile: (id: string) => void;
  signedIn: boolean;
  error?: string;
  voiceEnabled: boolean;
}
export function DreamHome({
  name,
  onTopic,
  appearance,
  recent,
  onResume,
  onNavigate,
  direct,
  setDirect,
  onSend,
  sending,
  consent,
  onConsent,
  files,
  onFile,
  onRemoveFile,
  signedIn,
  error,
  voiceEnabled,
}: DreamHomeProps) {
  const [now, setNow] = useState(new Date()),
    [feature, setFeature] = useState(0),
    [listening, setListening] = useState(false),
    [voiceError, setVoiceError] = useState(""),
    [actions, setActions] = useState(false),
    [uploading, setUploading] = useState(false);
  const recognition = useRef<any>(null),
    homeInput = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActions(false);
    };
    addEventListener("keydown", close);
    return () => removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => {
      clearInterval(timer);
      recognition.current?.abort();
    };
  }, []);
  const context = dayContext(now),
    selected = FEATURES[feature];
  function dictate() {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceError(
        "Voice input is unavailable in this browser. You can still type.",
      );
      return;
    }
    if (listening) {
      recognition.current?.stop();
      return;
    }
    try {
      const r = new SR();
      recognition.current = r;
      r.lang = navigator.language;
      r.interimResults = false;
      r.onresult = (event: any) =>
        setDirect((previous: string) =>
          [previous, event.results[0][0].transcript]
            .filter(Boolean)
            .join(" ")
            .slice(0, 16000),
        );
      r.onerror = () => {
        setListening(false);
        setVoiceError(
          "The microphone or browser speech service is unavailable. You can type instead.",
        );
      };
      r.onend = () => setListening(false);
      r.start();
      setListening(true);
      setVoiceError("");
    } catch {
      setVoiceError("Speech input could not start. You can type instead.");
    }
  }
  return (
    <div className="premium-home home-layout">
      <section className="hero-space">
        <div className="home-greeting">
          <p className="eyebrow">YOUR SPACE. YOUR ENERGY.</p>
          <h1>
            {context.greeting}{" "}
            <span className="greeting-symbol">
              <Icon
                name={
                  context.greeting === "Good Morning" ||
                  context.greeting === "Good Afternoon"
                    ? "sun"
                    : "moon"
                }
                size={40}
              />
            </span>
          </h1>
          <p className="hero-question">
            What’s on your mind<span className="desktop-word"> today</span>?
          </p>
        </div>
        <div className="orb-stage">
          <Orb
            state={
              listening
                ? "listening"
                : sending
                  ? "thinking"
                  : error
                    ? "error"
                    : "idle"
            }
          />
        </div>
        <div className="hero-compose-wrap">
          <form
            className="hero-composer"
            onSubmit={(event: any) => {
              event.preventDefault();
              if (direct.trim() && !sending && !uploading) onSend();
            }}
          >
            <button
              type="button"
              className="attachment-trigger"
              aria-label="Attachments and actions"
              aria-expanded={actions}
              onClick={() => setActions(!actions)}
            >
              <Icon name={actions ? "close" : "plus"} />
            </button>
            <label className="sr-only" htmlFor="home-message">
              Talk to AELIO
            </label>
            <textarea
              ref={homeInput}
              id="home-message"
              rows={1}
              maxLength={16000}
              placeholder="Talk to AELIO…"
              value={direct}
              onChange={(event: any) => setDirect(event.target.value)}
            />
            <button
              type="button"
              className="voice-trigger"
              aria-label={listening ? "Stop listening" : "Start voice input"}
              title={
                voiceEnabled
                  ? "Browser speech input"
                  : "Enable voice input in Settings"
              }
              disabled={!voiceEnabled || sending}
              aria-pressed={listening}
              onClick={dictate}
            >
              <Icon name="mic" />
            </button>
            <button
              className="hero-send"
              aria-label="Send to AELIO"
              disabled={!direct.trim() || sending || uploading}
            >
              <Icon name="send" />
            </button>
          </form>
          {actions && (
            <div className="home-attachment-menu">
              <button
                aria-label="Close attachment actions"
                onClick={() => setActions(false)}
              >
                <Icon name="close" size={18} />
              </button>
              {signedIn ? (
                <label>
                  Attach a document
                  <input
                    type="file"
                    accept=".txt,.md,.json,.pdf"
                    disabled={uploading || files.length >= 3}
                    onChange={async (event: any) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      try {
                        await onFile(file);
                        setActions(false);
                      } finally {
                        setUploading(false);
                        event.target.value = "";
                      }
                    }}
                  />
                </label>
              ) : (
                <button onClick={() => onNavigate("account")}>
                  Sign in to attach private files
                </button>
              )}
              <p>
                Up to three text, JSON or PDF files, each up to1MB for AI
                processing.
              </p>
            </div>
          )}
          {files.length > 0 && (
            <div className="home-files">
              {files.map((file) => (
                <span key={file.id}>
                  {file.name}
                  <button
                    aria-label={"Remove " + file.name}
                    onClick={() => onRemoveFile(file.id)}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {!consent && (
            <label className="home-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event: any) => onConsent(event.target.checked)}
              />
              Allow my messages and selected files to be processed by AELIO’s AI
              providers.
            </label>
          )}
          {(listening || voiceError) && (
            <p className="voice-feedback" role="status">
              {listening
                ? "Listening… Your browser’s speech service may process audio remotely."
                : voiceError}
            </p>
          )}
        </div>
        <nav className="quick-actions" aria-label="Quick actions">
          <button
            onClick={() => {
              homeInput.current?.focus();
            }}
          >
            <Icon name="chat" />
            Let’s Talk
          </button>
          <button onClick={() => onNavigate("create")}>
            <Icon name="bulb" />
            Create
          </button>
          <button onClick={() => onNavigate("discover")}>
            <Icon name="compass" />
            Explore
          </button>
          <button
            onClick={() => onNavigate("discover")}
            aria-label="More conversation starters"
          >
            <Icon name="more" />
            <span className="desktop-word">More</span>
          </button>
        </nav>
      </section>
      <section className="discovery-features" aria-label="AELIO possibilities">
        <div className="mobile-feature">
          <button
            className="cinematic-feature"
            onClick={() => onTopic(TOPICS[selected.topic])}
          >
            <img
              src={"/assets/dream/" + selected.image}
              alt=""
              width="700"
              height="300"
              loading="lazy"
            />
            <span className="feature-copy">
              <small>AELIO CAN HELP</small>
              <strong>{selected.title}</strong>
            </span>
            <span className="feature-arrow">
              <Icon name="arrow" />
            </span>
          </button>
          <div
            className="feature-dots"
            role="group"
            aria-label="Featured experiences"
          >
            {FEATURES.map((f, i) => (
              <button
                key={f.label}
                aria-label={"Show " + f.label.toLowerCase() + " feature"}
                aria-pressed={feature === i}
                onClick={() => setFeature(i)}
              />
            ))}
          </div>
        </div>
        <div className="desktop-features">
          {FEATURES.map((f) => (
            <button
              key={f.label}
              className="cinematic-feature"
              onClick={() => onTopic(TOPICS[f.topic])}
            >
              <img
                src={"/assets/dream/" + f.image}
                alt=""
                width="350"
                height="230"
                loading="lazy"
              />
              <span className="feature-copy">
                <small>{f.label}</small>
                <strong>{f.title}</strong>
              </span>
              <span className="feature-arrow">
                <Icon name="arrow" size={18} />
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="recent-home">
        <div className="section-title">
          <h2>RECENT CHATS</h2>
          <button onClick={() => onNavigate("chats")}>
            View all <Icon name="arrow" size={16} />
          </button>
        </div>
        {recent.length ? (
          <div className="recent-cards">
            {recent.slice(0, 4).map((t: any) => (
              <button key={t.id} onClick={() => onResume(t)}>
                <span className="recent-initial">
                  {t.title?.slice(0, 1) || "A"}
                </span>
                <span>
                  <strong>{t.title}</strong>
                  <small>
                    {t.preview || t.subtitle || "Continue your conversation"}
                  </small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="recent-empty">
            <Icon name="chat" />
            <p>
              {signedIn
                ? "Your next conversation starts here."
                : "A little space for your thoughts."}
            </p>
            <small>
              {signedIn
                ? "Your recent chats will appear here."
                : "Try the limited guest chat, or sign in to keep your history."}
            </small>
          </div>
        )}
      </section>
    </div>
  );
}
export function Discover({
  onTopic,
  onNavigate,
  search = "",
  onSearch,
  threads = [],
  onResume,
}: any) {
  const [group, setGroup] = useState("All");
  const groups: Record<string, string[]> = {
    All: TOPICS.map((t) => t[0]),
    Create: ["New Ideas", "Business", "Inspiration"],
    Everyday: [
      "Just Chat",
      "Lunch Ideas",
      "Date Night",
      "Affirmations",
      "Random Thoughts",
    ],
    Explore: ["Travel Ideas", "Conspiracies", "Quick News"],
    Reflect: ["Bible Verse", "Affirmations", "Inspiration"],
  };
  const filtered = TOPICS.filter(
    (t) =>
      groups[group].includes(t[0]) &&
      [t[0], t[1]].join(" ").toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="panel discovery-workspace">
      <p className="workspace-eyebrow">FOLLOW YOUR CURIOSITY</p>
      <h1>A little inspiration. Endless possibilities.</h1>
      <label>
        Find a starting point
        <input
          value={search}
          onChange={(event: any) => onSearch(event.target.value)}
          placeholder="Ideas, travel, affirmations…"
        />
      </label>
      <div
        className="discovery-tabs"
        role="group"
        aria-label="Discovery categories"
      >
        {Object.keys(groups).map((g) => (
          <button
            key={g}
            aria-pressed={group === g}
            onClick={() => setGroup(g)}
          >
            {g}
          </button>
        ))}
      </div>
      {search.trim() &&
        threads.some(
          (t: any) =>
            !t.archived && t.title.toLowerCase().includes(search.toLowerCase()),
        ) && (
          <section className="discovery-chat-results">
            <h2>Conversations</h2>
            {threads
              .filter(
                (t: any) =>
                  !t.archived &&
                  t.title.toLowerCase().includes(search.toLowerCase()),
              )
              .slice(0, 8)
              .map((t: any) => (
                <button key={t.id} onClick={() => onResume(t)}>
                  <Icon name="chat" size={17} />
                  {t.title}
                </button>
              ))}
          </section>
        )}
      <div className="discover-topics">
        {filtered.map((t, i) => (
          <button key={t[0]} onClick={() => onTopic(t)}>
            {t[3] && (
              <img
                src={"/assets/dream/" + t[3]}
                alt=""
                width="320"
                height="180"
                loading="lazy"
              />
            )}
            <span>
              <Icon name={["chat", "bulb", "compass", "sparkle"][i % 4]} />
              <strong>{t[0]}</strong>
              <small>{t[1]}</small>
            </span>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <p>No matching ideas yet. Try a different search.</p>
      )}
      <div className="discover-connections">
        <h2>Beyond your conversation</h2>
        <p>
          Groove Guide for the journey. VYBR8 for the experience. PATHD for your
          next chapter.
        </p>
        <button onClick={() => onNavigate("connected-apps")}>
          Explore connected apps <Icon name="arrow" size={18} />
        </button>
      </div>
      <details className="discover-today">
        <summary>Today, weather & local planning</summary>
        <Today food={dayContext().food} onTopic={onTopic} />
      </details>
    </section>
  );
}
function weatherLabel(code: number) {
  const names: Record<number, string> = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Freezing drizzle",
    57: "Heavy freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe hailstorm",
  };
  return names[code] || "Conditions unavailable";
}
function Today({ food, onTopic }: any) {
  const [query, setQuery] = useState(""),
    [places, setPlaces] = useState<any[]>([]),
    [place, setPlace] = useState<any>(null),
    [weather, setWeather] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const weatherRequest = useRef(0);
  async function load(p: any) {
    const requestId = ++weatherRequest.current;
    setBusy(true);
    setError("");
    setPlace(p);
    setWeather(null);
    try {
      const result = await call(
        `/discover/weather?lat=${encodeURIComponent(p.lat)}&lon=${encodeURIComponent(p.lon)}`,
      );
      if (requestId === weatherRequest.current) setWeather(result);
    } catch (e: any) {
      if (requestId === weatherRequest.current) setError(e.message);
    } finally {
      if (requestId === weatherRequest.current) setBusy(false);
    }
  }
  const mapQuery = encodeURIComponent(
    (food === "Lunch" ? "restaurants for lunch" : "restaurants for dinner") +
      (place ? " near " + place.name : ""),
  );
  return (
    <section className="today-card">
      <div className="section-title">
        <h2>Today</h2>
        <time>
          {new Date().toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </time>
      </div>
      <details className="location-picker">
        <summary>{place ? place.name : "Set your location"}</summary>
        <p>
          Used only for this visit. Location search and forecasts are sent to
          Open-Meteo.
        </p>
        <form
          onSubmit={async (e: any) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              setPlaces(
                (await call("/discover/places?q=" + encodeURIComponent(query)))
                  .places,
              );
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            City or place
            <input
              value={query}
              onChange={(e: any) => setQuery(e.target.value)}
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <button disabled={busy}>Find location</button>
        </form>
        {places.map((p) => (
          <button
            key={p.lat + "," + p.lon}
            onClick={() => {
              setPlaces([]);
              load(p);
            }}
          >
            {p.name}
          </button>
        ))}
        <button
          disabled={busy}
          onClick={() => {
            setError("");
            if (!navigator.geolocation) {
              setError("Location is unsupported. Enter a city instead.");
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (p) =>
                load({
                  lat: p.coords.latitude,
                  lon: p.coords.longitude,
                  name: "Your location",
                }),
              () =>
                setError(
                  "Location was unavailable. You can enter a city instead.",
                ),
              { timeout: 10000, maximumAge: 300000 },
            );
          }}
        >
          Use my location
        </button>
      </details>
      {error && <p role="alert">{error}</p>}
      <div className="weather-card">
        {busy ? (
          <p>Checking current conditions…</p>
        ) : weather ? (
          <>
            <b>
              {Math.round(weather.current.temperature_2m)}°F ·{" "}
              {weatherLabel(weather.current.weather_code)}
            </b>
            <small>
              High {Math.round(weather.daily.temperature_2m_max[0])}° / Low{" "}
              {Math.round(weather.daily.temperature_2m_min[0])}°
            </small>
            <small>
              Observed {weather.current.time.replace("T", " ")} (
              {weather.timezone})
            </small>
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Weather: Open-Meteo
            </a>
          </>
        ) : (
          <p>Choose a location for current weather.</p>
        )}
      </div>
      <a
        className="today-row"
        href="https://vybr8.live/"
        target="_blank"
        rel="noreferrer"
      >
        <span>
          <b>{food} Near You</b>
          <small>Open VYBR8 · website handoff only</small>
        </span>
        <span>↗</span>
      </a>
      <button
        className="today-row"
        onClick={() => onTopic(TOPICS[food === "Lunch" ? 3 : 5])}
      >
        Plan with AELIO <span>›</span>
      </button>
      <details>
        <summary>Your Groove Guide</summary>
        <p>
          Plan destinations and travel stops with AELIO. Live traffic and route
          services aren’t connected.
        </p>
        <button onClick={() => onTopic(TOPICS[2])}>Plan a trip</button>
        <a
          href="https://grooveville.org/guide/"
          target="_blank"
          rel="noreferrer"
        >
          Open Groove Guide ↗
        </a>
      </details>
      <details>
        <summary>VYBR8 experiences</summary>
        <p>
          VYBR8 is available as a website handoff. APIs and private account
          linking are not configured. No external account is linked
          automatically.
        </p>
        <a href="https://vybr8.live/" target="_blank" rel="noreferrer">
          Open VYBR8 ↗
        </a>
        <button onClick={() => onTopic(TOPICS[5])}>
          Explore date night ideas
        </button>
      </details>
    </section>
  );
}
