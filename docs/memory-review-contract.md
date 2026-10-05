# 記憶卡複審與同步契約

本契約對齊 AI_Rules main `2b6add3931ae4e5c202fa73be9fa979203934f55`。固定來源：
- [Memory governance](https://github.com/Kunshao1117/AI_Rules/blob/2b6add3931ae4e5c202fa73be9fa979203934f55/Shared/policies/memory-governance.md)
- [Workflow memory evidence](https://github.com/Kunshao1117/AI_Rules/blob/2b6add3931ae4e5c202fa73be9fa979203934f55/Shared/policies/references/workflow-memory-evidence.md)
- [Review evidence](https://github.com/Kunshao1117/AI_Rules/blob/2b6add3931ae4e5c202fa73be9fa979203934f55/Shared/policies/references/memory-review-evidence.md)
- [Write/sync evidence](https://github.com/Kunshao1117/AI_Rules/blob/2b6add3931ae4e5c202fa73be9fa979203934f55/Shared/policies/references/memory-update-sync-evidence.md)

- [Authorization resolution](https://github.com/Kunshao1117/AI_Rules/blob/2b6add3931ae4e5c202fa73be9fa979203934f55/Shared/policies/authorization-resolution.md)
- [Repository source reconciliation](https://github.com/Kunshao1117/AI_Rules/blob/2b6add3931ae4e5c202fa73be9fa979203934f55/Shared/policies/references/repository-memory-reconciliation.md)

## 來源有變動，先複審

stale 表示需要比較現行相關來源與卡片，不證明全部主張已失真，也不授權改卡。直接 stale 的既有 gate 與 commit_preflight 適用範圍保持不變；間接 stale 是非阻塞的上游複審提示。工具不會因為代理宣稱 no-write 而消除 stale。

複審證據由 AI_Rules 工作流程保管：source slice/revision、card revision/scope、owner、比較的 claims、disposition、content 或 tracking-only 原因、尚缺證據。Cartridge 提供來源路徑、內容、追蹤、異動與同步證據；沒有新增七態持久化機器、M5 cutover 引擎或自動改卡規則。confirm:true 代表此次工具寫入確認，不能代替取得使用者授權。

## 七種 workflow disposition

- memory-not-required：已檢查變更範圍沒有需要維護的長期知識；沒有卡本身不是理由
- memory-attributed-no-write：已比較目前來源與卡片，owner、scope、claims 與 tracking 仍正確，記錄版本與比較證據；不改卡、不呼叫 memory_commit 或 memory_reindex，不宣稱 stale 已清
- memory-required：內容或必要 tracking/owner/dependency/metadata 需調整；content 與 tracking-only 是原因，並非新 disposition，也不自行授權寫入
- memory-card-missing：需要長期知識 owner，但無法安全確認現有卡；記錄候選與 ownership 疑點，不自動建卡
- memory-blocked-by-scope：已知必要操作受唯讀、範圍或適用 protected phase 限制；只暫停受影響操作
- memory-conflict-or-compaction-blocked：證據衝突，或必要寫入前須解決實際 compaction/split 限制；不靜默選邊
- memory-unverified：來源、卡片、版本或比較證據不足；明確列缺口，不能猜成 no-write

## 版本與最小修改

T16：來源實作改變但相關 durable claims、owner、scope、tracking 全部仍正確時，工作流程可用版本綁定比較證據回報 memory-attributed-no-write。唯讀工具不能因此寫卡、commit、reindex 或抹除索引 stale。

T17：新 owned file 或真實 dependency 改變，即使 Current Truth 正文不變，也屬 memory-required + tracking-only。只做核准範圍，不強迫全卡升級。

T18：缺安全 owner、未讀當前來源、唯讀限制分別使用適用的 memory-card-missing、memory-unverified、memory-blocked-by-scope。工具不替代理猜測選擇。

T22：比較後若相關 source slice/revision 或 card revision/scope 改變，重審受影響 claims；只改無關檔案，不機械清除全部比較證據。這是版本適用範圍的工作流程契約，不是新增工具狀態引擎。

MEMORY.md 是正式主檔，legacy SKILL.md 仍可讀且可做最小同步。兩者共存回報 conflict，不選新檔、不讀 archive 當主卡。正常 content/tracking 修正不自動改名、增加 schema、重建九章節或改 archive。結構標準化需要實際需求與授權；格式完整不等於 source claims 已被外部查證。

## 依賴與監控

工程 import 與 frontmatter dependencies 保持各自來源標示，實際 propagation 使用兩者聯集。人工宣告不被理由 heuristic 靜默刪除，缺理由、未知目標、重複、自我與循環保留診斷。Current Truth / Active Constraints 與 legacy Key Decisions / Known Issues 可提供理由；Relations、Applicable Skills、父子導覽不自動成為傳播邊。

離線 reindex 在同一 canonical transaction 先收斂直接異動、追蹤與 ghost，再做最終依賴傳播。衍生計算先完成再替換，失敗保留先前可信結果並回報 warning。監控者共用持久 fingerprint，受管警告重複寫入或第二個監控者的相同事件不能清 pending/ghost，也不能重複加分。

## memory_commit 的部分成功

相容 status:success 僅代表卡片寫入成功，還需分別檢查：
- cardWritten：卡片已完成此次寫入
- indexSynchronized / indexRegistered：此次交易已成功更新 canonical index 並驗證此卡註冊；false 不證明先前索引沒有該卡
- trackingSynchronized：此次索引已同步且目前追蹤路徑都安全存在
- derivedSynchronized：此次完整依賴結果計算並隨 index 成功發布
- synchronizationComplete：上述同步條件全部成立

INDEX_SYNC_PARTIAL：主卡寫入成功，索引交易失敗或尚未註冊。DERIVED_SYNC_PARTIAL：核心索引可成功，但依賴計算失敗，保留先前可信圖與 indirect 值。TRACKING_SYNC_PARTIAL：仍有缺失或無法安全驗證的追蹤路徑，保留 ghost/pending 與直接 stale。恢復檔案或核准後移除追蹤才可解決相關項目。工具不會自動扩大為全專案 reindex。commit 使用目標卡本次已讀取的 dependencies，其他卡使用已驗證的 canonical declaredDependencies；不從不可信索引猜測自訂根。舊索引尚無獨立宣告快照且缺少可信自訂根設定時，明確回報 derived partial，需由具有該根設定的監控者完成核准掃描。

## 工具清冊與驗收界線

正式 18 工具：memory_list、memory_read、memory_status、memory_commit、memory_reindex、memory_deps、memory_graph、memory_audit、workspace_brief、commit_preflight、context_inventory、context_audit、context_diff、context_plan、project_context_list、project_context_read、project_context_validate、project_context_status。

T05–15、T19–21、T23–24 由相應 source/unit/integration fixtures、双 OS CI 與三入口 build 驗證。T16–18/T22 的文件/contract tests 只驗證正確指引、版本規則與唯讀行為，不證明每位代理的實際 disposition 判斷品質。任何測試通過都不表示已安裝 VSIX、Electron GUI、真實 Gateway 或真實 UNC share 已驗收；每次發布必須以最終 SHA 的 CI 與獨立 review 為準。

## 受控版本庫來源卡校正

版本庫來源卡校正（Repository Source Reconciliation；repository-memory-reconciliation）是 AI_Rules authorization-resolution 的窄範圍路徑；詳細條件由同一固定 revision 的 `Shared/policies/references/repository-memory-reconciliation.md` 擁有。此路徑只校正已納入 Git 版本控制的來源主卡，不是 M5 cutover，也不啟用普通 runtime Memory 寫入。

下列七項只是固定上游規則的對照摘要，完整授權由上游單一 owner 判定；全部須在套用前成立，缺項就保持 frozen：
- explicit_source_scope：明確 repository、基線 commit、既有卡 allowlist、使用者授權與排除範圍
- isolated_source_target：精確根目錄與 immutable Git base 證明是非 runtime 的獨立來源 checkout；不得是 active runtime 的 symlink/alias
- current_claim_evidence：精確 diff、原卡與擬改卡雜湊、現行 source slice/revision、card revision/scope、變更 claims／中英摘要及唯一既有 tracking owner 綁定在同一 manifest
- independent_patch_review：實體套用前的獨立審查接受精確 manifest 與治理 policy content hash，沒有未解阻擋；不得由實作者自行冒充
- recoverable_history：保留所有 archive 原始 bytes 與雜湊、原卡可恢復版本、immutable Git base 及精確 old/new hashes；rollback 只可還原目前仍等於已套用 post-image 的目標，後續編輯會阻擋自動還原
- bounded_source_effects：僅已審核既有來源卡；不增加 owner、不改 topology、Context、runtime projection、provider 或 derived index
- truthful_validation：套用前重核基線與 diff，套用後逐檔 readback、精確變更清單、測試結果與 rollback 路徑；後續改動須重審受影響證據，保留真實工程／宣告依賴及循環診斷

本路徑不授權建卡、拆分、移動、刪除歷史、runtime projection、memory_commit、memory_reindex、index sync 或無效索引修復；不得藉此解除 protected phase、trusted envelope/receipt、使用者端部署或 OS 安全限制。舊來源 bytes 與 archive 保留；Git 提交及測試紀錄不是 M5 或可信工具收據。

校正後保留原有 last_verified、last_updated、cycle 與 stale 歷史值；有改動的卡以 pending_review 明示沒有整卡重新認證。來源 review 及這次版本庫 write/readback 的時間與精確 revision 由 PR/commit 與校正證據保存，不偽造舊 runtime metadata。來源卡已修改、Memory commit 未執行、index/derived sync 未執行必須分開回報；不能宣稱 stale、pending 或 ghost 已清除。日後真實 runtime 操作仍須其本身的有效授權、M5 適用性及能力證據。
