import * as Y from "yjs";
import type { RoomTemplate } from "@livepad/shared";

export const DEFAULT_INDEX_JS = `console.log("Hello, Livepad");

function add(a, b) {
  return a + b;
}

console.log("2 + 3 =", add(2, 3));
`;

export const DEFAULT_PACKAGE_JSON = `{
  "name": "livepad-room",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "index.js"
}
`;

export function seedWorkspace(document: Y.Doc, template: RoomTemplate = "node-hello"): void {
  const files = document.getMap<Y.Text>("files");
  if (files.size > 0) return;

  const meta = document.getMap<string>("meta");
  meta.set("entrypoint", "index.js");

  if (template === "empty") {
    const index = new Y.Text();
    index.insert(0, "// Начните писать код\n");
    files.set("index.js", index);
    return;
  }

  const index = new Y.Text();
  index.insert(0, DEFAULT_INDEX_JS);
  files.set("index.js", index);

  const pkg = new Y.Text();
  pkg.insert(0, DEFAULT_PACKAGE_JSON);
  files.set("package.json", pkg);
}

export function yDocToFiles(document: Y.Doc): Record<string, string> {
  const files = document.getMap<Y.Text>("files");
  const out: Record<string, string> = {};
  files.forEach((value, key) => {
    if (value instanceof Y.Text) {
      out[key] = value.toString();
    }
  });
  return out;
}

export function resolveEntrypoint(files: Record<string, string>): string {
  const pkgRaw = files["package.json"];
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw) as { main?: string; scripts?: { start?: string } };
      if (pkg.main && files[pkg.main]) return pkg.main;
    } catch {
      // ignore broken package.json
    }
  }
  if (files["index.js"]) return "index.js";
  if (files["index.ts"]) return "index.ts";
  const firstJs = Object.keys(files).find((name) => name.endsWith(".js") || name.endsWith(".ts"));
  if (!firstJs) throw new Error("В комнате нет JS/TS файла для запуска");
  return firstJs;
}
