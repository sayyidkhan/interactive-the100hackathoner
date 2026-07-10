# Shawnville 20 Discovery Screenshot Checklist

Source: `https://interactive.shawnchee.com`

## Capture Status

I attempted to capture screenshots for all 20 discovery items.

Current limitation: the available Computer Use controls in this session expose only `get_app_state`, `click`, and `type_text`. There is no reliable scroll, drag, held-key movement, or direct screenshot-save command. Local `screencapture` failed, and the alternate browser screenshot path produced a black frame. Computer Use does create temporary JPEGs, and one useful Shawnville screenshot was recovered into this repo:

- [shawnville-discovery-journal-top.jpeg](./screenshots/shawnville-discovery-journal-top.jpeg)

That screenshot captures the top of the Discovery Journal. It does not cover all 20 item cards.

## Full 20-Item Discovery List

This list was extracted from the live Discovery Journal accessibility tree.

| # | Status Seen | Journal Label / Clue |
|---:|---|---|
| 1 | Discovered | `Welcome to Shawnville` |
| 2 | Hidden | `where the mayor sleeps` |
| 3 | Discovered | `Career Hall` |
| 4 | Hidden | `shhh... it's full of acronyms` |
| 5 | Hidden | `CGPA lives here` |
| 6 | Discovered | `The Workshop` |
| 7 | Hidden | `a market stall humming with blockchains` |
| 8 | Hidden | `a market stall that talks back` |
| 9 | Hidden | `a market stall for developers` |
| 10 | Hidden | `neon glow after dark` |
| 11 | Discovered | `Creator Studio` |
| 12 | Hidden | `send Shawn a letter` |
| 13 | Discovered | `Hackathon Monument` |
| 14 | Discovered | `The Football Pitch` |
| 15 | Discovered | `The Outdoor Gym` |
| 16 | Hidden | `follow the path around the park` |
| 17 | Hidden | `meow?` |
| 18 | Hidden | `go on. touch it.` |
| 19 | Hidden | `hug the town walls` |
| 20 | Hidden | `score a screamer on the pitch` |

## Screenshots Captured in Session Context

These states were visually inspected through Computer Use during the session:

- Intro / onboarding modal
- Main town view near `The Workshop`
- `The Workshop` discovery card
- Character selector
- Discovery Journal top

Only the Discovery Journal top screenshot was recoverable as a file.

## What Each Screenshot Should Capture

For a complete reference set, capture each discovery in this format:

```text
docs/screenshots/shawnville-01-welcome-to-shawnville.jpeg
docs/screenshots/shawnville-02-mayor-sleeps.jpeg
docs/screenshots/shawnville-03-career-hall.jpeg
docs/screenshots/shawnville-04-acronyms.jpeg
docs/screenshots/shawnville-05-cgpa.jpeg
docs/screenshots/shawnville-06-workshop.jpeg
docs/screenshots/shawnville-07-web3-stall.jpeg
docs/screenshots/shawnville-08-ai-stall.jpeg
docs/screenshots/shawnville-09-devtools-stall.jpeg
docs/screenshots/shawnville-10-neon.jpeg
docs/screenshots/shawnville-11-creator-studio.jpeg
docs/screenshots/shawnville-12-send-letter.jpeg
docs/screenshots/shawnville-13-hackathon-monument.jpeg
docs/screenshots/shawnville-14-football-pitch.jpeg
docs/screenshots/shawnville-15-outdoor-gym.jpeg
docs/screenshots/shawnville-16-park-path.jpeg
docs/screenshots/shawnville-17-meow.jpeg
docs/screenshots/shawnville-18-touch-it.jpeg
docs/screenshots/shawnville-19-town-walls.jpeg
docs/screenshots/shawnville-20-score-screamer.jpeg
```

## Recommended Capture Method

The most reliable way to finish all 20 screenshots is:

1. Use Chrome DevTools or a browser automation session that can run JavaScript on the live page.
2. Extract the discovery objects from the bundled app state.
3. Programmatically mark all discoveries as unlocked, if the app stores progress in local state.
4. Open each discovery card state directly and screenshot the viewport.

Manual walking is possible but slow and unreliable because several entries require map-specific interactions such as hugging walls, scoring on the pitch, touching hidden objects, or following park paths.

## Design Takeaway for This Project

For `The 100 Hackathoner`, make screenshot/testing easier than Shawnville by adding a development-only route:

```text
/dev/discoveries
```

That route should render every discovery card in a grid/list. It would make visual QA, content review, and screenshot capture straightforward without needing to walk around the 3D world.
