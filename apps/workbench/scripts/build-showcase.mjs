import { build } from "vite";
import { rename } from "node:fs/promises";
await build({ configFile: "vite.showcase.config.mjs", configLoader: "native" });
await rename("showcase-dist/showcase.html", "showcase-dist/index.html");
