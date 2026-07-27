# Visual Context Notes from Shawnville

Source inspected: `https://interactive.shawnchee.com`

These notes come from live Computer Use screenshots of the application. Local PNG capture with `screencapture` failed in the sandbox, so the screenshots were used as visual context during inspection rather than saved as image files.

## Captured States

### 1. Intro / Onboarding Modal

The first screen is not a landing page. It is the game world with a blurred/dimmed 3D town in the background and a centered onboarding modal.

Visible elements:

- Title: `Welcome to Shawnville`
- Short premise: a tiny town built from Shawn Chee's resume, projects, and hobbies.
- Six character choices:
  - Shawn
  - The Red
  - Biscuit
  - Nugget
  - HONK
  - Roomie
- Main CTA: `Take a walk`
- Control hint: `WASD or arrows to walk`, `shift` to jog, drag to look around, `space` to read a star.

Design takeaway:

The onboarding does three jobs at once: explains the concept, teaches controls, and injects personality.

### 2. Main World / Gameplay View

The main experience is a low-poly 3D town viewed from an angled third-person camera.

Visible elements:

- Top-left brand card: `Shawnville`, `a walkable portfolio`
- Top-right progress pill: `7/20 discovered`
- Bottom-left controls:
  - sound toggle
  - music toggle/change
  - character selector
- Bottom-center contextual prompt: `space to read`
- A player character near a building called `The Workshop`
- Other visible landmarks:
  - trophy monument
  - buildings
  - glowing discovery markers
  - paths
  - lamps
  - props and companion characters

Design takeaway:

The HUD is intentionally sparse. Most of the page is reserved for the world, while progress and controls stay in the corners.

### 3. Discovery Card

When the player is near `The Workshop` and presses space, a card opens over the world.

Visible elements:

- Card icon: wrench
- Title: `The Workshop`
- Body copy: "Where the shipping happens."
- Bullet list of shipped projects:
  - Thetanuts CLI
  - perfpatch
  - Consilium
  - Daily Scaffold
  - caveman-skill
  - VibeGuard
- Directional hint: browse nearby market stalls for Web3, AI, and dev-tools collections.
- Close affordances:
  - `x` close button
  - `space to close`

Design takeaway:

Each discovery is a compact story card, not a long page. It combines proof-of-work, project names, short descriptions, and navigation hints.

### 4. Character Selector

The character selector reuses the onboarding character grid as a modal during gameplay.

Visible elements:

- Title: `Choose your wanderer`
- Six selectable personas
- Selected state shown with a red/orange outline
- CTA: `Done`
- Blurred 3D world behind the modal

Design takeaway:

Character selection is a personality layer. It does not need to be complex, but it makes the experience feel owned and playful.

### 5. Discovery Journal

Clicking the progress pill opens a `Discovery Journal`.

Visible elements:

- Title: `Discovery Journal`
- List of discovered and undiscovered entries.
- Discovered entries show names/icons.
- Undiscovered entries show `???` with clue text.
- Examples:
  - `Welcome to Shawnville`
  - `Career Hall`
  - `The Workshop`
  - `Creator Studio`
  - Unknown: "where the mayor sleeps"
  - Unknown: "a market stall that talks back"
  - Unknown: "score a screamer on the pitch"

Design takeaway:

The journal turns exploration into a collection game. The unknown entries provide curiosity hooks without revealing everything.

## Implications for The 100 Hackathoner

The equivalent visual system should include:

- A branded top-left identity card: `The 100 Hackathoner`
- A top-right progress pill: `19/100 completed` or `19/100 discovered`
- A centered onboarding modal that explains:
  - the 100-hackathon mission
  - the exploration controls
  - the meaning of discoveries
- A character/persona selector tied to your identity:
  - Builder
  - Operator
  - Founder
  - Investor
  - Agentic Engineer
  - Hackathoner
- A discovery card template for each hackathon.
- A journal that lists all 100 entries:
  - completed entries are unlocked
  - future/hidden entries show clues
  - entries can be grouped by theme or district

## Recommended UI Model

Keep the first version close to Shawnville's interaction model:

```text
world view
  top-left: brand
  top-right: progress/journal
  bottom-left: audio/settings/persona controls
  bottom-center: contextual action prompt

modal types
  intro modal
  persona modal
  discovery card
  discovery journal
```

## Content Card Template

For your project, each discovery card should answer:

- Hackathon number
- Event name
- Theme
- What was built
- Result
- Core lesson
- Founder/operator insight
- Monetization or distribution angle
- Link to project/demo/story if available

Example:

```text
#019 - BUIDL_OPC Hackathon SG

Built: ...
Result: ...
Lesson: ...
Operator insight: ...
Business angle: ...
```

## Strongest Product Pattern

The most reusable idea is not the 3D town. It is the combination of:

```text
progress counter + explorable world + unlockable story cards + discovery journal
```

That pattern maps directly to the 100-hackathon journey.
