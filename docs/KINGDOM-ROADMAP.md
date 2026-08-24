# Multi-Kingdom Roadmap

The 100 Hackathoner is evolving from one editable town into a reusable open-world
portfolio engine with multiple connected kingdoms.

## Branch milestones

| Branch | Product milestone |
| --- | --- |
| `codex/loop-town-amazing-pass` | Major single-town polish pass for the exploration loop, discovery journal, HUD and town presentation |
| `dev-v2` | Shawn Kingdom |
| `dev-v3` | Shawn Kingdom with editable world-building tools |
| `codex/decompile-kairui` | Technical study archive of Kairui's public coastal portfolio |
| `codex/kairui-kingdom` | Maintainable multi-world engine and Kairui-inspired prototype |
| `dev-v4` | Coastal Hackathon Kingdom |
| `dev-v5` | Unified Shawn + Kairui open world |

## Product vision

### Loop Town foundation

`codex/loop-town-amazing-pass` is the last major single-town product milestone
before the multi-kingdom architecture. It expanded the discovery catalogue and
refined the core loop, HUD, persistent journal and town composition. It is an
ancestor of `dev-v5`, not a separate production destination, and remains a
useful checkpoint for understanding how the portfolio experience evolved.

### Shawn Kingdom

The village is the creation and management district. It owns the editable town,
asset inventory, residents, animals, discoveries, weather, seasons and the
operator journal.

### Kairui Kingdom

The coast is the cinematic storytelling district. It adds authored terrain,
sea and water treatment, a guided camera journey, boats, balloon travel and a
physical harbour where shipped hackathons become landmarks.

### Unified world

`dev-v5` connects both districts through one player identity, one discovery
ledger and one environment clock. Each kingdom keeps a recognisable visual and
interaction identity while sharing the engine beneath it.

## Architecture direction

The production code must not depend directly on the captured Kairui runtime.
That branch remains a reference. Reusable concepts are reconstructed as typed,
maintainable systems in this repository.

```text
src/
  engine/       world registry, lifecycle, rendering and shared contracts
  worlds/
    shawn/      village composition and builder configuration
    kairui/     coastal terrain, harbour and guided journey
    unified/    connections and cross-kingdom travel
  world/        reusable entities and gameplay systems during migration
```

The migration is incremental: existing routes stay functional while systems
move behind world contracts. New coastal code enters through the registry rather
than adding more branches to the application entry point.

## Delivery gates

Status: all three milestones below are implemented. This document now doubles
as the architecture contract for future kingdoms.

### `codex/kairui-kingdom`

- Existing Shawn explore and builder routes remain behaviourally compatible.
- World selection is registry-driven.
- Shared engine boundaries are explicit and typed.
- A coastal prototype can mount without importing Shawn's town composition.

Implemented in `902fc71` and `0d2ad4d`.

### `dev-v4`

- The coast tells Sayyid's hackathon story rather than copying another person's
  portfolio content.
- Visitors can use a guided tour or free exploration.
- Projects appear as harbour landmarks and vessels.
- Day/night, seasons and weather work in the coastal biome.
- Performance and cleanup are verified before adding a second live kingdom.

Implemented in `538b231`.

### `dev-v5`

- Shawn and Kairui kingdoms run from the same engine.
- Progress and player identity persist while travelling between kingdoms.
- Cross-kingdom travel is intentional and testable.
- Both kingdoms retain their defining interaction model.

Implemented on `dev-v5`. The root route is the unified hub; `/worlds/shawn`
and `/worlds/kairui` remain independently mountable and `/local-builder`
continues to own the village editing workflow.
