# Showing published models on aelio.live (optional, later)

The studio exposes a read-only endpoint that lists only the checkpoints you've **published** in Native Lab, which requires a fresh MFA code:

```
GET https://aelio.live/api/public/models   (same origin; forwarded privately to the engine)
```

It returns JSON (name, engine, metrics, published date) and allows CORS from `https://aelio.live` and `https://www.aelio.live`. It can't trigger training, inference or anything else.

When you're ready, aelio.live could add a small script like the one below. **It hasn't been added.** The public site is unchanged.

```html
<div id="aelio-models"></div>
<script>
fetch("/api/public/models").then(r => r.json()).then(d => {
  document.getElementById("aelio-models").textContent =
    d.models.length ? d.models.map(m => m.name + " · " + m.engine).join("\n") : "No models published yet.";
});
</script>
```

If you put Cloudflare Access in front of the studio, add a bypass rule for `/public/*`.
