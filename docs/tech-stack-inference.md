# Tech Stack Inference for interactive.shawnchee.com

Source inspected: `https://interactive.shawnchee.com`

This is an inference based on the live deployed page source, visible UI behavior, and JavaScript bundle. It is not a private source-code audit.

## Observed Evidence

- The page title is `Shawnville`.
- The app is shipped as a static HTML page.
- The HTML has a single 3D mount node: `<div id="app"></div>`.
- The UI is built with normal HTML elements and IDs/classes, for example:
  - `journalBtn`
  - `interactPill`
  - `soundBtn`
  - `musicBtn`
  - `charBtn`
  - `card`
  - `intro`
  - `journalModal`
- The deployed page loads one JavaScript module bundle:
  - `/assets/index-BoB5RT0L.js`
- The deployed page loads one CSS bundle:
  - `/assets/index-Cg3YuhOS.css`
- The JavaScript bundle contains `THREE`, which strongly indicates direct Three.js usage.
- The JavaScript bundle also includes physics/collision-looking symbols such as `RawBroadPhase`, `RawKinematicCharacterController`, ray casts, colliders, and rigid-body-style APIs. This strongly resembles Rapier's JavaScript/WASM physics bindings.
- The page includes Cloudflare Web Analytics:
  - `https://static.cloudflareinsights.com/beacon.min.js`
- The HTML includes a mobile portrait blocker:
  - "Turn your phone"
  - "Shawnville is a little town to walk around in — it needs some room. Rotate to landscape to explore."

## Likely Stack

| Layer | Likely Technology | Confidence | Reason |
|---|---|---:|---|
| Build tool | Vite | High | Output shape is typical Vite: `assets/index-[hash].js`, `assets/index-[hash].css`, native `type="module"` script. |
| 3D engine | Three.js | Very high | Bundle exposes `THREE` internals and the site renders a WebGL-style 3D town. |
| UI layer | Plain HTML/CSS/DOM | High | Page source includes static DOM elements with IDs/classes instead of framework-specific markup. |
| Framework | No obvious React/Next/Svelte dependency | Medium | No `__NEXT_DATA__`, no React root markers, no framework hydration markers in source. |
| Styling | Handwritten CSS | High | One compiled CSS bundle; UI classes appear custom. |
| Physics / collision | Rapier-style WASM physics | Medium-high | Bundle includes raw broadphase, collider, raycast, and kinematic character-controller symbols. Exact package name is not proven from minified output. |
| Hosting/CDN | Static hosting behind Cloudflare | Medium | Cloudflare analytics is present; hosting provider itself is not proven from source. |
| Analytics | Cloudflare Web Analytics | Very high | Cloudflare beacon script is included directly. |
| Audio | Browser audio API / HTML audio | Medium | Site has sound/music controls and plays audio; exact implementation is hidden in bundle. |
| Game loop | Custom Three.js loop | High | Movement, camera, collision/discovery behavior are likely custom logic over Three.js. |

## Likely Architecture

The app probably follows this structure:

```text
index.html
src/
  main.js or main.ts
  style.css
  world/
    scene setup
    camera setup
    lighting
    buildings
    characters
    discovery stars
  systems/
    input controls
    movement
    physics / collision
    collision / proximity detection
    camera follow
    discovery journal
    audio
```

Runtime flow:

1. `index.html` renders static UI shells and the `#app` mount node.
2. JavaScript initializes a Three.js renderer inside `#app`.
3. The scene creates a low-poly town using primitive geometry or lightweight models.
4. Keyboard input updates player movement.
5. Camera follows or orbits the player.
6. Stars/discovery points are checked by proximity.
7. DOM modals/cards are updated when the player interacts.
8. Discovered state is stored locally, likely in memory or `localStorage`.

## What He Probably Did Not Use

Based on the deployed source, this does not look like:

- Next.js
- React Three Fiber
- Phaser
- Unity WebGL
- Godot export
- A heavy CMS-backed app
- Server-rendered application

It looks like a custom static Three.js experience.

## Recommended Equivalent Stack for This Repo

For `interactive-the100hackathoner`, the closest practical stack is:

```text
Vite
TypeScript
Three.js
CSS modules or plain CSS
Static JSON content
LocalStorage for discovery progress
GitHub Pages / Cloudflare Pages / Vercel static deploy
```

Optional additions:

- `gsap` for polished transitions and camera movement.
- `howler` for easier audio control.
- `lil-gui` only during development for tuning scene values.
- `zod` for validating hackathon content data.

Avoid React initially unless the UI becomes complex. A direct Three.js plus DOM approach is faster for an MVP and closer to Shawnville's apparent implementation.

## Suggested MVP Stack

Use this for version 1:

| Need | Choice |
|---|---|
| App scaffold | Vite + TypeScript |
| 3D rendering | Three.js |
| UI overlays | Plain HTML/CSS |
| Content | `src/data/hackathons.ts` or `hackathons.json` |
| State | `localStorage` |
| Deployment | Cloudflare Pages or GitHub Pages |

This keeps the system small, fast, and easy to ship.

## Why This Stack Fits The 100 Hackathoner

Your project is content-heavy but interaction-light at first. The important loop is:

```text
walk -> discover -> read story -> update progress -> continue exploring
```

That does not require a heavy app framework. It requires:

- a stable 3D scene
- simple movement
- discoverable objects
- clean content cards
- a data model that scales to 100 entries

The highest-leverage decision is to make hackathon content data-driven from day one. The 3D world should read from structured content, not hardcoded one-off objects.

## Proposed Content Data Shape

```ts
export type HackathonEntry = {
  id: string;
  number: number;
  title: string;
  date: string;
  theme: "ai-agents" | "saas" | "sustainability" | "crypto" | "devtools" | "other";
  status: "completed" | "upcoming";
  result?: string;
  projectName?: string;
  summary: string;
  lesson: string;
  monetizationInsight?: string;
  storyHook?: string;
  position: {
    x: number;
    z: number;
  };
};
```

## Build Recommendation

Do not start by building a full town.

Start with:

- one square plaza
- one player avatar
- 5 discovery stars
- one reusable content modal
- `19/100` progress counter
- data-driven hackathon entries

Then expand into districts once the content model feels right.
