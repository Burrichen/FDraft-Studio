import { SEMVER_PATTERN } from "./schema/primitives.js";
import { SdkError } from "./errors.js";

interface ParsedSemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | undefined;
}

export function parseSemVer(version: string): ParsedSemVer {
  const match = SEMVER_PATTERN.exec(version);
  if (!match) {
    throw new SdkError({
      code: "INVALID_PACKAGE_FORMAT",
      message: `"${version}" is not a valid major.minor.patch[-prerelease] version`,
    });
  }
  const [core, prerelease] = version.split("-", 2) as [string, string | undefined];
  const [major, minor, patch] = core.split(".").map(Number) as [number, number, number];
  return { major, minor, patch, prerelease };
}

/** Standard semver precedence, ignoring prerelease ordering (a prerelease is only ever equal to itself here). */
export function compareSemVer(a: string, b: string): number {
  const pa = parseSemVer(a);
  const pb = parseSemVer(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  if (pa.prerelease === pb.prerelease) return 0;
  if (pa.prerelease === undefined) return 1;
  if (pb.prerelease === undefined) return -1;
  return pa.prerelease < pb.prerelease ? -1 : pa.prerelease > pb.prerelease ? 1 : 0;
}

export function majorVersion(version: string): number {
  return parseSemVer(version).major;
}
