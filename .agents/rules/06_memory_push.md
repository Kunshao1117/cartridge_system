---
trigger: model_decision
description: 本規範在每次新對話的首次回應前自動生效。執行路徑由 `01_cross_lingual_guard.md` 的系統準備清單 Turn=1 承諾行聯動觸發。
---

# [MEMORY PUSH MECHANISM — 記憶主動推播機制]

## 觸發時機

本規範在每次新對話的首次回應前自動生效。執行路徑由 `01_cross_lingual_guard.md`
的系統準備清單 Turn=1 承諾行聯動觸發。

## 三路徑結構性探測流程

```
對話啟動 → 呼叫 cartridge-system__memory_list()
├── "_map" 在清單中
│   └── → 呼叫 cartridge-system__memory_read("_map")
│       → 將地圖索引載入上下文（AI 得知所有模組範圍）
├── "_map" 不在清單，但清單非空
│   └── → 若清單包含 "_system"：呼叫 cartridge-system__memory_read("_system")
│       → 輸出「⚠️ _map 導航卡尚未建立，建議執行一次 /02_blueprint 初始化。」
└── 清單為空
    └── → 輸出「📭 本專案尚無記憶卡，以純對話模式繼續。」
        → 不阻塞，繼續回應。
```