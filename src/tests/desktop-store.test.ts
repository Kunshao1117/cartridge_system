import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_DESKTOP_SETTINGS,
  DesktopProjectStore,
} from "../desktop/project-store.js";

let tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => fs.rm(root, { recursive: true, force: true })),
  );
  tempRoots = [];
});

describe("DesktopProjectStore", () => {
  it("persists normalized project roots", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-store-"));
    tempRoots.push(root);
    const store = new DesktopProjectStore(root);

    await store.write([
      { root: "D:/demo", enabled: true },
      { root: "D:/demo", enabled: false },
    ]);

    expect(await store.read()).toEqual([
      { root: path.resolve("D:/demo"), enabled: true },
    ]);
  });

  it("returns default settings for old project-only store files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-store-"));
    tempRoots.push(root);
    await fs.writeFile(
      path.join(root, "desktop-projects.json"),
      JSON.stringify({ projects: [{ root: "D:/demo", enabled: true }] }),
      "utf-8",
    );

    const store = new DesktopProjectStore(root);

    expect(await store.readSettings()).toEqual(DEFAULT_DESKTOP_SETTINGS);
  });

  it("preserves settings when projects are rewritten", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-store-"));
    tempRoots.push(root);
    const store = new DesktopProjectStore(root);

    await store.writeSettings({ minimizeToTray: false });
    await store.write([{ root: "D:/demo", enabled: true }]);

    expect(await store.readSettings()).toEqual({
      ...DEFAULT_DESKTOP_SETTINGS,
      minimizeToTray: false,
    });
  });
});
