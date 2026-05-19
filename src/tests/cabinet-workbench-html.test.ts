import { describe, expect, it } from "vitest";
import { buildCabinetWorkbenchHtml } from "../cabinet-workbench-html.js";

describe("cabinet workbench html", () => {
  it("應產生含 CSP、外部腳本與卡匣機櫃容器的 Webview HTML", () => {
    const html = buildCabinetWorkbenchHtml({
      cspSource: "vscode-resource:",
      nonce: "nonce-123",
      scriptUri: "vscode-resource:/dist/cabinet-webview.global.js",
    });

    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("script-src 'nonce-nonce-123'");
    expect(html).toContain('src="vscode-resource:/dist/cabinet-webview.global.js"');
    expect(html).toContain("卡匣機櫃");
    expect(html).toContain('id="cy"');
    expect(html).toContain('id="filterBar"');
    expect(html).toContain('class="mode-dock"');
    expect(html).toContain('data-lens="maintenance"');
    expect(html).toContain("維護艙");
    expect(html).toContain("記憶艙");
    expect(html).toContain("結構艙");
    expect(html).toContain('id="zoomOut"');
    expect(html).toContain('aria-label="縮小圖譜"');
    expect(html).toContain('id="zoomPercent"');
    expect(html).toContain(">100%</button>");
    expect(html).toContain('aria-label="放大圖譜"');
    expect(html).toContain(">重置視角<");
    expect(html).toContain(">刷新資料<");
    expect(html).not.toContain(">FIT<");
    expect(html).not.toContain(">R<");
  });
});
