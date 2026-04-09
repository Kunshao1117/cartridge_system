param (
    [Parameter(Mandatory = $true)]
    [string]$Target,

    [Parameter(Mandatory = $false)]
    [ValidateSet("Fresh", "Upgrade")]
    [string]$Mode = "Fresh"
)

# 腳本從 .agents/scripts/ 執行，往上兩層取得框架根目錄 (Antigravity/)
$frameworkRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$sourceDir = Join-Path -Path $frameworkRoot -ChildPath ".agents"
$targetDir = Join-Path -Path $Target -ChildPath ".agents"

$sourceVersion = (Get-Content -Path (Join-Path -Path $frameworkRoot -ChildPath "VERSION") -ErrorAction SilentlyContinue | Select-Object -First 1)
if (-not $sourceVersion) { $sourceVersion = "unknown" }
Write-Host "[>] Antigravity 佈署引擎 v$sourceVersion"
Write-Host "[*] 目標專案: $Target"
Write-Host "[*] 模式: $Mode"

if (-Not (Test-Path -Path $Target)) {
    Write-Host "[+] 目標目錄不存在，正在建立..."
    New-Item -ItemType Directory -Force -Path $Target | Out-Null
}

# ============================================================
# 共用函式
# ============================================================

function Compare-AgentFile {
    <# 
    .SYNOPSIS 比對單一檔案：先看修改時間，再比 SHA256
    .OUTPUTS PSCustomObject with Status (NEW/SAME/CHANGED) and RelativePath
    #>
    param (
        [string]$SourcePath,
        [string]$TargetPath,
        [string]$RelativePath
    )

    if (-Not (Test-Path -Path $TargetPath)) {
        return [PSCustomObject]@{ Status = "NEW"; Path = $RelativePath }
    }

    # 先比修改時間（快速路徑）
    $srcTime = (Get-Item $SourcePath).LastWriteTime
    $tgtTime = (Get-Item $TargetPath).LastWriteTime
    if ($srcTime -eq $tgtTime) {
        return [PSCustomObject]@{ Status = "SAME"; Path = $RelativePath }
    }

    # 修改時間不同 → 比對 SHA256 內容
    $srcHash = (Get-FileHash -Path $SourcePath -Algorithm SHA256).Hash
    $tgtHash = (Get-FileHash -Path $TargetPath -Algorithm SHA256).Hash
    if ($srcHash -eq $tgtHash) {
        return [PSCustomObject]@{ Status = "SAME"; Path = $RelativePath }
    }

    return [PSCustomObject]@{ Status = "CHANGED"; Path = $RelativePath }
}

