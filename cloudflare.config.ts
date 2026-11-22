import { defineConfig } from "cf/config";

// A static site: everything in site/ is served as-is (see wrangler.config.ts) at game.amqm.dev.
export default defineConfig({
  worker: {
    name: "pylon-field",
    compatibilityDate: "2026-11-17",
    domains: ["game.amqm.dev"],
  },
});
