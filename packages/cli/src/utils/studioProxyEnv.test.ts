import { describe, expect, it } from "vitest";
import { studioProxyEnv } from "./studioProxyEnv.js";

describe("studioProxyEnv", () => {
  it("forwards an explicit --proxy decision to a Studio child process", () => {
    expect(studioProxyEnv(true, { KEEP: "yes" })).toEqual({
      KEEP: "yes",
      CHALKFRAMES_AUTO_PROXY: "true",
    });
    expect(studioProxyEnv(false, { KEEP: "yes" })).toEqual({
      KEEP: "yes",
      CHALKFRAMES_AUTO_PROXY: "false",
    });
  });

  it("identifies a detached Vite preview to the lifecycle scanner", () => {
    expect(
      studioProxyEnv(
        true,
        { KEEP: "yes" },
        {
          projectDir: "/tmp/video",
          projectName: "video",
          browserGpuMode: "software",
        },
      ),
    ).toMatchObject({
      CHALKFRAMES_PREVIEW_PROJECT_DIR: "/tmp/video",
      CHALKFRAMES_PREVIEW_PROJECT_NAME: "video",
      CHALKFRAMES_PREVIEW_BROWSER_GPU_MODE: "software",
    });
  });
});
