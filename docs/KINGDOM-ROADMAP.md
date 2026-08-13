# Multi-Kingdom Roadmap

The 100 Hackathoner is evolving from one editable town into a reusable open-world
portfolio engine with multiple connected kingdoms.

## Branch milestones

| Branch | Product milestone |
| --- | --- |
| `dev-v2` | Shawn Kingdom |
| `dev-v3` | Shawn Kingdom with editable world-building tools |
| `codex/decompile-kairui` | Technical study archive of Kairui's public coastal portfolio |
| `codex/kairui-kingdom` | Maintainable multi-world engine and Kairui-inspired prototype |
| `dev-v4` | Coastal Hackathon Kingdom |
| `dev-v5` | Unified Shawn + Kairui open world |

## Product vision

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

### `codex/kairui-kingdom`

- Existing Shawn explore and builder routes remain behaviourally compatible.
- World selection is registry-driven.
- Shared engine boundaries are explicit and typed.
- A coastal prototype can mount without importing Shawn's town composition.

### `dev-v4`

- The coast tells Sayyid's hackathon story rather than copying another person's
  portfolio content.
- Visitors can use a guided tour or free exploration.
- Projects appear as harbour landmarks and vessels.
- Day/night, seasons and weather work in the coastal biome.
- Performance and cleanup are verified before adding a second live kingdom.

### `dev-v5`

- Shawn and Kairui kingdoms run from the same engine.
- Progress and player identity persist while travelling between kingdoms.
- Cross-kingdom travel is intentional and testable.
- Both kingdoms retain their defining interaction model.
