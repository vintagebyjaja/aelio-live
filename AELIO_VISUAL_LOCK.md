# AELIO visual identity — locked direction

## Scope
Public AELIO marketing pages use original cinematic environments: realistic glass architecture, golden-hour atmosphere, trees, clouds, natural landscapes, subtle futuristic interface details, dark premium framing, warm gold/copper accents. The approved source reference is a direction, not a mandate to reproduce identical scenes.

## Official icon
The supplied Dream Beyond cloud/infinity artwork is the **official** favicon and app/home-screen icon. Do not substitute the AELIO wordmark, a generic letter, or a generated replacement. Original asset: `assets/img/dream-beyond-official-logo.png`; derived icon sizes are in the project root.

## Motion
Environmental motion must be slow, subtle and calm (cloud drift, breeze, soft parallax). No jarring transitions or forced loading delays. Always respect `prefers-reduced-motion`. Current release uses slow cinematic image movement; independently animated trees/clouds require separate layered art or video assets.

## Protection
**Do not restyle, replace or alter Studio Brain** (`studiobrain/`, `public/studiobrain/`, and its application assets). Do not alter authentication, backend routes, billing, database, agent logic, APIs, or security.

## Source of truth
`assets/aelio-cinematic.css` controls the public cinematic layer. `assets/img/aelio-cinematic-home.webp` is the primary environment. `assets/img/aelio-atmosphere-*.webp` are supporting crops for future page-specific designs. Existing public site structure remains intact; this is a first visual restore pass, not a full bespoke redesign of every page.

## Deploy
Replace the GitHub repository files with the contents of this project folder, commit, and let the existing Cloudflare build/deploy workflow run. Verify home, nested pages, Studio Brain, install icon and mobile navigation before production promotion.
