export function studioProxyEnv(
  autoProxy: boolean,
  baseEnv: NodeJS.ProcessEnv = process.env,
  preview?: {
    projectDir: string;
    projectName: string;
    browserGpuMode?: "auto" | "hardware" | "software";
  },
): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    CHALKFRAMES_AUTO_PROXY: autoProxy ? "true" : "false",
    ...(preview
      ? {
          CHALKFRAMES_PREVIEW_PROJECT_DIR: preview.projectDir,
          CHALKFRAMES_PREVIEW_PROJECT_NAME: preview.projectName,
          ...(preview.browserGpuMode
            ? { CHALKFRAMES_PREVIEW_BROWSER_GPU_MODE: preview.browserGpuMode }
            : {}),
        }
      : {}),
  };
}
