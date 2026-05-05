# ============================================================
# 參數定義
# ============================================================
# $Target       — 必填，要安裝框架的目標專案資料夾路徑
# $Mode         — 部署模式：Fresh（全新覆蓋）或 Upgrade（差異比對升級）
# $RemoveOrphans — 開關：Upgrade 時是否自動刪除目標中已不存在於源碼的孤兒檔案
param (
    [Parameter(Mandatory = $true)]
    [string]$Target,

    [Parameter(Mandatory = $false)]
    [ValidateSet("Fresh", "Upgrade")]
    [string]$Mode = "Fresh",

    [Parameter(Mandatory = $false)]
    [switch]$RemoveOrphans
)

# ── 路徑初始化 ─────────────────────────────────────────────────────────────────
# $PSScriptRoot 是此腳本所在目錄（.agents/scripts/），往上兩層就是框架根目錄
$frameworkRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
# $sourceDir — 框架源碼中的 .agents/ 目錄（包含 rules/workflows/skills 等）
$sourceDir = Join-Path -Path $frameworkRoot -ChildPath ".agents"
# $targetDir — 目標專案中的 .agents/ 目錄（要把框架部署到這裡）
$targetDir = Join-Path -Path $Target -ChildPath ".agents"

# ── 讀取框架版本號（從 Antigravity/VERSION 檔案取得，例如 "1.2.0"）──
$sourceVersion = (Get-Content -Path (Join-Path -Path $frameworkRoot -ChildPath "VERSION") -ErrorAction SilentlyContinue | Select-Object -First 1)
if (-not $sourceVersion) { $sourceVersion = "unknown" }
Write-Host "[>] Antigravity 佈署引擎 v$sourceVersion"
Write-Host "[*] 目標專案: $Target"
Write-Host "[*] 模式: $Mode"

# 如果目標資料夾不存在，先建立它
if (-Not (Test-Path -Path $Target)) {
    Write-Host "[+] 目標目錄不存在，正在建立..."
    New-Item -ItemType Directory -Force -Path $Target | Out-Null
}

# ============================================================
# 共用函式
# ============================================================

function Invoke-ProjectSkillBackfill {
    <#
    .SYNOPSIS
        掃描 project_skills/ 目錄，自動補建缺少的 skills/project-* 符號連結。
        符號連結的作用是讓 AI 在 skills/ 目錄下也能「看到」衍生技能。
        此函式是冪等的（重複執行不會重複建立）。
    #>
    param ([string]$AgentsRoot)  # 目標專案的 .agents/ 絕對路徑
    $skillsDir = Join-Path $AgentsRoot 'skills'          # 核心技能目錄
    $projDir   = Join-Path $AgentsRoot 'project_skills'  # 衍生技能目錄
    # 如果衍生技能目錄不存在，直接結束
    if (-not (Test-Path $projDir)) { return }
    $count = 0
    # 逐一檢查 project_skills/ 底下的每個子目錄
    Get-ChildItem $projDir -Directory | ForEach-Object {
        # 在 skills/ 底下建立一個 "project-技能名" 的符號連結，指向衍生技能
        $linkPath = Join-Path $skillsDir "project-$($_.Name)"
        if (-not (Test-Path $linkPath)) {
            New-Item -ItemType SymbolicLink -Path $linkPath -Target $_.FullName | Out-Null
            Write-Host "[v] [Backfill] project-$($_.Name) 符號連結已建立"
            $count++
        }
    }
    if ($count -eq 0) {
        Write-Host "[OK] 衍生技能符號連結皆為最新，無需補建。"
    }
}

