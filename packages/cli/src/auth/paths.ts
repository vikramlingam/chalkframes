/**
 * Filesystem layout for the shared Chalkframes credential store. Mirrors
 * `chalkframes-cli/internal/paths/paths.go` so both CLIs read the same file.
 * `CHALKFRAMES_CONFIG_DIR` overrides the directory.
 */

import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Filename for the credential store. Matches chalkframes-cli (no `.json`
 * suffix) so a `~/.chalkframes/credentials` written by either CLI is
 * readable by the other — see `chalkframes-cli/internal/auth/file_resolver.go`.
 */
export const CREDENTIAL_FILENAME = "credentials";

export function configDir(): string {
  const override = process.env["CHALKFRAMES_CONFIG_DIR"];
  if (override && override.length > 0) return override;
  return join(homedir(), ".chalkframes");
}

export function credentialPath(): string {
  return join(configDir(), CREDENTIAL_FILENAME);
}
