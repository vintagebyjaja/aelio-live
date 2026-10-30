import { DESIGNS, designOf } from "./design-system";
export function AppearanceControls({
  value,
  onChange,
  backgrounds = [],
  allowFile = false,
  onUpload,
}: any) {
  const ap = value || {};
  return (
    <div className="appearance-controls">
      <div
        className="design-grid"
        role="group"
        aria-label="Official AELIO designs"
      >
        {DESIGNS.map((d) => (
          <button
            type="button"
            key={d.id}
            className={
              "design-choice " + (designOf(ap).id === d.id ? "active" : "")
            }
            aria-pressed={designOf(ap).id === d.id}
            onClick={() =>
              onChange({
                ...ap,
                design: d.id,
                mode: d.light ? "light" : "dark",
              })
            }
            style={{
              background: d.surface,
              color: d.light ? "#302720" : "#fff2e4",
              borderColor: d.accent,
            }}
          >
            <span
              className="design-swatch"
              style={{
                background: d.scene
                  ? `url(/assets/dream/${d.scene}) center/cover`
                  : d.surface,
              }}
            />
            <b>{d.name}</b>
            <small>{d.description}</small>
          </button>
        ))}
      </div>
      <label>
        Chat background
        <select
          aria-label="Chat background"
          value={ap.background || ""}
          onChange={(e: any) =>
            onChange({
              ...ap,
              background: e.target.value || undefined,
              file_id: null,
            })
          }
        >
          <option value="">Use design environment</option>
          {backgrounds.map((b: string) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </label>
      {allowFile && (
        <label>
          Upload private background
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e: any) =>
              e.target.files?.[0] && onUpload(e.target.files[0])
            }
          />
        </label>
      )}
      {["outgoing", "incoming", "text"].map((k) => (
        <label key={k}>
          {k === "text"
            ? "Message text"
            : k === "outgoing"
              ? "Your bubbles"
              : "Agent bubbles"}
          <input
            type="color"
            value={
              ap[k] ||
              (k === "outgoing"
                ? "#b65b29"
                : k === "incoming"
                  ? designOf(ap).surface
                  : designOf(ap).light
                    ? "#29231e"
                    : "#fff7ee")
            }
            onChange={(e: any) => onChange({ ...ap, [k]: e.target.value })}
          />
          <button
            type="button"
            onClick={() => {
              const n = { ...ap };
              delete n[k];
              onChange(n);
            }}
          >
            Use design color
          </button>
        </label>
      ))}
      <label>
        Background dimming
        <input
          type="range"
          min="0"
          max="90"
          value={ap.dim ?? 25}
          onChange={(e: any) =>
            onChange({ ...ap, dim: Number(e.target.value) })
          }
        />
      </label>
      <label>
        Background blur
        <input
          type="range"
          min="0"
          max="20"
          value={ap.blur || 0}
          onChange={(e: any) =>
            onChange({ ...ap, blur: Number(e.target.value) })
          }
        />
      </label>
      <label>
        Motion
        <select
          aria-label="Motion preference"
          value={ap.motion || "system"}
          onChange={(e: any) => onChange({ ...ap, motion: e.target.value })}
        >
          <option value="system">Follow device preference</option>
          <option value="reduced">Reduce motion</option>
        </select>
      </label>
    </div>
  );
}
