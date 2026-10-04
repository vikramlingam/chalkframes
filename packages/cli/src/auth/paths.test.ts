import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { CREDENTIAL_FILENAME, configDir, credentialPath } from "./paths.js";

describe("auth/paths", () => {
  const original = process.env["CHALKFRAMES_CONFIG_DIR"];

  beforeEach(() => {
    delete process.env["CHALKFRAMES_CONFIG_DIR"];
  });

  afterEach(() => {
    if (original !== undefined) process.env["CHALKFRAMES_CONFIG_DIR"] = original;
    else delete process.env["CHALKFRAMES_CONFIG_DIR"];
  });

  it("defaults to ~/.chalkframes", () => {
    expect(configDir()).toBe(join(homedir(), ".chalkframes"));
  });

  it("honors CHALKFRAMES_CONFIG_DIR override", () => {
    process.env["CHALKFRAMES_CONFIG_DIR"] = "/tmp/some-test-dir";
    expect(configDir()).toBe("/tmp/some-test-dir");
    expect(credentialPath()).toBe(join("/tmp/some-test-dir", CREDENTIAL_FILENAME));
  });

  it("treats empty CHALKFRAMES_CONFIG_DIR as unset", () => {
    process.env["CHALKFRAMES_CONFIG_DIR"] = "";
    expect(configDir()).toBe(join(homedir(), ".chalkframes"));
  });
});
