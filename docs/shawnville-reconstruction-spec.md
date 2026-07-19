# Shawnville Reconstruction Spec

Reference: `https://interactive.shawnchee.com/`

This document records behavior visible from the public site and technical inferences from browser-visible assets. It is an independent reconstruction guide, not a claim to the original private source code.

## Reconstruction boundary

- Reproduce observable interaction patterns, layout, motion, and information architecture.
- Use original copy, branding, town data, models, and implementation code for The 100 Hackathoner.
- Do not bypass authentication, scrape private endpoints, or copy analytics identifiers.
- Treat minified bundle details as evidence for architecture, not as source to paste into this repository.

## Public deployment evidence

The inspected deployment exposes:

- A static HTML shell with a single application mount.
- One hashed JavaScript module bundle and one hashed stylesheet.
- Four local font files: Amatic SC 700 and Nunito 400/700/800.
- No image assets in the initial page inventory, suggesting that the visible town is largely procedural geometry, CSS, text, and emoji.
- Three.js symbols in the public bundle.
- Physics and kinematic-controller-like symbols consistent with a Rapier-style collision layer.

The high-confidence architecture is therefore:

```text
Vite static application
  ├─ Three.js scene and render loop
  ├─ procedural low-poly town geometry
  ├─ player movement + collision controller
  ├─ proximity-based discovery system
  ├─ plain DOM/CSS HUD and modals
  ├─ local discovery persistence
  └─ browser audio controls
```

## Observable experience state machine

```text
page load
  → onboarding modal
      → choose one of six wanderers
      → read controls
      → enter town
  → exploration
      → walk / sprint / orbit camera
      → approach a glowing star
      → contextual read prompt
      → open discovery card
      → persist discovery and update counter
  → collection loop
      → open discovery journal
      → review unlocked entries
      → use clues for locked entries
      → return to town
```

Modal states pause world interaction while keeping the rendered town visible behind a blurred, dimmed overlay.

## Visual grammar

### World

- Warm, low-poly town viewed from an elevated third-person camera.
- Muted green terrain, sand-colored paths, pastel buildings, and soft directional shadows.
- Buildings use primitive shapes, readable facade signs, and a restrained material palette.
- Discovery signals use warm glowing particles or star-like markers.
- Benches, lamps, plants, animals, and residents make the town feel inhabited without dense geometry.

### HUD

- Top-left: compact brand plaque.
- Top-right: pill-shaped discovery counter that opens the journal.
- Bottom-left: circular sound, music, and persona controls.
- Bottom-center: contextual control or interaction hint.
- The central viewport remains visually quiet during normal exploration.

### Typography and surfaces

- Tall handwritten display type for place identity and modal titles.
- Rounded sans-serif body type for instructions and content.
- Warm off-white cards with small radii and soft, wide shadows.
- Coral is the primary action/selection color; gold communicates discovery.
- Backdrop blur separates UI layers without hiding the world.

## Core mechanics

### Movement

- WASD and arrow-key locomotion.
- Shift modifies movement speed.
- Camera orbits through pointer drag and follows the player.
- Collision prevents walking through important town geometry.

### Discovery

Each discovery needs:

```ts
type Discovery = {
  id: string;
  title: string;
  clue: string;
  position: { x: number; z: number };
  card: {
    icon: string;
    summary: string;
    details: string[];
    nextHint?: string;
  };
};
```

The runtime checks distance from the player to each marker. When the closest marker enters an interaction radius, the HUD reveals a prompt. Activating it opens the story card and records the ID in local persistence.

### Journal

- Unlocked rows show their icon and title.
- Locked rows show `???` plus a short spatial clue.
- Progress is a count of unique discovered IDs.
- The journal is both a collection record and a navigation device.

### Personas

- Six choices make onboarding memorable without changing the core world.
- The selected persona should affect at least appearance and may also tune walking, sprinting, or jumping.
- The same selector remains accessible during exploration.

## Mapping to this repository

| Reference pattern | Local implementation |
|---|---|
| Three.js world | `src/world/loopTown.ts` |
| Procedural town assets | `src/world/rendering/` |
| Player and residents | `src/world/characters.ts` |
| Movement and collision | `src/world/player/movement.ts` |
| Discovery markers | `src/world/discoveries.ts` |
| Discovery content | `src/data/discoveries.ts` |
| DOM HUD and modals | `src/ui/hud.ts` |
| Discovery persistence | `src/systems/storage.ts` |
| Town schema and builder | `src/data/townSchema.ts`, `src/ui/builder.ts` |

## Product adaptation

The valuable pattern is not a literal Shawnville clone. It is:

```text
identity-rich onboarding
  + explorable proof-of-work world
  + proximity-triggered stories
  + persistent collection progress
  + clues that route the next action
```

For The 100 Hackathoner, each discovery should produce founder leverage: a lesson, market signal, distribution asset, monetization question, or book chapter seed. That turns exploration from a visual gimmick into an operating system for the 100-hackathon journey.

