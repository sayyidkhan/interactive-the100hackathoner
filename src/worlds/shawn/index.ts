import type { WorldDefinition } from "../../engine/world";
import { initLoopTown } from "../../world/loopTown";

export const SHAWN_WORLD: WorldDefinition = {
  id: "shawn",
  name: "Shawn Kingdom",
  description: "The editable village, residents and discovery-journal kingdom.",
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
