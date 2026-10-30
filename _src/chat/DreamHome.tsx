import { useState, useEffect, useRef } from "react";
import { call } from "./client";
import { DESIGNS, designOf } from "./design-system";
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
interface DreamHomeProps {
  name?: string;
  onTopic: (topic: string[] | undefined) => void;
  onAppearance: (id?: string) => void;
  appearance: any;
  recent?: any;
  onResume: (thread: any) => void;
  direct: string;
  setDirect: (value: string | ((previous: string) => string)) => void;
}
export function DreamHome({
  name,
  onTopic,
  onAppearance,
  appearance,
  recent,
  onResume,
  direct,
  setDirect,
}: DreamHomeProps) {
  const context = dayContext();
  const [voiceError, setVoiceError] = useState(""),
    [listening, setListening] = useState(false);
  const recognition = useRef<any>(null);
  useEffect(() => () => recognition.current?.abort(), []);
  function dictate() {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceError(
        "Voice input is unavailable in this browser. You can type below.",
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
        setDirect((d: string) =>
          [d, event.results[0][0].transcript]
            .filter(Boolean)
            .join(" ")
            .slice(0, 16000),
        );
      r.onerror = () => {
        setVoiceError(
          "Microphone or browser speech service was unavailable. You can type instead.",
        );
        setListening(false);
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
    <div className="home-layout">
      <section className="dream-home">
        <div className="home-greeting">
          <p className="eyebrow">YOUR SPACE. YOUR ENERGY.</p>
          <h1>
            {context.greeting}
            {name ? `, ${name.split(" ")[0]}` : ""}{" "}
            <span aria-hidden="true">
              {context.food === "Lunch" ? "☀" : "☾"}
            </span>
          </h1>
          <p>What’s the vibe today?</p>
        </div>
        <button className="home-entry" onClick={() => onTopic(TOPICS[0])}>
          <span className="main-pal-orb" aria-hidden="true" />
          <span>I’m here whenever you’re ready.</span>
          <span className="entry-arrow">→</span>
        </button>
        <form
          className="home-composer"
          onSubmit={(e: any) => {
            e.preventDefault();
            if (direct.trim()) onTopic(["Just Chat", "", direct.trim()]);
          }}
        >
          <label className="sr-only" htmlFor="home-message">
            Start talking to AELIO
          </label>
          <textarea
            id="home-message"
            value={direct}
            maxLength={16000}
            rows={1}
            placeholder="Or tell me what’s on your mind…"
            onChange={(e: any) => setDirect(e.target.value)}
          />
          <button type="button" aria-pressed={listening} onClick={dictate}>
            {listening ? "Stop" : "Mic"}
          </button>
          <button disabled={!direct.trim()}>Continue →</button>
        </form>
        <small className="voice-notice">
          Voice uses your browser’s speech service, which may process audio
          remotely.
        </small>
        {voiceError && <p role="status">{voiceError}</p>}
        <div className="vibe-grid" aria-label="Conversation ideas">
          {TOPICS.slice(0, 6).map((t) => (
            <button className="vibe-card" key={t[0]} onClick={() => onTopic(t)}>
              <img
                src={"/assets/dream/" + t[3]}
                alt=""
                width="240"
                height="180"
                loading="lazy"
              />
              <span>
                <b>{t[0]}</b>
                <small>{t[1]}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="secondary-topics" aria-label="More conversation ideas">
          {TOPICS.slice(6).map((t, i) => (
            <button key={t[0]} onClick={() => onTopic(t)}>
              <span aria-hidden="true">
                {["◌", "◎", "▤", "♧", "✧", "▥", "•••"][i]}
              </span>
              {t[0]}
            </button>
          ))}
        </div>
        <div className="daily-picks">
          <span>A little inspiration for this moment</span>
          {context.picks.map((n) => (
            <button
              key={n}
              onClick={() => onTopic(TOPICS.find((t) => t[0] === n))}
            >
              {n} ↗
            </button>
          ))}
        </div>
        <p className="home-note">
          Choose a starting point, then make it yours. Nothing sends until you
          press Send.
        </p>
      </section>
      <aside className="today-sidebar">
        <Today food={context.food} onTopic={onTopic} />
        <section className="today-card">
          <div className="section-title">
            <h2>Your AELIO</h2>
            <button onClick={onAppearance}>Customize</button>
          </div>
          <div className="mini-designs">
            {DESIGNS.map((d) => (
              <button
                key={d.id}
                title={d.name}
                aria-label={"Preview " + d.name}
                onClick={() => onAppearance(d.id)}
                style={{
                  background: d.scene
                    ? `url(/assets/dream/${d.scene}) center/cover`
                    : d.surface,
                  color: d.light ? "#302720" : "#fff2e4",
                  borderColor:
                    designOf(appearance).id === d.id ? d.accent : "transparent",
                }}
              >
                {d.name}
              </button>
            ))}
          </div>
          <p>{designOf(appearance).name}</p>
          <button className="today-row" onClick={onAppearance}>
            ◉ Chat Background <span>›</span>
          </button>
          <button className="today-row" onClick={onAppearance}>
            ◌ Bubble Style <span>›</span>
          </button>
        </section>
        {recent && (
          <section className="today-card continue">
            <h2>Pick up where you left off</h2>
            <button onClick={() => onResume(recent)}>{recent.title} ↗</button>
          </section>
        )}
      </aside>
    </div>
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
        href={"https://www.google.com/maps/search/?api=1&query=" + mapQuery}
        target="_blank"
        rel="noreferrer"
      >
        <span>
          <b>{food} Near You</b>
          <small>Search Maps · opens another site</small>
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
          href="https://www.google.com/maps/dir/"
          target="_blank"
          rel="noreferrer"
        >
          Open Maps for directions ↗
        </a>
      </details>
      <details>
        <summary>VYBR8 experiences</summary>
        <p>
          Restaurant, event and ecosystem account linking are planned. No
          external account is linked automatically.
        </p>
        <button onClick={() => onTopic(TOPICS[5])}>
          Explore date night ideas
        </button>
      </details>
    </section>
  );
}