function Get-UpgradeReport {
    <# 
    .SYNOPSIS 掃描所有框架檔案，產出差異報告
    #>
    param (
        [string]$SourceRoot,
        [string]$TargetRoot
    )

    $results = @()

    # 掃描 rules/ 和 workflows/
    foreach ($dir in @("rules", "workflows", "scripts")) {
        $srcPath = Join-Path -Path $SourceRoot -ChildPath $dir
        if (-Not (Test-Path -Path $srcPath)) { continue }

        Get-ChildItem -Path $srcPath -File -Recurse | ForEach-Object {
            $rel = $_.FullName.Substring($SourceRoot.Length + 1).Replace("\", "/")
            $tgtFile = Join-Path -Path $TargetRoot -ChildPath $rel
            $results += Compare-AgentFile -SourcePath $_.FullName -TargetPath $tgtFile -RelativePath $rel
        }
    }

    # 掃描 skills/（排除 _memory 和 _project 符號連結）
    $srcSkills = Join-Path -Path $SourceRoot -ChildPath "skills"
    if (Test-Path -Path $srcSkills) {
        Get-ChildItem -Path $srcSkills -File -Recurse | Where-Object {
            # 排除受保護的符號連結目錄下的所有檔案
            $relPath = $_.FullName.Substring($srcSkills.Length + 1)
            -not ($relPath -match "^_memory[\\/]") -and -not ($relPath -match "^_project[\\/]")
        } | ForEach-Object {
            $rel = $_.FullName.Substring($SourceRoot.Length + 1).Replace("\", "/")
            $tgtFile = Join-Path -Path $TargetRoot -ChildPath $rel
            $results += Compare-AgentFile -SourcePath $_.FullName -TargetPath $tgtFile -RelativePath $rel
        }
    }

    # 檢查目標專案中的孤兒檔案（源頭已刪除）
    foreach ($dir in @("rules", "workflows", "scripts")) {
        $tgtPath = Join-Path -Path $TargetRoot -ChildPath $dir
        if (-Not (Test-Path -Path $tgtPath)) { continue }

        Get-ChildItem -Path $tgtPath -File -Recurse | ForEach-Object {
            $rel = $_.FullName.Substring($TargetRoot.Length + 1).Replace("\", "/")
            $srcFile = Join-Path -Path $SourceRoot -ChildPath $rel
            if (-Not (Test-Path -Path $srcFile)) {
                $results += [PSCustomObject]@{ Status = "ORPHAN"; Path = $rel }
            }
        }
    }

    # 檢查 skills/ 中的孤兒（排除 _memory、_project 符號連結）
    $tgtSkills = Join-Path -Path $TargetRoot -ChildPath "skills"
    if (Test-Path -Path $tgtSkills) {
        Get-ChildItem -Path $tgtSkills -File -Recurse | Where-Object {
            $relPath = $_.FullName.Substring($tgtSkills.Length + 1)
            -not ($relPath -match "^_memory[\\/]") -and -not ($relPath -match "^mem-") -and -not ($relPath -match "^_project[\\/]")
        } | ForEach-Object {
            $rel = $_.FullName.Substring($TargetRoot.Length + 1).Replace("\", "/")
            $srcFile = Join-Path -Path $SourceRoot -ChildPath $rel
            if (-Not (Test-Path -Path $srcFile)) {
                $results += [PSCustomObject]@{ Status = "ORPHAN"; Path = $rel }
            }
        }
    }

    # 掃描 memory/ 目錄存在性
    $tgtMemory = Join-Path -Path $TargetRoot -ChildPath "memory"
    if (Test-Path -Path $tgtMemory) {
        Get-ChildItem -Path $tgtMemory -Directory -Recurse | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") } | ForEach-Object {
            $rel = $_.FullName.Substring($tgtMemory.Length + 1).Replace("\", "/")
            $results += [PSCustomObject]@{ Status = "KEEP"; Path = "memory/$rel/" }
        }
    }

    # 掃描 project_skills/ 目錄（專案衍生技能 — 受保護）
    $tgtProject = Join-Path -Path $TargetRoot -ChildPath "project_skills"
    if (Test-Path -Path $tgtProject) {
        Get-ChildItem -Path $tgtProject -Directory -Recurse | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") } | ForEach-Object {
            $rel = $_.FullName.Substring($tgtProject.Length + 1).Replace("\", "/")
            $results += [PSCustomObject]@{ Status = "KEEP"; Path = "project_skills/$rel/" }
        }
    }

    # 過渡相容：掃描舊版 skills/mem-*（含巢狀，等待遷移）
    if (Test-Path -Path $tgtSkills) {
        Get-ChildItem -Path $tgtSkills -Directory -Recurse | Where-Object { $_.Name -like "mem-*" } | ForEach-Object {
            $rel = $_.FullName.Substring($tgtSkills.Length + 1).Replace("\", "/")
            $results += [PSCustomObject]@{ Status = "MIGRATE"; Path = "skills/$rel/" }
        }
    }

    return $results
}

function Write-UpgradeReport {
    <# 
    .SYNOPSIS 格式化輸出差異報告
    #>
    param (
        [array]$Report
    )

    $timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss+08:00")

    Write-Host ""
    Write-Host "======================================================="
    Write-Host "  升級差異報告 — $timestamp"
    Write-Host "======================================================="

    # 按類別分組
    $categories = @{
        "RULES"     = $Report | Where-Object { $_.Path -like "rules/*" }
        "WORKFLOWS" = $Report | Where-Object { $_.Path -like "workflows/*" }
        "SCRIPTS"   = $Report | Where-Object { $_.Path -like "scripts/*" }
        "SKILLS"    = $Report | Where-Object { $_.Path -like "skills/*" -and $_.Status -ne "KEEP" }
        "MEMORY"    = $Report | Where-Object { $_.Path -like "memory/*" -and $_.Status -eq "KEEP" }
        "PROJECT"   = $Report | Where-Object { $_.Path -like "project_skills/*" -and $_.Status -eq "KEEP" }
    }

    $displayNames = @{
        "RULES"     = "規則 (Rules)"
        "WORKFLOWS" = "工作流程 (Workflows)"
        "SCRIPTS"   = "工具腳本 (Scripts)"
        "SKILLS"    = "技能 (Skills)"
        "MEMORY"    = "專案記憶 — 受保護 (Memory Skills)"
        "PROJECT"   = "專案衍生技能 — 受保護 (Project Skills)"
    }

    # 狀態顏色對照
    $statusColors = @{
        "NEW"     = "Green"
        "CHANGED" = "Yellow"
        "SAME"    = "DarkGray"
        "KEEP"    = "Cyan"
        "MIGRATE" = "Blue"
        "ORPHAN"  = "Magenta"
    }

    foreach ($cat in @("RULES", "WORKFLOWS", "SCRIPTS", "SKILLS", "MEMORY", "PROJECT")) {
        $items = $categories[$cat]
        if ($null -eq $items -or @($items).Count -eq 0) { continue }

        Write-Host ""
        Write-Host "  $($displayNames[$cat])"
        Write-Host "  -------------------------------------------------------"

        # 排序：NEW → CHANGED → ORPHAN → SAME → KEEP
        $sorted = @($items) | Sort-Object { 
            switch ($_.Status) { "NEW" { 0 } "CHANGED" { 1 } "ORPHAN" { 2 } "MIGRATE" { 3 } "SAME" { 4 } "KEEP" { 5 } }
        }

        foreach ($item in $sorted) {
            $color = $statusColors[$item.Status]
            $tag = "[$($item.Status)]".PadRight(10)
            Write-Host "  $tag $($item.Path)" -ForegroundColor $color
        }
    }

    # 統計
    $newCount     = @($Report | Where-Object { $_.Status -eq "NEW" }).Count
    $changedCount = @($Report | Where-Object { $_.Status -eq "CHANGED" }).Count
    $sameCount    = @($Report | Where-Object { $_.Status -eq "SAME" }).Count
    $keepCount    = @($Report | Where-Object { $_.Status -eq "KEEP" }).Count
    $migrateCount = @($Report | Where-Object { $_.Status -eq "MIGRATE" }).Count
    $orphanCount  = @($Report | Where-Object { $_.Status -eq "ORPHAN" }).Count

    Write-Host ""
    Write-Host "======================================================="
    Write-Host "  新增: $newCount | 變更: $changedCount | 相同: $sameCount | 受保護: $keepCount | 待遷移: $migrateCount | 孤兒: $orphanCount"
    Write-Host "======================================================="

    return @{ New = $newCount; Changed = $changedCount; Same = $sameCount; Keep = $keepCount; Migrate = $migrateCount; Orphan = $orphanCount }
}

function Install-Upgrade {
    <# 
    .SYNOPSIS 執行更新：只處理 NEW 和 CHANGED 的檔案
    #>
    param (
        [array]$Report,
        [string]$SourceRoot,
        [string]$TargetRoot
    )

    $applied = 0

    foreach ($item in $Report) {
        if ($item.Status -notin @("NEW", "CHANGED")) { continue }

        $srcFile = Join-Path -Path $SourceRoot -ChildPath $item.Path
        $tgtFile = Join-Path -Path $TargetRoot -ChildPath $item.Path

        # 確保目標目錄存在
        $tgtDir = Split-Path -Path $tgtFile -Parent
        if (-Not (Test-Path -Path $tgtDir)) {
            New-Item -ItemType Directory -Force -Path $tgtDir | Out-Null
        }

        Copy-Item -Path $srcFile -Destination $tgtFile -Force
        $verb = if ($item.Status -eq "NEW") { "已建立" } else { "已更新" }
        Write-Host "[v] ${verb}: $($item.Path)"
        $applied++
    }

    return $applied
}

# ============================================================
# 共用函式：版本比對與更新說明
# ============================================================

function Get-ReleaseNotes {
    <# 
    .SYNOPSIS 擷取兩個版本之間的更新說明
    #>
    param (
        [string]$NotesPath,
        [string]$FromVersion,
        [string]$ToVersion
    )

    if (-Not (Test-Path -Path $NotesPath)) { return @() }

    $lines = Get-Content -Path $NotesPath
    $capturing = $false
    $notes = @()

    foreach ($line in $lines) {
        # 匹配 ## vX.Y.Z 格式的版本標題
        if ($line -match "^## v([\d\.]+)") {
            $ver = $Matches[1]
            if ($ver -eq $FromVersion) {
                # 到達舊版本，停止擷取
                break
            }
            $capturing = $true
        }
        if ($capturing) {
            $notes += $line
        }
    }

    return $notes
}

# ============================================================
# Upgrade 模式：比對差異 → 報告 → 確認 → 更新
# ============================================================

if ($Mode -eq "Upgrade") {
    if (-Not (Test-Path -Path $targetDir)) {
        Write-Host "[!] 目標專案尚未建立 .agents 資料夾，請改用 Fresh 模式。"
        Write-Host "    Deploy-Antigravity.ps1 -Target `"$Target`" -Mode Fresh"
        return
    }

    # 版本比對
    $targetVersionFile = Join-Path -Path $targetDir -ChildPath "VERSION"
    $targetVersion = if (Test-Path -Path $targetVersionFile) {
        (Get-Content -Path $targetVersionFile | Select-Object -First 1)
    } else { "未知" }

    Write-Host "[*] 版本：v$targetVersion → v$sourceVersion"
    Write-Host "[*] 正在掃描差異..."
    $report = Get-UpgradeReport -SourceRoot $sourceDir -TargetRoot $targetDir
    $stats = Write-UpgradeReport -Report $report

    # 顯示更新說明
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

    # ---- 階段 B: v4.0 記憶遷移（獨立於檔案更新） ----
    $migrateItems = @($report | Where-Object { $_.Status -eq "MIGRATE" })
    if ($migrateItems.Count -gt 0) {
        Write-Host ""
        Write-Host "[*] 偵測到 $($migrateItems.Count) 個舊版記憶技能，正在遷移到 memory/ 目錄..."
        
        $tgtMemory = Join-Path -Path $targetDir -ChildPath "memory"
        if (-Not (Test-Path -Path $tgtMemory)) {
            New-Item -ItemType Directory -Force -Path $tgtMemory | Out-Null
        }

        # 步驟 1: 搬移頂層 mem-* 目錄到 memory/（去掉 mem- 前綴）
        $tgtSkills = Join-Path -Path $targetDir -ChildPath "skills"
        Get-ChildItem -Path $tgtSkills -Directory | Where-Object { $_.Name -like "mem-*" } | ForEach-Object {
            $oldName = $_.Name
            $newName = $oldName -replace "^mem-", ""
            $destPath = Join-Path -Path $tgtMemory -ChildPath $newName
            Move-Item -Path $_.FullName -Destination $destPath -Force
            Write-Host "[v] 已遷移: skills/$oldName/ → memory/$newName/"
        }
        Write-Host "[OK] 記憶遷移完成。"
    }

    # ---- 階段 C: 基礎設施與命名合規（每次升級都執行） ----
    # 1. 確保 memory/ 目錄存在
    $tgtMemory = Join-Path -Path $targetDir -ChildPath "memory"
    if (-Not (Test-Path -Path $tgtMemory)) {
        New-Item -ItemType Directory -Force -Path $tgtMemory | Out-Null
        Write-Host "[v] 已建立 memory/ 目錄。"
    }

    # 2. 確保目錄連結存在
    $symlinkPath = Join-Path -Path (Join-Path -Path $targetDir -ChildPath "skills") -ChildPath "_memory"
    if (-Not (Test-Path -Path $symlinkPath)) {
        New-Item -ItemType Junction -Path $symlinkPath -Target $tgtMemory | Out-Null
        Write-Host "[v] 已建立目錄連結: skills/_memory → memory/"
    }

    # 2b. 確保 project_skills/ 目錄存在
    $tgtProject = Join-Path -Path $targetDir -ChildPath "project_skills"
    if (-Not (Test-Path -Path $tgtProject)) {
        New-Item -ItemType Directory -Force -Path $tgtProject | Out-Null
        Write-Host "[v] 已建立 project_skills/ 目錄。"
    }

    # 2c. 確保 _project 目錄連結存在
    $projectSymlink = Join-Path -Path (Join-Path -Path $targetDir -ChildPath "skills") -ChildPath "_project"
    if (-Not (Test-Path -Path $projectSymlink)) {
        New-Item -ItemType Junction -Path $projectSymlink -Target $tgtProject | Out-Null
        Write-Host "[v] 已建立目錄連結: skills/_project → project_skills/"
    }

    # 3. 命名合規掃描：修正殘留的 mem-* 目錄名稱（由深到淺）
    if (Test-Path -Path $tgtMemory) {
        $renamedCount = 0
        do {
            $renamedCount = 0
            $memDirs = Get-ChildItem -Path $tgtMemory -Directory -Recurse | Where-Object { $_.Name -like "mem-*" } | Sort-Object { $_.FullName.Length } -Descending
            foreach ($dir in $memDirs) {
                $newName = $dir.Name -replace "^mem-", ""
                $newPath = Join-Path -Path $dir.Parent.FullName -ChildPath $newName
                if (-Not (Test-Path -Path $newPath)) {
                    Rename-Item -Path $dir.FullName -NewName $newName
                    $renamedCount++
                    Write-Host "[v] 命名修正: $($dir.Name)/ → $newName/"
                }
            }
        } while ($renamedCount -gt 0)

        # 4. 內容合規掃描：修正 SKILL.md 中殘留的 mem- 引用
        Get-ChildItem -Path $tgtMemory -Filter "SKILL.md" -Recurse | ForEach-Object {
            $content = Get-Content -Path $_.FullName -Raw
            if ($content -match "mem-") {
                $updated = $content -replace "mem-", ""
                Set-Content -Path $_.FullName -Value $updated -NoNewline
                $relPath = $_.FullName.Substring($tgtMemory.Length + 1)
                Write-Host "[v] 內容修正: memory/$relPath"
            }
        }
    }

    # ---- 階段 D: 版本更新與結果報告 ----
    $targetVersionFile = Join-Path -Path $targetDir -ChildPath "VERSION"
    Set-Content -Path $targetVersionFile -Value $sourceVersion -NoNewline

    Write-Host "-----------------------------------------------"
    Write-Host "[OK] 升級完成！v$targetVersion → v$sourceVersion（更新 $applied 個檔案 / 遷移 $($migrateItems.Count) 個記憶卡）"
    if ($stats.Orphan -gt 0) {
        Write-Host "[!] 注意: $($stats.Orphan) 個孤兒檔案（源碼已刪除但目標仍存在）："
        $report | Where-Object { $_.Status -eq "ORPHAN" } | ForEach-Object {
            Write-Host "    → $($_.Path)" -ForegroundColor Magenta
        }
    }
    Write-Host "-----------------------------------------------"
    return
}

# ============================================================
# Fresh 模式：完整部署（含清理）
# ============================================================

if (Test-Path -Path $targetDir) {
    Write-Host "[!] 目標專案已有 .agents 資料夾，將覆蓋寫入..."
}
else {
    Write-Host "[v] 正在解壓 Antigravity 核心元件..."
}

# ── 保護現有記憶與衍生技能（Fresh 模式安全防線）──
$tmpMemory       = Join-Path $env:TEMP "ag_backup_memory_$(Get-Random)"
$tmpProject      = Join-Path $env:TEMP "ag_backup_project_$(Get-Random)"
$existingMemory  = Join-Path $targetDir "memory"
$existingProject = Join-Path $targetDir "project_skills"

if (Test-Path $existingMemory)  {
    Copy-Item $existingMemory  $tmpMemory  -Recurse -Force
    Write-Host "[*] 已備份記憶卡到暫存目錄..."
}
if (Test-Path $existingProject) {
    Copy-Item $existingProject $tmpProject -Recurse -Force
    Write-Host "[*] 已備份衍生技能到暫存目錄..."
}

# 複製 .agents 生態系統 (在源頭直接阻斷特定目錄與連結的複製)
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Get-ChildItem -Path $sourceDir | Where-Object { $_.Name -notin @("memory", "project_skills") } | ForEach-Object {
    $srcItem = $_
    $destPath = Join-Path -Path $targetDir -ChildPath $srcItem.Name
    
    if ($srcItem.Name -eq "skills" -and $srcItem.PSIsContainer) {
        # 進入 skills 目錄內，專門排除 _memory 與 _project 這兩個連結
        New-Item -ItemType Directory -Force -Path $destPath | Out-Null
        Get-ChildItem -Path $srcItem.FullName | Where-Object { $_.Name -notin @("_memory", "_project") } | ForEach-Object {
            Copy-Item -Path $_.FullName -Destination $destPath -Recurse -Force
        }
    } else {
        # 其他正常資料夾 (如 rules, workflows) 直接複製
        Copy-Item -Path $srcItem.FullName -Destination $targetDir -Recurse -Force
    }
}

# ── 還原受保護目錄 ──
if (Test-Path $tmpMemory)  {
    Copy-Item $tmpMemory  $existingMemory  -Recurse -Force
    Remove-Item $tmpMemory  -Recurse -Force
    Write-Host "[v] 專案記憶卡已完整保留並還原。"
}
if (Test-Path $tmpProject) {
    Copy-Item $tmpProject $existingProject -Recurse -Force
    Remove-Item $tmpProject -Recurse -Force
    Write-Host "[v] 專案衍生技能已完整保留並還原。"
}

Write-Host "[v] 核心傳輸完成，正在初始化架構..."

# 建立 memory/ 目錄（專案記憶存放處）
$memoryDir = Join-Path -Path $targetDir -ChildPath "memory"
if (-Not (Test-Path -Path $memoryDir)) {
    New-Item -ItemType Directory -Force -Path $memoryDir | Out-Null
}

# 建立符號連結 skills/_memory → memory/
$skillsDir = Join-Path -Path $targetDir -ChildPath "skills"
$symlinkPath = Join-Path -Path $skillsDir -ChildPath "_memory"
if (-Not (Test-Path -Path $symlinkPath)) {
    New-Item -ItemType Junction -Path $symlinkPath -Target $memoryDir | Out-Null
}
Write-Host "[v] 記憶目錄已建立，符號連結已設定。"

# 建立專案衍生技能目錄
$projectSkillDir = Join-Path -Path $targetDir -ChildPath "project_skills"
if (-Not (Test-Path -Path $projectSkillDir)) {
    New-Item -ItemType Directory -Force -Path $projectSkillDir | Out-Null
}
# 建立衍生技能路由表模板
$projectIndexFile = Join-Path -Path $projectSkillDir -ChildPath "_index.md"
if (-Not (Test-Path -Path $projectIndexFile)) {
    $indexTemplate = @"
# Project Skill Registry (專案衍生技能路由表)

| Keywords (EN) | 關鍵字 (ZH) | Skill | MCP Server |
|--------------|------------|-------|------------|
"@
    Set-Content -Path $projectIndexFile -Value $indexTemplate -Encoding UTF8
}
# 建立符號連結 skills/_project → project_skills/
$projectSymlink = Join-Path -Path $skillsDir -ChildPath "_project"
if (-Not (Test-Path -Path $projectSymlink)) {
    New-Item -ItemType Junction -Path $projectSymlink -Target $projectSkillDir | Out-Null
}
Write-Host "[v] 專案衍生技能目錄已建立，符號連結已設定。"
Write-Host "[v] 專案記憶系統已就緒，可執行 /02_blueprint 初始化。"

# 清理：移除舊版 cartridges 目錄
$cartridgeDir = Join-Path -Path $targetDir -ChildPath "cartridges"
if (Test-Path -Path $cartridgeDir) {
    Remove-Item -Path $cartridgeDir -Recurse -Force
    Write-Host "[*] 舊版 cartridges 目錄已移除。"
}

# 驗證部署
if (Test-Path -Path $skillsDir) {
    $totalSkills = (Get-ChildItem -Path $skillsDir -Directory | Where-Object { 
        ($_.Name -ne "_memory") -and ($_.Name -ne "_project") -and (Test-Path (Join-Path $_.FullName "SKILL.md")) 
    }).Count
    $memCards = if (Test-Path -Path $memoryDir) {
        (Get-ChildItem -Path $memoryDir -Directory -Recurse | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") }).Count
    } else { 0 }
    $projectSkills = if (Test-Path -Path $projectSkillDir) {
        (Get-ChildItem -Path $projectSkillDir -Directory -Recurse | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") }).Count
    } else { 0 }
    Write-Host "[v] 技能系統已部署: $totalSkills 個核心技能 + $projectSkills 個專案衍生技能 + $memCards 個專案記憶。"
} else {
    Write-Host "[!] 警告: 部署的 .agents 資料夾中找不到技能目錄。"
}

# 寫入版本檔
$versionFile = Join-Path -Path $targetDir -ChildPath "VERSION"
Set-Content -Path $versionFile -Value $sourceVersion -NoNewline
Write-Host "[v] 版本 v$sourceVersion 已寫入。"

# Git 排除：確保腳本工具目錄不進版控
$gitignorePath = Join-Path -Path $Target -ChildPath ".gitignore"
$excludeLine = ".agents/scripts/"
if (Test-Path -Path $gitignorePath) {
    $giContent = Get-Content -Path $gitignorePath -Raw
    if ($giContent -notmatch [regex]::Escape($excludeLine)) {
        Add-Content -Path $gitignorePath -Value "`n# Antigravity 框架工具腳本（自動產生）`n$excludeLine"
        Write-Host "[v] 已追加 .gitignore 排除: $excludeLine"
    }
} else {
    Set-Content -Path $gitignorePath -Value "# Antigravity 框架工具腳本`n$excludeLine"
    Write-Host "[v] 已建立 .gitignore 並排除: $excludeLine"
}

Write-Host "-----------------------------------------------"
Write-Host "[OK] 佈署完成！Antigravity v$sourceVersion 防護罩已啟動。"
Write-Host "-----------------------------------------------"



