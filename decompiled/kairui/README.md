# Kairui coastal portfolio study

This directory is a study archive of the public experience served from
`https://kairui.dev/` on 12 August 2026. The runnable reconstruction is exposed
through the repository's Vite app at `/kairui.html`.

## Layout

- `raw/` contains the captured HTML, inline loader, inline Three.js module,
  stylesheet and public image/font assets as served by the site.
- `readable/` preserves the already-readable procedural source separately from
  the captured page shell.
- `src/kairui/` contains the small Vite adaptation. It replaces the live site's
  runtime download of `three.module.js` with this repository's pinned `three`
  package, while retaining the scene implementation.

## Architecture notes

The experience does not rely on exported GLTF scenery. Almost everything is
generated in code: the terrain, coast and water shader, sky and time-of-day
lighting, village, workshop, harbor, boats, wildlife, camp props, balloon,
camera path, guided tour, interactions and procedural audio.

The strongest patterns worth carrying back into the town project are:

1. A authored camera spline turns a large world into a paced narrative.
2. Atmospheric softness comes from fog, restrained contrast, a warm palette,
   sky gradients, moving water and a subtle screen vignette—not blur alone.
3. Each work item owns a physical landmark, so content and environment reinforce
   each other rather than competing as separate UI layers.
4. Optional boat and balloon controls add delight without blocking the primary
   scroll-based story.

## Capture limits

- `mirai.png` and `hsk.png` returned HTTP 404 on the live site during capture.
- `raw/index.html` is a post-load DOM capture and its embedded copy of the very
  large module was clipped by the browser bridge. `raw/app.js` is the canonical,
  complete module, recovered separately in bounded chunks and verified to contain
  no truncation marker.
- The live resume and vendor `three.module.js` are referenced rather than copied.
  The reconstruction uses the local npm dependency for Three.js.
- This archive is for technical study. Verify ownership and permission before
  republishing another creator's copy, imagery or identity.

## Run

```sh
npm run dev
```

Then open `http://127.0.0.1:5173/kairui.html`.
