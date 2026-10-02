// Copies MapLibre's ESM worker (and its shared chunk) into public/ so the map
// can load it via setWorkerUrl regardless of bundler. Runs before dev/build.
import { cpSync, mkdirSync } from "node:fs";
const src = "node_modules/maplibre-gl/dist";
mkdirSync("public/maplibre", { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) cpSync(`${src}/${f}`, `public/maplibre/${f}`);
