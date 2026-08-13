# The 100 Hackathoner

A walkable proof-of-work archive inspired by `interactive.shawnchee.com`, rebuilt around Sayyid's 100-hackathon journey.

The loop engineering model is:

1. Explore the town.
2. Discover a hackathon/story marker.
3. Extract the founder/operator lesson.
4. Save progress in the journal.
5. Follow the next clue and compound the archive.

## Tech Stack

- Vite
- TypeScript
- Three.js
- Plain DOM/CSS overlays
- LocalStorage for discovered progress

See [docs/TECH-STACK.md](docs/TECH-STACK.md) for the stack rationale and inference notes.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

Useful routes:

- `/` - Shawn Kingdom exploration
- `/worlds/shawn` - explicit Shawn Kingdom exploration route
- `/local-builder` - Shawn Kingdom editor
- `/worlds/shawn/build` - explicit Shawn Kingdom editor route
- `/worlds/kairui` - Kairui coastal hackathon kingdom
- `/coast` - short alias for the coastal kingdom
- `/dev/discoveries` - discovery-card QA view

## World Roadmap

- `dev-v2` — Shawn Kingdom
- `dev-v3` — Shawn Kingdom with editable world-building tools
- `codex/decompile-kairui` — Kairui technical study archive
- `codex/kairui-kingdom` — maintainable multi-world engine and coastal prototype
- `dev-v4` — Coastal Hackathon Kingdom
- `dev-v5` — unified Shawn + Kairui open world

The Shawn-inspired kingdom focuses on town building, residents, discoveries and
environment customization. The Kairui-inspired kingdom focuses on coastal
terrain, cinematic storytelling, guided exploration, boats, balloon travel and
atmospheric world design. `dev-v5` connects both through a shared player,
environment clock and discovery ledger.

See [docs/KINGDOM-ROADMAP.md](docs/KINGDOM-ROADMAP.md) for the architecture and
delivery gates.

## Build

```bash
npm run build
```

The build outputs static assets to `dist/`, so this can deploy directly to Vercel with the default Vite settings.

## Visual QA

Screenshots captured during implementation:

- [Home town](docs/screenshots/the100hackathoner-home.jpeg)
- [Discovery QA](docs/screenshots/the100hackathoner-dev-discoveries.jpeg)
- [Shawnville reference pass](docs/screenshots/shawnville-reference-refine.jpeg)
- [Refined intro](docs/screenshots/the100hackathoner-refined-intro.jpeg)
- [Refined play view](docs/screenshots/the100hackathoner-refined-play.jpeg)
- [Refined discovery card](docs/screenshots/the100hackathoner-refined-card.jpeg)

## Inspiration

- Shawn Chee post: https://www.linkedin.com/posts/shawn-chee_update-on-my-site-bought-a-domain-interactive-share-7480904325112733696-E2bo/
- Main site: https://www.shawnchee.com/
- Interactive site: https://interactive.shawnchee.com/
