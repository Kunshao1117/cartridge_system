<#
.SYNOPSIS
    倉庫狀態掃描腳本 — 掃描專案文件 + 偵測殘留追蹤檔案。
.DESCRIPTION
    供 09_commit_log 工作流使用。合併兩項檢查：
    1. 衛生檢查：偵測已被 .gitignore 排除但仍被 Git 追蹤的殘留檔案
    2. 文件掃描：掃描專案內所有 .md 說明文件（排除框架/依賴/建構產出）
    結果輸出至 $AgentsDir/logs/doc_scan.md。
.PARAMETER ProjectRoot
    專案根目錄
.PARAMETER AgentsDir
    .agents/ 目錄路徑
.EXAMPLE
    .\Invoke-DocScan.ps1 -ProjectRoot "D:\Projects\MyApp" -AgentsDir "D:\Projects\.agents"
#>
param(
    [string]$ProjectRoot = ".",
    [string]$AgentsDir = ".agents"
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# ── 解析絕對路徑 ──
$ProjectRoot = (Resolve-Path $ProjectRoot).Path
$logsDir = Join-Path $AgentsDir "logs"
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }

$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss+08:00"
$report = @"
# 倉庫狀態報告
Generated: $timestamp
ProjectRoot: $ProjectRoot

"@

# ══════════════════════════════════════
# 1. 衛生檢查：殘留追蹤偵測
# ══════════════════════════════════════
$staleTracked = @()
try {
    $gitResult = git -C $ProjectRoot ls-files -ic --exclude-standard 2>$null
    if ($gitResult) { $staleTracked = @($gitResult) }
} catch { }

if ($staleTracked.Count -gt 0) {
    $report += "## 殘留追蹤（已被 .gitignore 排除但仍在倉庫中）`n`n"
    foreach ($f in $staleTracked) {
        $report += "- ``$f```n"
    }
    $report += "`n> 建議執行 ``git rm --cached`` 移除追蹤。`n`n"
} else {
    $report += "## ✅ 倉庫衛生`n`n無殘留追蹤檔案。`n`n"
}

# ══════════════════════════════════════
# 2. 文件掃描：專案 .md 文件
# ══════════════════════════════════════
$ExcludeDirs = @(
    '.agents', '.gemini', '.git',
    'node_modules', 'dist', 'build', '.next',
    '__pycache__', 'venv', '.venv', 'vendor',
    'coverage', '.turbo', '.vercel'
)
$ExcludeFiles = @('CHANGELOG.md')

$docs = Get-ChildItem -Path $ProjectRoot -Filter '*.md' -Recurse -ErrorAction SilentlyContinue |
    Where-Object {
        $relativePath = $_.FullName.Substring($ProjectRoot.Length).TrimStart('\', '/')
        $excluded = $false
        foreach ($dir in $ExcludeDirs) {
            if ($relativePath -like "$dir\*" -or $relativePath -like "$dir/*") {
                $excluded = $true; break
            }
        }
        if ($_.Name -in $ExcludeFiles) { $excluded = $true }
        -not $excluded
    }

if ($docs.Count -eq 0) {
    $report += "## 📄 專案文件`n`n無專案文件。`n"
} else {
    $report += "## 📄 專案文件 (共 $($docs.Count) 個)`n`n"
    foreach ($doc in $docs) {
        $rel = $doc.FullName.Substring($ProjectRoot.Length).TrimStart('\', '/')
        $lastMod = $doc.LastWriteTime.ToString("yyyy-MM-dd")
        $report += "- ``$rel`` (最後修改: $lastMod)`n"
    }
}

# ── 輸出 ──
$outputFile = Join-Path $logsDir "doc_scan.md"
Set-Content -Path $outputFile -Value $report -Encoding UTF8

$staleCount = $staleTracked.Count
Write-Host "✅ 倉庫掃描完成：$staleCount 個殘留追蹤 / $($docs.Count) 個專案文件 → $outputFile"