function Compare-AgentFile {
    <# 
    .SYNOPSIS
        比對「來源」與「目標」的同一個檔案是否有差異。
        回傳狀態：NEW（目標不存在）/ SAME（完全相同）/ CHANGED（內容有變）
    .NOTES
        效能最佳化：先比「修改時間」，只有時間不同時才計算 SHA256 雜湊值。
        這樣可以避免對所有檔案都做昂貴的雜湊運算。
    #>
    param (
        [string]$SourcePath,    # 來源檔案的完整路徑
        [string]$TargetPath,    # 目標檔案的完整路徑
        [string]$RelativePath   # 相對路徑（用於報告顯示）
    )

    # 如果目標檔案不存在，代表是全新檔案
    if (-Not (Test-Path -Path $TargetPath)) {
        return [PSCustomObject]@{ Status = "NEW"; Path = $RelativePath }
    }

    # 第一層篩選：比較「最後修改時間」（速度最快）
    $srcTime = (Get-Item $SourcePath).LastWriteTime
    $tgtTime = (Get-Item $TargetPath).LastWriteTime
    if ($srcTime -eq $tgtTime) {
        return [PSCustomObject]@{ Status = "SAME"; Path = $RelativePath }
    }

    # 第二層篩選：時間不同時，計算 SHA256 雜湊值做精確比對
    $srcHash = (Get-FileHash -Path $SourcePath -Algorithm SHA256).Hash
    $tgtHash = (Get-FileHash -Path $TargetPath -Algorithm SHA256).Hash
    if ($srcHash -eq $tgtHash) {
        # 雖然修改時間不同，但內容完全相同（可能只是被觸碰過）
        return [PSCustomObject]@{ Status = "SAME"; Path = $RelativePath }
    }

    # 時間不同、內容也不同 → 確認是有變更的檔案
    return [PSCustomObject]@{ Status = "CHANGED"; Path = $RelativePath }
}

