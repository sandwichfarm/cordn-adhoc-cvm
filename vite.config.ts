import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  resolve: {
    alias: {
      fs: fileURLToPath(new URL("./src/shims/node-fs.ts", import.meta.url)),
      path: fileURLToPath(new URL("./src/shims/node-path.ts", import.meta.url)),
      crypto: fileURLToPath(new URL("./src/shims/node-crypto.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
  },
});
