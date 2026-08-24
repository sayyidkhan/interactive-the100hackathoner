# Agent Handoff — The 100th Hackathoner

Updated: 14 August 2026 (Asia/Singapore)

## Mission

Build an immersive, walkable portfolio about Sayyid's journey from software
engineer and serial hackathoner into an operator/founder. The product combines:

- **Shawn Kingdom:** a soft, editable village with residents, animals, weather,
  seasons, discoveries and local-builder tools.
- **Kairui Kingdom:** a larger cinematic coastal world for authored storytelling,
  guided journeys and free exploration.
- **Unified world:** shared player identity, progress, environment and travel
  between both kingdoms.

The content must remain Sayyid's own story. Kairui and Shawn are implementation
and art-direction references, not content sources.

## Current Git state

- Canonical repository: `/Users/sayyid/Documents/github/interactive-the100hackathoner`
- Active branch: `dev-v5`
- Tracking branch: `origin/dev-v5`
- The main repository has been consolidated onto `dev-v5` and is the only
  location agents should edit.

The old nested clone at `dist/kairui-worktree` is deprecated and remains only as
a temporary local copy. Do not make new changes there. It can be removed later
after the user explicitly approves deletion.

A read-only reference of the decompiled kairui.dev site lives on
`origin/codex/decompile-kairui`. It is an art-direction and technique reference,
not a content source.

Branch purpose and history are documented in `docs/KINGDOM-ROADMAP.md`.

## Run and verify

```bash
cd /Users/sayyid/Documents/github/interactive-the100hackathoner
npm install
npm run dev -- --host 127.0.0.1 --port 5175
```

Useful routes:

- `http://127.0.0.1:5175/kingdoms` — kingdom selector
- `http://127.0.0.1:5175/worlds/kairui` — coastal world
- `http://127.0.0.1:5175/worlds/shawn` — village world
- `http://127.0.0.1:5175/local-builder` — editable village builder

Validation:

```bash
npm run build
git diff --check
```

The last build passed. Vite still reports the existing warning that the main
JavaScript chunk is larger than 500 kB.

## Current Kairui experience

The opening view is intentionally minimal:

- `THE 100TH`
- `HACKATHONER`
- short operator-journal description
- one `Enter the coast` action

After entry, the HUD changes to a compact dark coastal-teal and warm-gold game
interface. The palette is shared by:

- top-left identity plaque
- pause/menu panel
- climate controls
- guided-tour story card
- chapter rail
- interaction prompts and action buttons

The menu contains:

- Resume
- Field notes progress
- Travel: Village / Coast / Worlds
- Explore: Free roam / Cruise / Overview
- Environment summary and controls

Cruise remains a boat-camera mode. Overview now boards the physical hot-air
balloon. Both show a persistent `Return to free roam` control. Returning
restores the player, movement controls and gameplay camera. Free roam is also
an explicit option inside the menu.

The balloon is also boardable from the ground when the player is nearby
(`E · Board the hot air balloon`). While riding, Autopilot follows a closed
coastal loop; Free flight lets the rider turn, speed and change altitude.
Switching back to Autopilot eases onto the nearest loop point.

The guided tour is autopilot: the visitor only selects Previous, Next or a
chapter. Camera travel now glides along a terrain-cleared Catmull-Rom route
instead of cutting point-to-point. The story panel is compact at bottom-left;
chapters `01–06` sit on the right edge.

## Important files

- `src/worlds/kairui/index.ts` — coastal runtime orchestration, balloon ride
  (autopilot / free flight), tour route, player state and environment.
- `src/worlds/kairui/ui.ts` — Kairui HUD markup, menu, climate panel, chapter
  controls, balloon-mode toggle and transit/free-roam actions.
- `src/worlds/kairui/scene.ts` — terrain, coast, sea, landmarks, harbor pier,
  clouds, gulls, islands, balloon mesh and ambient life.
- `src/worlds/kairui/content.ts` — Sayyid's authored chapter content.
- `src/worlds/kairui/environment.ts` — weather, season, daylight and palette.
- `src/worlds/kairui/materials.ts` — water/sky shaders and vegetation sway.
- `src/styles.css` — shared UI styling; Kairui overrides are near the end under
  `Unified post-entry Kairui UI palette`.
- `src/engine/` — shared multi-world lifecycle and contracts.
- `docs/KINGDOM-ROADMAP.md` — branch/version map and architectural direction.

## Recent work included in this handoff

Coastal world polish against the kairui.dev quality bar, without copying its
content:

- Footprint-based dry-pad validation; Signal Archive and lighthouse sit on
  raised stone pads inland of the waterline.
- Harbor pier rebuilt as a walkable structure: ramp, plank deck, rails,
  instanced pilings, terminal platform, four docked boats, lines and fenders.
- Opaque lit low-poly cloud clusters with weather-reactive coverage.
- Three authored gull flocks with elliptical flight and phased wing flaps.
- Rideable hot-air balloon with burner, basket camera, 90s loop, Autopilot /
  Free flight toggle, and empty-balloon return-home.
- Water shader: shoreline foam from `coastalShoreX`, wave lighting, breathing
  glitter, night moonlight path, horizon fresnel. Geometric tube foam removed.
- Ambient life: unsynced vegetation sway, hut chimney smoke, campfire flicker,
  far sails, pulsing lighthouse, rare dolphin-pod events.
- Night palette now dims terrain; hut windows and lamps brighten at night.
- Guided tour glides along a clearance-safe camera route between chapters.
- Pause-menu climate button no longer blocked by the Guided tour control.
- Seabed lowered so tan patches no longer surface through wave troughs.

## Product and design preferences

- Keep controls minimal and let the 3D world dominate the screen.
- Use game conventions: clear selected states, Escape/resume behaviour, direct
  return paths and contextual controls.
- Prefer soft, matte, low-poly rendering over harsh saturation or heavy gloss.
- UI should feel warm and tactile, but not cover the environment.
- Use concise portfolio copy. Avoid generic filler such as “field journal” when
  it does not add meaning.
- Preserve performance and mobile readability while adding immersion.
- Challenge weak design assumptions rather than merely adding more UI.
- Quality comes from authored geometry, lighting and ambient motion — not bloom
  or post-processing. The kairui.dev reference uses none.

## Next-agent checklist

1. Read `README.md` and `docs/KINGDOM-ROADMAP.md`.
2. Confirm `git status --short --branch`; do not overwrite unrelated changes.
3. Confirm the repository path is the project root, not
   `dist/kairui-worktree`.
4. Run the app and visually inspect `/worlds/kairui` before changing it.
5. After camera or HUD changes, test free roam, Cruise, balloon Autopilot and
   Free flight, climate controls and the guided tour (including chapter hops).
6. Run `npm run build` and `git diff --check` before handing work back.

## Known follow-up opportunities

- Perform responsive QA for the Explore row, balloon-mode toggle and transit
  return action on narrow screens.
- Split the large main bundle using route/world-level dynamic imports.
- Continue terrain, lighting and atmospheric polish without increasing HUD
  density.
- Keep architecture reusable for future kingdoms rather than adding Kairui-only
  conditionals to the application entry point.