function Get-UpgradeReport {
    <# 
    .SYNOPSIS
        掃描所有框架檔案，逐一比對來源與目標的差異，產出完整差異報告。
        報告包含五種狀態：NEW / CHANGED / SAME / ORPHAN / KEEP
    #>
    param (
        [string]$SourceRoot,  # 來源的 .agents/ 目錄
        [string]$TargetRoot   # 目標的 .agents/ 目錄
    )

    $results = @()  # 收集所有比對結果的陣列

    # ── 正向掃描：來源 → 目標 ──────────────────────────────────────────────
    # 掃描 rules/、workflows/、scripts/ 三個子目錄中的所有檔案
    foreach ($dir in @("rules", "workflows", "scripts")) {
        $srcPath = Join-Path -Path $SourceRoot -ChildPath $dir
        if (-Not (Test-Path -Path $srcPath)) { continue }

        # 取得每個檔案的相對路徑，呼叫 Compare-AgentFile 逐一比對
        Get-ChildItem -Path $srcPath -File -Recurse | ForEach-Object {
            # 從絕對路徑截取相對路徑（例如 rules/core-identity.md）
            $rel = $_.FullName.Substring($SourceRoot.Length).TrimStart('\', '/').Replace("\", "/")
            $tgtFile = Join-Path -Path $TargetRoot -ChildPath $rel
            $results += Compare-AgentFile -SourcePath $_.FullName -TargetPath $tgtFile -RelativePath $rel
        }
    }

    # 掃描 skills/（技能目錄）
    # 注意：必須排除 _memory 和 _project 開頭的符號連結，它們不是框架檔案
    $srcSkills = Join-Path -Path $SourceRoot -ChildPath "skills"
    if (Test-Path -Path $srcSkills) {
        Get-ChildItem -Path $srcSkills -File -Recurse | Where-Object {
            # Where-Object 過濾器：排除 _memory/ 和 _project/ 開頭的路徑
            $relPath = $_.FullName.Substring($srcSkills.Length).TrimStart('\', '/')
            -not ($relPath -match "^_memory[\\\/]") -and -not ($relPath -match "^_project[\\\/]")
        } | ForEach-Object {
            $rel = $_.FullName.Substring($SourceRoot.Length).TrimStart('\', '/').Replace("\", "/")
            $tgtFile = Join-Path -Path $TargetRoot -ChildPath $rel
            $results += Compare-AgentFile -SourcePath $_.FullName -TargetPath $tgtFile -RelativePath $rel
        }
    }

    # ── 反向掃描：目標 → 來源（孤兒偵測）────────────────────────────────
    # 「孤兒」= 目標專案裡有，但框架源碼已刪除的檔案（殘留的舊版檔案）
    # 掃描 rules/、workflows/、scripts/ 的孤兒
    foreach ($dir in @("rules", "workflows", "scripts")) {
        $tgtPath = Join-Path -Path $TargetRoot -ChildPath $dir
        if (-Not (Test-Path -Path $tgtPath)) { continue }

        Get-ChildItem -Path $tgtPath -File -Recurse | ForEach-Object {
            $rel = $_.FullName.Substring($TargetRoot.Length).TrimStart('\', '/').Replace("\", "/")
            $srcFile = Join-Path -Path $SourceRoot -ChildPath $rel
            # 如果來源找不到對應檔案，就是孤兒
            if (-Not (Test-Path -Path $srcFile)) {
                $results += [PSCustomObject]@{ Status = "ORPHAN"; Path = $rel }
            }
        }
    }

    # 掃描 skills/ 的孤兒（排除受保護的符號連結）
    # _memory、_project 開頭的是系統符號連結，project-* 開頭的是衍生技能命名空間連結
    $tgtSkills = Join-Path -Path $TargetRoot -ChildPath "skills"
    if (Test-Path -Path $tgtSkills) {
        Get-ChildItem -Path $tgtSkills -File -Recurse | Where-Object {
            $relPath = $_.FullName.Substring($tgtSkills.Length).TrimStart('\', '/')
            -not ($relPath -match "^_memory[\\\/]") -and -not ($relPath -match "^mem-") `
            -and -not ($relPath -match "^_project[\\\/]") -and -not ($relPath -match "^project-")
        } | ForEach-Object {
            $rel = $_.FullName.Substring($TargetRoot.Length).TrimStart('\', '/').Replace("\", "/")
            $srcFile = Join-Path -Path $SourceRoot -ChildPath $rel
            if (-Not (Test-Path -Path $srcFile)) {
                $results += [PSCustomObject]@{ Status = "ORPHAN"; Path = $rel }
            }
        }
    }

    # ── 受保護目錄掃描（顯示為 KEEP，不會被修改或刪除）──────────────
    # 掃描 memory/ 目錄：專案記憶卡，升級時不會觸碰
    $tgtMemory = Join-Path -Path $TargetRoot -ChildPath "memory"
    if (Test-Path -Path $tgtMemory) {
        # 找出所有包含 SKILL.md 的子目錄（代表是有效的記憶卡）
        Get-ChildItem -Path $tgtMemory -Directory -Recurse | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") } | ForEach-Object {
            $rel = $_.FullName.Substring($tgtMemory.Length).TrimStart('\', '/').Replace("\", "/")
            $results += [PSCustomObject]@{ Status = "KEEP"; Path = "memory/$rel/" }
        }
    }

    # 掃描 project_skills/ 目錄：衍生技能，升級時不會觸碰
    $tgtProject = Join-Path -Path $TargetRoot -ChildPath "project_skills"
    if (Test-Path -Path $tgtProject) {
        Get-ChildItem -Path $tgtProject -Directory -Recurse | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") } | ForEach-Object {
            $rel = $_.FullName.Substring($tgtProject.Length).TrimStart('\', '/').Replace("\", "/")
            $results += [PSCustomObject]@{ Status = "KEEP"; Path = "project_skills/$rel/" }
        }
    }

    return $results
}

function Write-UpgradeReport {
    <# 
    .SYNOPSIS
        將 Get-UpgradeReport 的報告結果格式化輸出到終端機。
        依類別分組顯示（規則/工作流/腳本/技能/記憶/衍生），並統計各狀態數量。
    #>
    param (
        [array]$Report  # Get-UpgradeReport 回傳的報告陣列
    )

    $timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss+08:00")

    Write-Host ""
    Write-Host "======================================================="
    Write-Host "  升級差異報告 — $timestamp"
    Write-Host "======================================================="

    # 將報告依「路徑前綴」分成六大類
    $categories = @{
        "RULES"     = $Report | Where-Object { $_.Path -like "rules/*" }          # 治理規則
        "WORKFLOWS" = $Report | Where-Object { $_.Path -like "workflows/*" }      # 工作流程
        "SCRIPTS"   = $Report | Where-Object { $_.Path -like "scripts/*" }        # 工具腳本
        "SKILLS"    = $Report | Where-Object { $_.Path -like "skills/*" -and $_.Status -ne "KEEP" }  # 技能（排除受保護的）
        "MEMORY"    = $Report | Where-Object { $_.Path -like "memory/*" -and $_.Status -eq "KEEP" }  # 受保護的記憶卡
        "PROJECT"   = $Report | Where-Object { $_.Path -like "project_skills/*" -and $_.Status -eq "KEEP" }  # 受保護的衍生技能
    }

    # 每個類別的中文顯示名稱
    $displayNames = @{
        "RULES"     = "規則 (Rules)"
        "WORKFLOWS" = "工作流程 (Workflows)"
        "SCRIPTS"   = "工具腳本 (Scripts)"
        "SKILLS"    = "技能 (Skills)"
        "MEMORY"    = "專案記憶 — 受保護 (Memory Skills)"
        "PROJECT"   = "專案衍生技能 — 受保護 (Project Skills)"
    }

    # 各狀態對應的顯示顏色
    $statusColors = @{
        "NEW"     = "Green"     # 綠色：新增
        "CHANGED" = "Yellow"    # 黃色：變更
        "SAME"    = "DarkGray"  # 灰色：相同
        "KEEP"    = "Cyan"      # 青色：受保護
        "ORPHAN"  = "Magenta"   # 紫色：孤兒
    }

    # 依序輸出每個類別
    foreach ($cat in @("RULES", "WORKFLOWS", "SCRIPTS", "SKILLS", "MEMORY", "PROJECT")) {
        $items = $categories[$cat]
        if ($null -eq $items -or @($items).Count -eq 0) { continue }  # 空的類別跳過

        Write-Host ""
        Write-Host "  $($displayNames[$cat])"
        Write-Host "  -------------------------------------------------------"

        # 依狀態排序：新增 → 變更 → 孤兒 → 相同 → 受保護
        $sorted = @($items) | Sort-Object {
            switch ($_.Status) { "NEW" { 0 } "CHANGED" { 1 } "ORPHAN" { 2 } "SAME" { 3 } "KEEP" { 4 } }
        }

        foreach ($item in $sorted) {
            $color = $statusColors[$item.Status]
            $tag = "[$($item.Status)]".PadRight(10)  # 狀態標籤右側補空白對齊
            Write-Host "  $tag $($item.Path)" -ForegroundColor $color
        }
    }

    # 統計各狀態的數量
    $newCount    = @($Report | Where-Object { $_.Status -eq "NEW" }).Count
    $changedCount= @($Report | Where-Object { $_.Status -eq "CHANGED" }).Count
    $sameCount   = @($Report | Where-Object { $_.Status -eq "SAME" }).Count
    $keepCount   = @($Report | Where-Object { $_.Status -eq "KEEP" }).Count
    $orphanCount = @($Report | Where-Object { $_.Status -eq "ORPHAN" }).Count

    Write-Host ""
    Write-Host "======================================================="
    Write-Host "  新增: $newCount | 變更: $changedCount | 相同: $sameCount | 受保護: $keepCount | 孤兒: $orphanCount"
    Write-Host "======================================================="

    return @{ New = $newCount; Changed = $changedCount; Same = $sameCount; Keep = $keepCount; Orphan = $orphanCount }
}

function Install-Upgrade {
    <# 
    .SYNOPSIS
        執行實際的檔案更新。只複製狀態為 NEW 或 CHANGED 的檔案，
        跳過所有 SAME / KEEP / ORPHAN 的檔案。
    #>
    param (
        [array]$Report,      # Get-UpgradeReport 回傳的報告陣列
        [string]$SourceRoot,  # 來源的 .agents/ 目錄
        [string]$TargetRoot   # 目標的 .agents/ 目錄
    )

    $applied = 0  # 計算實際更新了幾個檔案

    foreach ($item in $Report) {
        # 只處理新增和變更的檔案，其他狀態跳過
        if ($item.Status -notin @("NEW", "CHANGED")) { continue }

        $srcFile = Join-Path -Path $SourceRoot -ChildPath $item.Path
        $tgtFile = Join-Path -Path $TargetRoot -ChildPath $item.Path

        # 如果目標資料夾不存在，先建立它
        $tgtDir = Split-Path -Path $tgtFile -Parent
        if (-Not (Test-Path -Path $tgtDir)) {
            New-Item -ItemType Directory -Force -Path $tgtDir | Out-Null
        }

        # 複製檔案（覆寫目標）
        Copy-Item -Path $srcFile -Destination $tgtFile -Force
        $verb = if ($item.Status -eq "NEW") { "已建立" } else { "已更新" }
        Write-Host "[v] ${verb}: $($item.Path)"
        $applied++
    }

    return $applied  # 回傳更新數量
}

function Get-ReleaseNotes {
    <# 
    .SYNOPSIS
        擷取 RELEASE_NOTES.md 中兩個版本之間的更新說明。
        從最新版開始讀，讀到目標專案的當前版本就停止。
    #>
    param (
        [string]$NotesPath,    # RELEASE_NOTES.md 的完整路徑
        [string]$FromVersion,  # 目標專案的當前版本（讀到這裡停止）
        [string]$ToVersion     # 框架源碼的最新版本
    )

    # 如果檔案不存在，回傳空陣列
    if (-Not (Test-Path -Path $NotesPath)) { return @() }

    $lines = Get-Content -Path $NotesPath
    $capturing = $false  # 是否正在擷取內容
    $notes = @()         # 收集擷取的行

    foreach ($line in $lines) {
        # 匹配 "## v1.2.0" 這類版本標題
        if ($line -match "^## v([\d\.]+)") {
            $ver = $Matches[1]
            # 如果讀到目標專案的當前版本，代表已讀完所有新版說明
            if ($ver -eq $FromVersion) { break }
            $capturing = $true
        }
        if ($capturing) { $notes += $line }
    }

    return $notes
}

# ============================================================
# Upgrade 模式：先掃描差異 → 顯示報告 → 等待確認 → 執行更新
# ============================================================

if ($Mode -eq "Upgrade") {
    # 如果目標還沒有 .agents/ 資料夾，代表尚未安裝，無法升級
    if (-Not (Test-Path -Path $targetDir)) {
        Write-Host "[!] 目標專案尚未建立 .agents 資料夾，請改用 Fresh 模式。"
        Write-Host "    Deploy-Antigravity.ps1 -Target `"$Target`" -Mode Fresh"
        return
    }

    # 讀取目標專案的當前版本號
    $targetVersionFile = Join-Path -Path $targetDir -ChildPath "VERSION"
    $targetVersion = if (Test-Path -Path $targetVersionFile) {
        (Get-Content -Path $targetVersionFile | Select-Object -First 1)
    } else { "未知" }

    Write-Host "[*] 版本：v$targetVersion → v$sourceVersion"
    Write-Host "[*] 正在掃描差異..."
    # 呼叫 Get-UpgradeReport 掃描所有檔案差異，再用 Write-UpgradeReport 顯示報告
    $report = Get-UpgradeReport -SourceRoot $sourceDir -TargetRoot $targetDir
    $stats = Write-UpgradeReport -Report $report

    # 顯示版本更新說明（從 RELEASE_NOTES.md 擷取）
    $notesPath = Join-Path -Path $frameworkRoot -ChildPath "RELEASE_NOTES.md"
    $releaseNotes = Get-ReleaseNotes -NotesPath $notesPath -FromVersion $targetVersion -ToVersion $sourceVersion
    if ($releaseNotes.Count -gt 0) {
        Write-Host ""
        Write-Host "  📋 更新說明（v$targetVersion → v$sourceVersion）"
        Write-Host "  -------------------------------------------------------"
        foreach ($noteLine in $releaseNotes) {
            Write-Host "  $noteLine"
        }
    }

    # ---- 階段 A: 框架檔案更新 ----
    # 如果有新增或變更的檔案，問使用者是否要套用
    $applied = 0
    if ($stats.New -gt 0 -or $stats.Changed -gt 0) {
        Write-Host ""
        $confirm = Read-Host "是否套用框架檔案變更？(Y/N)"
        if ($confirm -eq "Y" -or $confirm -eq "y") {
            $applied = Install-Upgrade -Report $report -SourceRoot $sourceDir -TargetRoot $targetDir
        } else {
            Write-Host "[!] 已跳過框架檔案更新。"
        }
    } else {
        Write-Host ""
        Write-Host "[OK] 框架檔案皆為最新，無需變更。"
    }

    # ---- 階段 B: 基礎設施確保（不受確認閘門影響，每次升級都會執行）----
    # 確保 memory/ 和 project_skills/ 目錄存在
    $tgtMemory = Join-Path -Path $targetDir -ChildPath "memory"
    if (-Not (Test-Path -Path $tgtMemory)) {
        New-Item -ItemType Directory -Force -Path $tgtMemory | Out-Null
        Write-Host "[v] 已建立 memory/ 目錄。"
    }

    $tgtProject = Join-Path -Path $targetDir -ChildPath "project_skills"
    if (-Not (Test-Path -Path $tgtProject)) {
        New-Item -ItemType Directory -Force -Path $tgtProject | Out-Null
        Write-Host "[v] 已建立 project_skills/ 目錄。"
    }

    # ---- 階段 C: 衍生技能命名空間連結 Backfill ----
    Write-Host "[*] 掃描並補建衍生技能命名空間連結..."
    Invoke-ProjectSkillBackfill -AgentsRoot $targetDir

    # ---- 階段 D: 版本更新與結果報告 ----
    # 將目標專案的版本號更新為最新版
    Set-Content -Path $targetVersionFile -Value $sourceVersion -NoNewline

    Write-Host "-----------------------------------------------"
    Write-Host "[OK] 升級完成！v$targetVersion → v$sourceVersion（更新 $applied 個檔案）"

    # 孤兒檔案處理：如果有孤兒且使用者有加 -RemoveOrphans 參數，就實際刪除
    if ($stats.Orphan -gt 0) {
        if ($RemoveOrphans) {
            Write-Host "[*] 正在清除 $($stats.Orphan) 個孤兒檔案..."
            # 逐一刪除孤兒檔案
            $report | Where-Object { $_.Status -eq "ORPHAN" } | ForEach-Object {
                $orphanFile = Join-Path -Path $targetDir -ChildPath $_.Path
                if (Test-Path -Path $orphanFile) {
                    Remove-Item -Path $orphanFile -Force
                    Write-Host "    [x] 已刪除: $($_.Path)" -ForegroundColor Green
                }
            }
            # 清理刪除後留下的空資料夾（從最深層往上清）
            foreach ($dir in @("rules", "workflows", "scripts", "skills")) {
                $dirPath = Join-Path -Path $targetDir -ChildPath $dir
                if (Test-Path -Path $dirPath) {
                    Get-ChildItem -Path $dirPath -Directory -Recurse | Sort-Object { $_.FullName.Length } -Descending | ForEach-Object {
                        if (@(Get-ChildItem -Path $_.FullName -Force).Count -eq 0) {
                            Remove-Item -Path $_.FullName -Force
                        }
                    }
                }
            }
            Write-Host "[OK] 孤兒檔案清除完成。"
        } else {
            # 沒有加 -RemoveOrphans，只顯示警告
            Write-Host "[!] 注意: $($stats.Orphan) 個孤兒檔案（源碼已刪除但目標仍存在）："
            $report | Where-Object { $_.Status -eq "ORPHAN" } | ForEach-Object {
                Write-Host "    → $($_.Path)" -ForegroundColor Magenta
            }
            Write-Host "    提示: 加入 -RemoveOrphans 參數可自動清除這些檔案。" -ForegroundColor DarkYellow
        }
    }
    Write-Host "-----------------------------------------------"
    return
}

# ============================================================
# Fresh 模式：完整部署（含 D06 記憶卡保護安全網）
# 流程：備份記憶卡 → 複製框架 → 無論成敗都還原記憶卡
# ============================================================

if (Test-Path -Path $targetDir) {
    Write-Host "[!] 目標專案已有 .agents 資料夾，將覆蓋寫入..."
} else {
    Write-Host "[v] 正在解壓 Antigravity 核心元件..."
}

# D06 安全網：在系統暫存目錄建立備份，防止覆蓋過程中記憶卡遺失
$tmpMemory       = Join-Path $env:TEMP "ag_backup_memory_$(Get-Random)"
$tmpProject      = Join-Path $env:TEMP "ag_backup_project_$(Get-Random)"
$existingMemory  = Join-Path $targetDir "memory"          # 現有的記憶卡目錄
$existingProject = Join-Path $targetDir "project_skills"  # 現有的衍生技能目錄

try {
    # 備份現有的記憶卡到暫存目錄
    if (Test-Path $existingMemory) {
        Copy-Item $existingMemory $tmpMemory -Recurse -Force
        Write-Host "[*] 已備份記憶卡到暫存目錄..."
    }
    # 備份現有的衍生技能到暫存目錄
    if (Test-Path $existingProject) {
        Copy-Item $existingProject $tmpProject -Recurse -Force
        Write-Host "[*] 已備份衍生技能到暫存目錄..."
    }

    # 建立目標 .agents/ 目錄
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    # 逐一複製源碼中的子目錄（排除 memory 和 project_skills，它們由備份還原）
    Get-ChildItem -Path $sourceDir | Where-Object { $_.Name -notin @("memory", "project_skills") } | ForEach-Object {
        $srcItem = $_
        $destPath = Join-Path -Path $targetDir -ChildPath $srcItem.Name

        # skills/ 目錄需要特殊處理：排除 _memory 和 _project 符號連結
        # PSIsContainer 代表「是資料夾」（PowerShell 專用屬性）
        if ($srcItem.Name -eq "skills" -and $srcItem.PSIsContainer) {
            New-Item -ItemType Directory -Force -Path $destPath | Out-Null
            # 只複製不是 _memory 或 _project 的子目錄
            Get-ChildItem -Path $srcItem.FullName | Where-Object { $_.Name -notin @("_memory", "_project") } | ForEach-Object {
                Copy-Item -Path $_.FullName -Destination $destPath -Recurse -Force
            }
        } else {
            # 其他目錄（rules/workflows/scripts 等）直接整個複製
            Copy-Item -Path $srcItem.FullName -Destination $targetDir -Recurse -Force
        }
    }
} finally {
    # D06 安全網：無論上面的複製過程是否成功，都會執行這裡的還原
    if (Test-Path $tmpMemory) {
        Copy-Item $tmpMemory $existingMemory -Recurse -Force
        Remove-Item $tmpMemory -Recurse -Force
        Write-Host "[v] 專案記憶卡已完整保留並還原。"
    }
    if (Test-Path $tmpProject) {
        Copy-Item $tmpProject $existingProject -Recurse -Force
        Remove-Item $tmpProject -Recurse -Force
        Write-Host "[v] 專案衍生技能已完整保留並還原。"
    }
}

Write-Host "[v] 核心傳輸完成，正在初始化架構..."

# 確保 memory/ 目錄存在（專案記憶卡存放處）
$memoryDir = Join-Path -Path $targetDir -ChildPath "memory"
if (-Not (Test-Path -Path $memoryDir)) {
    New-Item -ItemType Directory -Force -Path $memoryDir | Out-Null
}

$skillsDir = Join-Path -Path $targetDir -ChildPath "skills"

# 確保 project_skills/ 目錄存在（衍生技能存放處）
$projectSkillDir = Join-Path -Path $targetDir -ChildPath "project_skills"
if (-Not (Test-Path -Path $projectSkillDir)) {
    New-Item -ItemType Directory -Force -Path $projectSkillDir | Out-Null
}
# 如果衍生技能路由表不存在，建立一個空的模板
$projectIndexFile = Join-Path -Path $projectSkillDir -ChildPath "_index.md"
if (-Not (Test-Path -Path $projectIndexFile)) {
    $indexTemplate = @"
# Project Skill Registry (專案衍生技能路由表)

| Keywords (EN) | 關鍵字 (ZH) | Skill | MCP Server |
|--------------|------------|-------|------------|
"@
    Set-Content -Path $projectIndexFile -Value $indexTemplate -Encoding UTF8
}
Write-Host "[v] 專案記憶系統已就緒，可執行 /02_blueprint 初始化。"

# 掃描並補建衍生技能的命名空間符號連結
Write-Host "[*] 掃描並補建衍生技能命名空間連結..."
Invoke-ProjectSkillBackfill -AgentsRoot $targetDir

# ── 部署統計摘要 ─────────────────────────────────────────────────────────
# 統計核心技能、衍生技能、記憶卡的數量並顯示
if (Test-Path -Path $skillsDir) {
    # 核心技能：排除 _memory、_project 和 project-* 符號連結，只算有 SKILL.md 的目錄
    $totalSkills  = (Get-ChildItem -Path $skillsDir -Directory | Where-Object {
        ($_.Name -ne "_memory") -and ($_.Name -ne "_project") -and ($_.Name -notlike "project-*") `
        -and (Test-Path (Join-Path $_.FullName "SKILL.md"))
    }).Count
    # 已掛載的衍生技能符號連結
    $linkedSkills = (Get-ChildItem -Path $skillsDir -Directory | Where-Object { $_.Name -like "project-*" }).Count
    # 記憶卡數量
    $memCards     = if (Test-Path -Path $memoryDir) {
        (Get-ChildItem -Path $memoryDir -Directory -Recurse | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") }).Count
    } else { 0 }
    # 衍生技能數量
    $projectSkills = if (Test-Path -Path $projectSkillDir) {
        (Get-ChildItem -Path $projectSkillDir -Directory -Recurse | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") }).Count
    } else { 0 }
    Write-Host "[v] 技能系統已部署: $totalSkills 個核心技能 + $projectSkills 個衍生技能（$linkedSkills 個已掛載）+ $memCards 個專案記憶。"
} else {
    Write-Host "[!] 警告: 部署的 .agents 資料夾中找不到技能目錄。"
}

# 寫入版本號
$versionFile = Join-Path -Path $targetDir -ChildPath "VERSION"
Set-Content -Path $versionFile -Value $sourceVersion -NoNewline
Write-Host "[v] 版本 v$sourceVersion 已寫入。"

# ── .gitignore 設定 ───────────────────────────────────────────────────────────
# 確保 .agents/scripts/ 和 .agents/logs/ 不會被納入版控
$gitignorePath = Join-Path -Path $Target -ChildPath ".gitignore"
$excludeLines  = @(".agents/scripts/", ".agents/logs/")

if (-Not (Test-Path -Path $gitignorePath)) {
    Set-Content -Path $gitignorePath -Value "# Antigravity 框架自動排除項目"
    Write-Host "[v] 已建立 .gitignore"
}

# 檢查每個排除規則是否已存在，不存在才追加
$giContent = Get-Content -Path $gitignorePath -Raw
foreach ($line in $excludeLines) {
    if ($giContent -notmatch [regex]::Escape($line)) {
        Add-Content -Path $gitignorePath -Value $line
        Write-Host "[v] 已追加 .gitignore 排除: $line"
    }
}

Write-Host "-----------------------------------------------"
Write-Host "[OK] 佈署完成！Antigravity v$sourceVersion 防護罩已啟動。"
Write-Host "-----------------------------------------------"
