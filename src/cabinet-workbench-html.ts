export function buildCabinetWorkbenchHtml(args: {
  cspSource: string;
  nonce: string;
  scriptUri: string;
}): string {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${args.cspSource} data:; style-src ${args.cspSource} 'unsafe-inline'; script-src 'nonce-${args.nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>卡匣機櫃</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #06080d;
      --deck: #0a0f17;
      --panel: #0f1721;
      --panel-2: #111b27;
      --rail: #182433;
      --line: #2c3b4c;
      --text: #e8f0f5;
      --muted: #8d9aa7;
      --faint: #536171;
      --maintenance: #ffb14a;
      --maintenance-2: #ff5d64;
      --memory: #42d9c8;
      --memory-2: #a889ff;
      --structure: #8de38f;
      --structure-2: #55a8ff;
      --accent: var(--maintenance);
      --accent-2: var(--maintenance-2);
    }
    body[data-lens="memory"] { --accent: var(--memory); --accent-2: var(--memory-2); }
    body[data-lens="structure"] { --accent: var(--structure); --accent-2: var(--structure-2); }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      height: 100vh;
      overflow: hidden;
      background:
        linear-gradient(90deg, rgba(255, 177, 74, .08), transparent 22rem),
        linear-gradient(135deg, #06080d 0%, #09111a 48%, #10141a 100%);
      color: var(--text);
      font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    body[data-lens="memory"] {
      background:
        linear-gradient(90deg, rgba(66, 217, 200, .08), transparent 24rem),
        linear-gradient(135deg, #06080d 0%, #0c1118 48%, #11121b 100%);
    }
    body[data-lens="structure"] {
      background:
        linear-gradient(90deg, rgba(141, 227, 143, .07), transparent 24rem),
        linear-gradient(135deg, #06080d 0%, #0b1116 48%, #0e141d 100%);
    }
    button, input {
      font: inherit;
      color: var(--text);
    }
    button {
      cursor: pointer;
    }
    #app {
      display: grid;
      grid-template-columns: 128px minmax(0, 1fr) 360px;
      grid-template-rows: 82px minmax(0, 1fr);
      height: 100vh;
    }
    .cabinet-top {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: 260px minmax(220px, 1fr) auto;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(107, 128, 150, .24);
      background: rgba(7, 11, 17, .92);
      backdrop-filter: blur(18px);
    }
    .brand-kicker {
      color: var(--accent);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    h1 {
      margin: 1px 0 0;
      font-size: 21px;
      font-weight: 750;
      letter-spacing: 0;
    }
    .command-strip {
      display: grid;
      grid-template-columns: minmax(180px, 420px) auto;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    #search {
      width: 100%;
      height: 38px;
      border: 1px solid rgba(124, 148, 170, .28);
      border-radius: 8px;
      background: rgba(10, 16, 24, .92);
      padding: 0 12px;
      outline: none;
    }
    #search:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, .03), 0 0 22px rgba(255, 177, 74, .14);
    }
    #searchCount {
      color: var(--muted);
      white-space: nowrap;
    }
    #stats {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      white-space: nowrap;
    }
    .stat-cell {
      min-width: 78px;
      border: 1px solid rgba(124, 148, 170, .2);
      background: rgba(14, 22, 32, .72);
      padding: 7px 10px;
      border-radius: 7px;
    }
    .stat-cell strong {
      display: block;
      font-size: 17px;
      color: var(--accent);
      line-height: 1;
    }
    .stat-cell small {
      color: var(--muted);
    }
    .mode-dock {
      display: grid;
      gap: 10px;
      align-content: start;
      padding: 14px 10px;
      border-right: 1px solid rgba(107, 128, 150, .22);
      background:
        repeating-linear-gradient(180deg, rgba(255, 255, 255, .035) 0 1px, transparent 1px 18px),
        rgba(7, 11, 17, .76);
    }
    .lens-card {
      position: relative;
      min-height: 116px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 8px;
      border: 1px solid rgba(124, 148, 170, .24);
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(17, 27, 39, .96), rgba(10, 15, 22, .96));
      padding: 10px;
      text-align: left;
      overflow: hidden;
    }
    .lens-card::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: var(--lens);
      opacity: .45;
    }
    .lens-card::after {
      content: "";
      position: absolute;
      inset: auto 10px 10px 10px;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--lens), transparent);
      opacity: .34;
    }
    .lens-card.active {
      border-color: var(--lens);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .035), 0 0 24px rgba(255, 177, 74, .12);
      transform: translateX(2px);
    }
    .lens-maintenance { --lens: var(--maintenance); }
    .lens-memory { --lens: var(--memory); }
    .lens-structure { --lens: var(--structure); }
    .lens-code {
      color: var(--lens);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0;
    }
    .lens-card strong {
      align-self: end;
      font-size: 15px;
      letter-spacing: 0;
    }
    .lens-card small {
      color: var(--muted);
      min-height: 34px;
      line-height: 1.25;
    }
    .lens-meter {
      height: 4px;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--lens), rgba(255, 255, 255, .12));
    }
    .graph-shell {
      position: relative;
      min-width: 0;
      min-height: 0;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      background:
        linear-gradient(rgba(255, 255, 255, .018) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, .014) 1px, transparent 1px);
      background-size: 44px 44px;
    }
    .filter-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 52px;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(107, 128, 150, .2);
      background: rgba(8, 13, 20, .66);
    }
    .filter-chip {
      height: 32px;
      border: 1px solid rgba(124, 148, 170, .22);
      border-radius: 999px;
      background: rgba(13, 20, 29, .86);
      padding: 0 12px;
      color: #c8d4df;
    }
    .filter-chip.active {
      border-color: var(--accent);
      color: #06100f;
      background: var(--accent);
      box-shadow: 0 0 18px rgba(255, 177, 74, .16);
    }
    .filter-reset {
      margin-left: auto;
      border-radius: 7px;
    }
    .stage-frame {
      position: relative;
      min-width: 0;
      min-height: 0;
    }
    #cy {
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
    }
    .viewport-actions {
      position: absolute;
      right: 16px;
      bottom: 16px;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .icon-button,
    .zoom-button,
    .zoom-percent {
      height: 38px;
      border: 1px solid rgba(124, 148, 170, .28);
      border-radius: 8px;
      background: rgba(9, 14, 21, .88);
      font-weight: 800;
    }
    .icon-button {
      min-width: 88px;
      padding: 0 12px;
    }
    .zoom-button {
      width: 38px;
      padding: 0;
      font-size: 18px;
      line-height: 1;
    }
    .zoom-percent {
      min-width: 62px;
      padding: 0 10px;
      color: var(--accent);
    }
    .icon-button:hover,
    .zoom-button:hover,
    .zoom-percent:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
    #details {
      border-left: 1px solid rgba(107, 128, 150, .22);
      background: linear-gradient(180deg, rgba(15, 23, 33, .96), rgba(7, 10, 15, .98));
      padding: 16px;
      overflow: auto;
    }
    .detail-head {
      border-bottom: 1px solid rgba(124, 148, 170, .22);
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .detail-lens {
      color: var(--accent);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0;
    }
    .title {
      margin: 3px 0 5px;
      font-size: 20px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    .muted {
      color: var(--muted);
    }
    .description {
      color: #cfd9e4;
      margin: 10px 0 14px;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 12px 0;
    }
    .metric {
      border: 1px solid rgba(124, 148, 170, .18);
      border-radius: 8px;
      background: rgba(9, 14, 21, .66);
      padding: 9px 10px;
    }
    .metric span {
      display: block;
      color: var(--muted);
      font-size: 12px;
    }
    .metric strong {
      display: block;
      margin-top: 2px;
      color: var(--accent);
      font-size: 18px;
    }
    h3 {
      margin: 18px 0 8px;
      font-size: 12px;
      color: var(--accent);
      letter-spacing: 0;
    }
    .list {
      margin: 8px 0 0;
      padding-left: 18px;
    }
    .list li {
      margin: 5px 0;
      color: #cbd6df;
    }
    .pill {
      display: inline-block;
      border: 1px solid rgba(124, 148, 170, .24);
      border-radius: 999px;
      padding: 3px 8px;
      margin: 3px 4px 3px 0;
      color: #c8d4df;
      background: rgba(13, 20, 29, .72);
    }
    .open-card {
      width: 100%;
      height: 38px;
      margin-top: 18px;
      border: 1px solid var(--accent);
      border-radius: 8px;
      background: rgba(255, 255, 255, .04);
      color: var(--accent);
      font-weight: 700;
    }
    #empty {
      display: none;
      position: absolute;
      inset: 52px 360px 0 128px;
      place-items: center;
      color: var(--muted);
      background: rgba(6, 8, 13, .52);
      pointer-events: none;
    }
    @media (max-width: 980px) {
      #app {
        grid-template-columns: 92px minmax(0, 1fr);
        grid-template-rows: 120px minmax(0, 1fr) 280px;
      }
      .cabinet-top {
        grid-template-columns: 1fr;
        align-items: start;
      }
      #stats {
        justify-content: flex-start;
        overflow: auto;
      }
      #details {
        grid-column: 1 / -1;
        border-left: 0;
        border-top: 1px solid rgba(107, 128, 150, .22);
      }
      #empty {
        inset: 120px 0 280px 92px;
      }
    }
  </style>
