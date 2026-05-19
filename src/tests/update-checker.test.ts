import { describe, expect, it } from "vitest";
import {
  checkForExtensionUpdate,
  compareVersions,
  findVsixAsset,
  type GitHubRelease,
} from "../update-checker.js";

function release(overrides: Partial<GitHubRelease> = {}): GitHubRelease {
  return {
    tag_name: "v5.3.4",
    html_url: "https://github.com/Kunshao1117/cartridge_system/releases/tag/v5.3.4",
    draft: false,
    prerelease: false,
    assets: [
      {
        name: "cartridge-system-5.3.4.vsix",
        browser_download_url:
          "https://github.com/Kunshao1117/cartridge_system/releases/download/v5.3.4/cartridge-system-5.3.4.vsix",
      },
    ],
    ...overrides,
  };
}

describe("update-checker — 插件更新檢查", () => {
  it("應正確比較含 v 前綴與多位數版本", () => {
    expect(compareVersions("v5.3.10", "5.3.3")).toBe(1);
    expect(compareVersions("5.3.3", "v5.3.10")).toBe(-1);
    expect(compareVersions("v5.3.3", "5.3.3")).toBe(0);
  });

  it("應從 Release assets 找到 VSIX 附件", () => {
    expect(findVsixAsset(release())?.name).toBe("cartridge-system-5.3.4.vsix");
    expect(
      findVsixAsset(release({ assets: [{ name: "source.zip" }] })),
    ).toBeUndefined();
  });

  it("新版正式 Release 且含 VSIX 時應回報 available", async () => {
    const result = await checkForExtensionUpdate({
      currentVersion: "5.3.3",
      requestJson: async () => release(),
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "available",
        currentVersion: "5.3.3",
        latestVersion: "5.3.4",
        assetName: "cartridge-system-5.3.4.vsix",
      }),
    );
  });

  it("相同版本應回報 current", async () => {
    const result = await checkForExtensionUpdate({
      currentVersion: "5.3.4",
      requestJson: async () => release(),
    });

    expect(result.status).toBe("current");
  });

  it("draft 或 prerelease 不應視為可更新版本", async () => {
    const result = await checkForExtensionUpdate({
      currentVersion: "5.3.3",
      requestJson: async () => release({ prerelease: true }),
    });

    expect(result.status).toBe("unavailable");
    expect(result.reason).toContain("stable public release");
  });

  it("缺少 VSIX 附件時應回報 unavailable", async () => {
    const result = await checkForExtensionUpdate({
      currentVersion: "5.3.3",
      requestJson: async () => release({ assets: [{ name: "source.zip" }] }),
    });

    expect(result.status).toBe("unavailable");
    expect(result.reason).toContain("VSIX");
  });

  it("GitHub API 失敗時應回報 error", async () => {
    const result = await checkForExtensionUpdate({
      currentVersion: "5.3.3",
      requestJson: async () => {
        throw new Error("rate limited");
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "error",
        currentVersion: "5.3.3",
        reason: "rate limited",
      }),
    );
  });
});
