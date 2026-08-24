export type WorldId = "shawn" | "kairui" | "unified";

export type WorldRouteMode = "explore" | "build";

export type WorldRoute = {
  path: string;
  mode: WorldRouteMode;
};

export type WorldMountContext = {
  route: WorldRoute;
};

export type WorldDefinition = {
  id: WorldId;
  name: string;
  description: string;
  routes: readonly WorldRoute[];
  mount(root: HTMLElement, context: WorldMountContext): void;
};

export type ResolvedWorld = {
  world: WorldDefinition;
  route: WorldRoute;
};

export class WorldRegistry {
  readonly #worlds = new Map<WorldId, WorldDefinition>();
  readonly #routes = new Map<string, ResolvedWorld>();

  register(world: WorldDefinition): this {
    if (this.#worlds.has(world.id)) {
      throw new Error(`World "${world.id}" is already registered.`);
    }

    for (const route of world.routes) {
      const path = normalizePath(route.path);
      if (this.#routes.has(path)) {
        throw new Error(`World route "${path}" is already registered.`);
      }
      this.#routes.set(path, { world, route: { ...route, path } });
    }

    this.#worlds.set(world.id, world);
    return this;
  }

  resolve(pathname: string): ResolvedWorld | null {
    return this.#routes.get(normalizePath(pathname)) ?? null;
  }

  get(id: WorldId): WorldDefinition | null {
    return this.#worlds.get(id) ?? null;
  }

  list(): readonly WorldDefinition[] {
    return [...this.#worlds.values()];
  }
}

export function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return `/${pathname.split("/").filter(Boolean).join("/")}`;
}
