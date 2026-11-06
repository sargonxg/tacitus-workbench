import { readFile, readdir, lstat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = join(root, "FILE_INVENTORY.json");
const manifest = JSON.parse(await readFile(target, "utf8"));
const previous = new Map(manifest.files.map((entry) => [entry.path, entry]));
const ignored = new Set([
  "node_modules",
  "dist",
  "showcase-dist",
  "output",
  ".git",
  ".wrangler",
]);
const files = [];
async function scan(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(item.name)) continue;
    const absolute = join(directory, item.name);
    if ((await lstat(absolute)).isSymbolicLink())
      throw new Error("Unexpected deliverable link");
    if (item.isDirectory()) {
      await scan(absolute);
      continue;
    }
    const path = relative(root, absolute).split(sep).join("/");
    if (path === "FILE_INVENTORY.json") continue;
    const raw = await readFile(absolute);
    const sha256 = createHash("sha256").update(raw).digest("hex");
    const prior = previous.get(path);
    files.push({
      ...(prior || {
        origin: path.startsWith("public/semantic/")
          ? "Source-derived semantic navigation subset; UCDP/World Bank attribution, source licences and modifications in public/semantic/SOURCE-NOTICE.json"
          : "Independent Workbench semantic exploration implementation or actual UI verification; existing application rights retained",
      }),
      path,
      sha256,
      bytes: raw.length,
      ...(prior && prior.sha256 !== sha256
        ? {
            semantic_exploration_previous_sha256:
              prior.semantic_exploration_previous_sha256 || prior.sha256,
            semantic_exploration_note:
              "Updated for source-derived semantic exploration and bounded Context Capsule preparation; previous provenance and rights retained",
          }
        : {}),
    });
  }
}
await scan(root);
manifest.files = files.sort((a, b) => a.path.localeCompare(b.path, "en"));
await writeFile(target, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  `Updated ${files.length} deliverable identities; verify before committing.`,
);
