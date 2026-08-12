import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        town: resolve(__dirname, "index.html"),
        kairui: resolve(__dirname, "kairui.html"),
      },
    },
  },
});