</head>
<body data-lens="maintenance">
  <div id="app">
    <header class="cabinet-top">
      <div class="brand">
        <div class="brand-kicker">CARTRIDGE CABINET</div>
        <h1>卡匣機櫃</h1>
      </div>
      <div class="command-strip">
        <input id="search" placeholder="搜尋卡匣、檔案、概念、決策">
        <span id="searchCount">0 命中</span>
      </div>
      <div id="stats"></div>
    </header>
    <nav id="modeDock" class="mode-dock" aria-label="卡匣機櫃模式">
      <button data-lens="maintenance" class="lens-card lens-maintenance active">
        <span class="lens-code">01</span>
        <strong>維護艙</strong>
        <small data-lens-count="maintenance">待載入</small>
        <span class="lens-meter"></span>
      </button>
      <button data-lens="memory" class="lens-card lens-memory">
        <span class="lens-code">02</span>
        <strong>記憶艙</strong>
        <small data-lens-count="memory">待載入</small>
        <span class="lens-meter"></span>
      </button>
      <button data-lens="structure" class="lens-card lens-structure">
        <span class="lens-code">03</span>
        <strong>結構艙</strong>
        <small data-lens-count="structure">待載入</small>
        <span class="lens-meter"></span>
      </button>
    </nav>
    <main class="graph-shell">
      <div id="filterBar" class="filter-bar"></div>
      <div class="stage-frame">
        <div id="cy"></div>
        <div class="viewport-actions">
          <button id="zoomOut" class="zoom-button" title="縮小圖譜" aria-label="縮小圖譜">-</button>
          <button id="zoomPercent" class="zoom-percent" title="回到 100%" aria-label="回到 100%">100%</button>
          <button id="zoomIn" class="zoom-button" title="放大圖譜" aria-label="放大圖譜">+</button>
          <button id="fit" class="icon-button" title="重置視角" aria-label="重置視角">重置視角</button>
          <button id="refresh" class="icon-button" title="刷新資料" aria-label="刷新資料">刷新資料</button>
        </div>
      </div>
    </main>
    <aside id="details"></aside>
  </div>
  <div id="empty">目前沒有可呈現的卡匣資料</div>
  <script nonce="${args.nonce}" src="${args.scriptUri}"></script>
</body>
</html>`;
}
