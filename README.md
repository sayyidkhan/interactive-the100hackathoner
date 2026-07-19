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

- `/` - 3D walkable town
- `/dev/discoveries` - discovery-card QA view

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
