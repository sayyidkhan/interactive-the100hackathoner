# Learnings from interactive.shawnchee.com

Source inspected: `https://interactive.shawnchee.com`

## What It Is

`Shawnville` is a walkable 3D portfolio. Instead of showing a normal resume or project list, it turns Shawn Chee's background into a small explorable town.

The user picks a character, walks around with keyboard controls, finds glowing stars, and unlocks portfolio/story content through exploration.

## Core Experience Pattern

- First screen is the actual experience, not a marketing landing page.
- The portfolio is framed as a world: `Shawnville`.
- Buildings represent areas of the person's work/life.
- Glowing stars act as discovery points.
- A counter tracks progress: `5/20 discovered`.
- Controls are simple: `WASD`, `Shift`, drag to look around, space/read interaction.
- Audio and music controls make the experience feel more like a small game.
- Character selection adds personality before the user starts exploring.

## Useful Product Patterns

- **Make the content spatial.** Instead of menus and sections, use places, objects, and paths.
- **Give users a collection loop.** The discovery counter makes people want to find everything.
- **Keep onboarding short.** One modal explains the premise, controls, and character choice.
- **Use playful identity.** Character choices reveal personality without long copy.
- **Turn resume facts into artifacts.** Buildings, stars, signs, and characters make professional history memorable.
- **Reward wandering.** Users discover content because they are curious, not because they scroll through a list.

## Patterns to Reuse for The 100 Hackathoner

- Rename the world around the core identity, for example `Hackathon City`, `The 100 Hackathoner`, or `Buildtown`.
- Replace `5/20 discovered` with progress such as `19/100 hackathons completed`.
- Use one discovery point per hackathon, milestone, or lesson.
- Create themed buildings:
  - `AI Agents Lab`
  - `SaaS Studio`
  - `Sustainability District`
  - `Crypto Alley`
  - `Founder School`
  - `Failure Museum`
  - `Winners Hall`
  - `Investor Corner`
- Make each discovery answer one useful question:
  - What did I build?
  - Why did it matter?
  - What did I learn?
  - What would I monetize?
  - What would I do differently?
  - What story belongs in the future book?

## Strategic Angle

For this project, the interactive site should not just be a visual gimmick. It should support the larger operator/founder transition:

- Show execution velocity through completed hackathons.
- Surface repeatable lessons from experiments.
- Turn past projects into market insight.
- Make the 100-hackathon journey legible to sponsors, collaborators, readers, and future customers.
- Capture raw material for a book and personal brand moat.

## MVP Scope Recommendation

Start smaller than a full 3D town.

Version 1 should prove the narrative loop:

- A simple explorable map.
- A visible `19/100` progress counter.
- 5 to 10 hackathon discovery nodes.
- One modal/card per discovery.
- Keyboard or click navigation.
- A clear content schema for future hackathon entries.

Once the content loop works, expand into richer 3D, audio, characters, and themed districts.

## Open Design Questions

- Should the site prioritize recruiters, founders, sponsors, readers, or collaborators?
- Is the main CTA to contact you, follow the journey, sponsor a hackathon, read stories, or explore business ideas?
- Should each hackathon be treated as a project, a lesson, a startup experiment, or a chapter?
- What is the strongest unit of content: hackathon entry, business idea, founder lesson, or story?

## Initial Positioning Hypothesis

The strongest direction is:

> A walkable archive of 100 hackathons, showing how a software engineer becomes an operator through repeated experiments.

This makes the site more than a portfolio. It becomes a public proof-of-work system, a story engine, and a founder-learning archive.
