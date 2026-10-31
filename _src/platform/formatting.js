// Strip only a redundant leading speaker label; quoted text and later mentions remain untouched.
export function speakerPrefixFilter(name) {
  const escaped = String(name || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const labels = [`[${name}]`, `${name}:`];
  let pending = "",
    decided = !name;
  return (chunk = "", finish = false) => {
    if (decided) return chunk;
    pending += chunk;
    const trimmed = pending.replace(/^\s+/, ""),
      lower = trimmed.toLowerCase();
    const match = lower.match(
      new RegExp(
        "^(?:\\[" + escaped + "\\](?=\\s|$)|" + escaped + ":(?=\\s|$))",
        "i",
      ),
    );
    if (match) {
      const rest = trimmed.slice(match[0].length);
      if (!rest && !finish) return "";
      decided = true;
      pending = "";
      return rest.replace(/^\s+/, "");
    }
    if (
      !finish &&
      (!trimmed ||
        labels.some((label) => label.toLowerCase().startsWith(lower)) ||
        labels.some((label) => lower === label.toLowerCase()))
    )
      return "";
    decided = true;
    const out = pending;
    pending = "";
    return out;
  };
}
