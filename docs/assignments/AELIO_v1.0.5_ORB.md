# CODEX — AELIO ORB IMPLEMENTATION & THEME REFINEMENT

## OBJECTIVE

Upgrade the existing AELIO orb into a sophisticated, animated liquid-metal AI presence while preserving its established visual identity.

The reference image shows the intended orb: a dimensional bronze/copper sphere with soft internal fluid movement, realistic lighting, dark metallic depth, and a thin illuminated rim.

**Do not replace the existing orb with a generic sphere, spinning gradient, particle animation, or flat CSS circle.**

## 1. EXPLICIT ORB IMPLEMENTATION

### Rendering architecture

Create a reusable `AelioOrb` component.

Preferred implementation:

- Use Three.js with React Three Fiber if compatible with the existing application.
- Use a custom GLSL shader to produce the liquid-metal surface.
- Prefer the existing rendering stack if it can achieve the same visual quality.
- Lazy-load expensive rendering dependencies.
- Provide a lightweight CSS or static-image fallback for unsupported devices.

Do not introduce a large rendering dependency solely for a minor animation if an existing WebGL implementation can be extended.

### Geometry and materials

Use a high-resolution sphere with smooth surface normals.

Implement:

- Bronze and dark copper metallic coloration.
- Warm amber specular highlights.
- Deep chocolate shadows.
- A thin gold/copper illuminated silhouette.
- Realistic directional lighting.
- Subtle environmental reflections.
- Smooth transitions between illuminated and shadowed areas.

The orb must maintain its spherical silhouette at all times.

### Internal liquid-metal waves

Create the appearance of fluid energy moving **inside the sphere**, not around its exterior.

Use procedural noise and layered distortion within the fragment shader.

Suggested techniques:

- 3D simplex or Perlin noise.
- Domain-warped noise.
- Slowly evolving noise coordinates.
- Multiple noise frequencies.
- Soft metallic color interpolation.
- Subtle highlight displacement.

Use the noise field to modify the material's color, roughness, and internal highlight patterns.

Avoid aggressive geometry displacement.

The motion should resemble slowly flowing liquid bronze beneath a polished metallic surface.

**Do not rotate the sphere to simulate movement. The internal material must animate independently.**

### Shader behavior

Expose configurable uniforms such as:

```glsl
uniform float uTime;
uniform float uIntensity;
uniform float uAudioLevel;
uniform float uWaveSpeed;
uniform vec3 uCopperLight;
uniform vec3 uCopperDark;
uniform vec3 uHighlightColor;
```

Use `uTime` to animate the noise field.

Use `uIntensity` to control animation activity.

Use `uAudioLevel` to drive speech-reactive modulation.

Use `uWaveSpeed` to control the rate of internal movement.

Smooth all changing values to avoid sudden visual jumps.

### Lighting

Use restrained lighting that matches the reference.

- Warm key light toward the upper-left/front.
- Subtle amber rim illumination.
- Darker lower hemisphere.
- Gentle metallic reflections.
- No excessive bloom.
- No large glowing rings.

The surface should remain rich and dimensional even when animation is paused.

## 2. INTERACTIVE ANIMATION STATES

Implement a clear state API:

```ts
type AelioOrbState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "loading";
```

Suggested state behavior:

| State | Wave movement | Visual behavior |
|---|---|---|
| Idle | Very slow | Gentle breathing glow |
| Listening | Responsive | Waves react to microphone input |
| Thinking | Moderate | More active internal flow |
| Speaking | Audio-reactive | Fluid pulses synchronized to output |
| Loading | Slow-medium | Continuous internal circulation |

Use actual microphone or playback audio levels when available.

Do not simulate audio responsiveness when no audio signal exists.

### State transitions

Interpolate wave speed, intensity, glow, and audio response smoothly.

Avoid abrupt resets when switching states.

Maintain continuity in the shader's time value.

## 3. REUSABLE COMPONENT API

Implement a reusable interface similar to:

```tsx
<AelioOrb
  state="idle"
  size={240}
  intensity={0.35}
  audioLevel={0}
  interactive={false}
/>
```

Support:

- Responsive sizing
- Dark and light backgrounds
- Different visual themes
- Optional interaction
- Reduced-motion accessibility
- Static fallback rendering
- Consistent visual identity across pages

Use the component in the homepage, Main Pal, voice experience, and appropriate loading states.

Avoid rendering multiple expensive WebGL contexts unnecessarily.

## 4. PERFORMANCE REQUIREMENTS

Target smooth animation without degrading the chat experience.

- Aim for 60 FPS on capable desktop hardware.
- Adapt quality for mobile devices.
- Cap device pixel ratio where appropriate.
- Pause rendering when the orb is not visible.
- Stop unnecessary animation when the browser tab is inactive.
- Dispose of GPU resources when components unmount.
- Respect `prefers-reduced-motion`.
- Provide a static fallback when WebGL is unavailable.

Prioritize fast chat response rendering over orb animation.

Do not allow the orb to delay AELIO's initial page load.

## 5. CHOCOLATE CREAM THEME REFINEMENT

Enhance the existing Chocolate Cream theme with olive and sage green.

Suggested palette:

| Color | Hex |
|---|---|
| Deep chocolate | `#302019` |
| Warm cream | `#F5EBDD` |
| Copper | `#B97946` |
| Olive green | `#777B4B` |
| Sage green | `#A6B49B` |
| Soft caramel | `#D5AD83` |

Use olive for selected accents, active indicators, and subtle navigation details.

Use sage for secondary surfaces, soft highlights, and complementary interface elements.

Maintain accessible contrast and a restrained luxury aesthetic.

Do not change OG Light, OG Dark, or Ocean Fresh.

## 6. VISUAL ACCEPTANCE CRITERIA

The implementation is successful only if:

1. The orb retains the reference's recognizable bronze/copper appearance.
2. Internal waves visibly flow without rotating the entire sphere.
3. The material looks dimensional and metallic rather than plastic.
4. The silhouette remains perfectly spherical.
5. Listening and speaking states respond to real audio levels.
6. State transitions are smooth.
7. The animation remains performant on mobile.
8. Reduced-motion and WebGL fallbacks work.
9. The orb integrates naturally with existing AELIO layouts.
10. No unrelated design or functionality changes occur.

## 7. DELIVERY

Inspect the existing orb implementation before modifying it.

Reuse existing assets and components wherever possible.

Implement the animation, integrate the state system, and verify the production build.

Provide a summary of changed files, implementation decisions, and test results.

Do not automatically push or deploy unless explicitly instructed.

**Final design standard:** The orb should feel like a living, intelligent presence made of flowing metallic energy—not a decorative loading animation.