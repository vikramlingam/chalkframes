import { describe, expect, it } from "vitest";
import { isChalkframesProject } from "./projectRule";

describe("isChalkframesProject", () => {
  it.each(["chalkframes.json", "meta.json", "project.json"])(
    "counts a folder with index.html and %s",
    (marker) => {
      expect(isChalkframesProject(["index.html", marker, "assets"])).toBe(true);
    },
  );

  it("does not count index.html alone, or a marker without index.html", () => {
    expect(isChalkframesProject(["index.html", "package.json"])).toBe(false);
    expect(isChalkframesProject(["chalkframes.json", "README.md"])).toBe(false);
  });
});
