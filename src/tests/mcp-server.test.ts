import { describe, expect, it } from "vitest";
import {
  formatMcpServerHelp,
  MCP_SERVER_VERSION,
  parseMcpServerCliArgs,
} from "../mcp-server.js";

describe("mcp-server — CLI 入口", () => {
  it("應解析 --workspace 參數", () => {
    expect(
      parseMcpServerCliArgs(["--workspace", "D:\\cartridge_system"]),
    ).toEqual({
      workspace: "D:\\cartridge_system",
      help: false,
      version: false,
    });
  });

  it("應支援 --workspace=path 寫法", () => {
    expect(
      parseMcpServerCliArgs(["--workspace=D:\\cartridge_system"]),
    ).toEqual({
      workspace: "D:\\cartridge_system",
      help: false,
      version: false,
    });
  });

  it("應支援 help 與 version 查詢", () => {
    expect(parseMcpServerCliArgs(["--help"]).help).toBe(true);
    expect(parseMcpServerCliArgs(["--version"]).version).toBe(true);
    expect(MCP_SERVER_VERSION).toBe("5.5.2");
    expect(formatMcpServerHelp()).toContain("--workspace <path>");
  });

  it("缺少 workspace 值時應回報錯誤", () => {
    expect(() => parseMcpServerCliArgs(["--workspace"])).toThrow(
      "--workspace requires",
    );
  });

  it("未知參數應回報錯誤，避免 MCP 以錯誤設定啟動", () => {
    expect(() => parseMcpServerCliArgs(["--project", "D:\\x"])).toThrow(
      "Unknown option",
    );
  });
});
