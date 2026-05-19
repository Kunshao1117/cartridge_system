import https from "node:https";

export const DEFAULT_RELEASE_API_URL =
  "https://api.github.com/repos/Kunshao1117/cartridge_system/releases/latest";

const VSIX_NAME_PATTERN = /^cartridge-system-.+\.vsix$/;

export interface ReleaseAsset {
  name: string;
  browser_download_url?: string;
}

export interface GitHubRelease {
  tag_name?: string;
  name?: string;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: ReleaseAsset[];
}

export type UpdateCheckStatus =
  | "available"
  | "current"
  | "unavailable"
  | "error";

export interface UpdateCheckResult {
  status: UpdateCheckStatus;
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  assetName?: string;
  assetUrl?: string;
  reason?: string;
}

export interface UpdateCheckOptions {
  currentVersion: string;
  releaseApiUrl?: string;
  requestJson?: (url: string) => Promise<GitHubRelease>;
}

export async function checkForExtensionUpdate(
  options: UpdateCheckOptions,
): Promise<UpdateCheckResult> {
  const releaseApiUrl = options.releaseApiUrl ?? DEFAULT_RELEASE_API_URL;
  const requestJson = options.requestJson ?? fetchJson;

  try {
    const release = await requestJson(releaseApiUrl);
    const latestVersion = normalizeVersion(release.tag_name ?? "");

    if (release.draft || release.prerelease) {
      return {
        status: "unavailable",
        currentVersion: options.currentVersion,
        latestVersion,
        releaseUrl: release.html_url,
        reason: "latest release is not a stable public release",
      };
    }

    if (!latestVersion || !release.html_url) {
      return {
        status: "unavailable",
        currentVersion: options.currentVersion,
        reason: "latest release payload is missing version or URL",
      };
    }

    const asset = findVsixAsset(release);
    if (!asset) {
      return {
        status: "unavailable",
        currentVersion: options.currentVersion,
        latestVersion,
        releaseUrl: release.html_url,
        reason: "latest release does not include a cartridge-system VSIX asset",
      };
    }

    if (compareVersions(latestVersion, options.currentVersion) <= 0) {
      return {
        status: "current",
        currentVersion: options.currentVersion,
        latestVersion,
        releaseUrl: release.html_url,
        assetName: asset.name,
        assetUrl: asset.browser_download_url,
      };
    }

    return {
      status: "available",
      currentVersion: options.currentVersion,
      latestVersion,
      releaseUrl: release.html_url,
      assetName: asset.name,
      assetUrl: asset.browser_download_url,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "error",
      currentVersion: options.currentVersion,
      reason: message,
    };
  }
}

export function compareVersions(left: string, right: string): number {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

export function findVsixAsset(release: GitHubRelease): ReleaseAsset | undefined {
  return release.assets?.find((asset) => VSIX_NAME_PATTERN.test(asset.name));
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

function versionParts(version: string): number[] {
  return normalizeVersion(version)
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function fetchJson(url: string): Promise<GitHubRelease> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "cartridge-system-update-checker",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (!response.statusCode || response.statusCode >= 400) {
            reject(
              new Error(`GitHub release request failed: ${response.statusCode}`),
            );
            return;
          }

          try {
            resolve(JSON.parse(body) as GitHubRelease);
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on("error", reject);
    request.setTimeout(10_000, () => {
      request.destroy(new Error("GitHub release request timed out"));
    });
  });
}
