import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const packageDir = resolve(import.meta.dirname, "..");
const { subpaths } = JSON.parse(readFileSync(resolve(packageDir, "package-subpaths.json"), "utf8"));

function refuse(name: string): never {
  throw new Error(`a light entry loaded ${name}`);
}
vi.mock("@chalkframes/core", () => refuse("@chalkframes/core"));
vi.mock("@chalkframes/core/compiler", () => refuse("@chalkframes/core/compiler"));
vi.mock("@chalkframes/core/lint", () => refuse("@chalkframes/core/lint"));
vi.mock("hono", () => refuse("hono"));
vi.mock("postcss", () => refuse("postcss"));
vi.mock("sharp", () => refuse("sharp"));

describe("entries a host imports for one helper", () => {
  it.each(["./safe-path", "./hf-ids", "./history", "./screenshot-clip"])(
    "%s loads without core's root, the API, lint or image tooling",
    async (entry) => {
      await expect(import(resolve(packageDir, subpaths[entry].source))).resolves.toBeDefined();
    },
  );
});
