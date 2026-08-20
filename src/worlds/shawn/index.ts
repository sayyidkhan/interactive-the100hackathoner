import type { WorldDefinition } from "../../engine/world";
import { initLoopTown } from "../../world/loopTown";

export const SHAWN_WORLD: WorldDefinition = {
  id: "shawn",
  name: "Edition 01 · Make",
  description: "The editable world-building edition of the operator archive.",
  routes: [
    { path: "/worlds/shawn", mode: "explore" },
    { path: "/local-builder", mode: "build" },
    { path: "/worlds/shawn/build", mode: "build" }
  ],
  mount(root, context) {
    root.dataset.world = "shawn";
    root.dataset.worldMode = context.route.mode;
    initLoopTown(root, { initialBuilder: context.route.mode === "build" });
  }
};
