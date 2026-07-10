# TECH STACK

## Goal

Rebuild a Shawnville-inspired interactive portfolio for `The 100 Hackathoner`, deployable on Vercel.

The app should feel like a small walkable world where users discover hackathon stories, founder lessons, and project artifacts.

## Recommended Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Vite | Lightweight, fast, static-first, close to Shawnville's likely implementation. |
| Language | TypeScript | Better safety for game state, content schemas, and world objects. |
| 3D Engine | Three.js | Direct control over the low-poly town, camera, lights, movement, and objects. |
| UI Layer | Plain HTML/CSS overlays | Simple HUD, modals, journal, and discovery cards without React overhead. |
| Styling | CSS | Fastest path for custom game-like UI. |
| Content | Static TypeScript/JSON data | Makes 100 hackathon entries easy to manage and render into the world. |
| State | `localStorage` | Tracks discovered entries without backend complexity. |
| Deployment | Vercel Static Site | Simple deploy from GitHub, no server required. |
| Analytics | Vercel Analytics, optional | Lightweight product usage tracking. |

## Optional Libraries

| Library | Use |
|---|---|
| `@dimforge/rapier3d-compat` | Physics/collision if simple distance checks are not enough. |
| `gsap` | Smooth modal, camera, and object animations. |
| `howler` | Cleaner sound/music management. |
| `zod` | Validate hackathon content data. |
| `lil-gui` | Development-only scene tuning. |

## Initial Dependencies

Start lean:

```bash
npm create vite@latest . -- --template vanilla-ts
npm install three
npm install -D @types/three
```

Add optional dependencies only when needed:

```bash
npm install @dimforge/rapier3d-compat gsap howler zod
npm install -D lil-gui
```

## Vercel Deployment

Vercel settings:

| Setting | Value |
|---|---|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

Required scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

## App Architecture

Recommended structure:

```text
src/
  main.ts
  styles.css
  data/
    hackathons.ts
    discoveries.ts
  world/
    scene.ts
    camera.ts
    lights.ts
    materials.ts
    town.ts
    player.ts
    discoveries.ts
  systems/
    input.ts
    movement.ts
    camera-follow.ts
    proximity.ts
    storage.ts
    audio.ts
  ui/
    hud.ts
    modal.ts
    discovery-card.ts
    journal.ts
    character-select.ts
```

## Core Loop

```text
load world
choose character
walk around
approach discovery
press space / click
open discovery card
mark item discovered
update 19/100 progress
show item in journal
```

## Content Model

Each hackathon should be data-driven.

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
  operatorInsight?: string;
  monetizationInsight?: string;
  storyHook?: string;
  links?: {
    demo?: string;
    repo?: string;
    writeup?: string;
  };
  position: {
    x: number;
    z: number;
  };
};
```

## MVP Scope

Version 1 should include:

- One low-poly town/plaza.
- One playable character.
- `19/100` progress counter.
- 5 to 10 discovery points.
- Discovery card modal.
- Discovery journal.
- Character selector.
- Keyboard controls.
- LocalStorage progress.
- Vercel deployment.

Do not start with all 100 entries or a full 3D city. Prove the interaction and content loop first.

## Development-Only QA Route

Add a debug page or mode:

```text
/dev/discoveries
```

Purpose:

- Render every discovery card without walking around the world.
- Make screenshots easy.
- Review copy quickly.
- Catch layout overflow before shipping.

This avoids the capture problem found while inspecting Shawnville.

## Why Not React First

React is useful if the UI grows into a full app. For this MVP, direct Three.js plus DOM overlays is faster and closer to the reference site.

Use React later only if:

- the journal becomes complex,
- filtering/searching 100 entries becomes important,
- admin/content tooling is added,
- the UI starts needing reusable component state.

## Recommended Build Order

1. Scaffold Vite + TypeScript + Three.js.
2. Render a basic world, camera, lights, and ground.
3. Add player movement.
4. Add 5 data-driven discovery points.
5. Add discovery card modal.
6. Add progress counter and journal.
7. Add character selector.
8. Add Vercel deployment.
9. Add more districts and content.
