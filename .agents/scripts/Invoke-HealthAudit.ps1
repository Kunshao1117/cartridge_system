# ============================================================
# Invoke-HealthAudit.ps1
# 08 健檢工具掃描腳本 — 由 CLI 子代理呼叫
# 輸出報告至 $AgentsDir/logs/audit_*.md
#
# 注意：ESLint/TypeScript/依賴安全/TODO 統計 已由 CLI 掃描任務
#       (scan-task-prompt.md) 負責，本腳本僅處理「工具無法覆蓋」的掃描。
# ============================================================

param(
    [string]$ProjectRoot = ".",     # 專案根目錄（含 package.json / src/）
    [string]$AgentsDir = ".agents", # .agents/ 目錄路徑
    [ValidateSet("security", "performance", "all")]
    [string]$Module = "all"         # 要執行的掃描模組
)

# ─── PowerShell 7 版本閘門 ───
if ($PSVersionTable.PSVersion.Major -lt 7) {
    $pwshCmd = Get-Command pwsh -ErrorAction SilentlyContinue
    if ($pwshCmd) {
        & pwsh -File $MyInvocation.MyCommand.Path @PSBoundParameters
        exit $LASTEXITCODE
    }
    Write-Error "[HALT] 此腳本需要 PowerShell 7+。請安裝 pwsh 或使用 pwsh 執行。"
    exit 1
}

$ErrorActionPreference = "Continue"
$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss+08:00"

# ── 工具函式 ────────────────────────────────────────────────
function Write-ReportHeader {
    param([string]$Title, [string]$OutputFile)
    $header = @"
# $Title
Generated: $timestamp
ProjectRoot: $ProjectRoot

"@
    Set-Content -Path $OutputFile -Value $header -Encoding UTF8
}

function Append-Section {
    param([string]$Content, [string]$OutputFile)
    Add-Content -Path $OutputFile -Value $Content -Encoding UTF8
}

# ── 確保輸出目錄存在 ─────────────────────────────────────────
$logsDir = Join-Path $AgentsDir "logs"
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }

# ============================================================
# MODULE: security — 硬編碼與環境變數掃描
# ============================================================
function Invoke-SecurityModule {
    $outputFile = Join-Path $logsDir "audit_security_scan.md"
    Write-ReportHeader -Title "健檢報告：工具層安全掃描" -OutputFile $outputFile

    Push-Location $ProjectRoot
    try {
        # 硬編碼金鑰模式掃描
        Append-Section "## 硬編碼憑證掃描" $outputFile
        $patterns = @(
            'sk-[a-zA-Z0-9]{20,}',   # OpenAI API Keys
            'AIza[a-zA-Z0-9_-]{35}', # Google API Keys
            'ghp_[a-zA-Z0-9]{36}',   # GitHub Personal Access Tokens
            'mongodb\+srv://.+:.+@',  # MongoDB connection strings
            'postgresql://.+:.+@',    # PostgreSQL connection strings
            'secret.*=.*["\x27][a-zA-Z0-9+/]{20,}'  # Generic secrets
        )
        $hardcodeFound = $false
        foreach ($pattern in $patterns) {
            if (Test-Path "src") {
                $matches = Select-String -Path "src/**/*" -Pattern $pattern -Recurse 2>$null
                if ($matches) {
                    $hardcodeFound = $true
                    Append-Section "疑似硬編碼憑證（請人工確認）：" $outputFile
                    $matches | ForEach-Object { Append-Section "  - $($_.Filename):$($_.LineNumber)" $outputFile }
                }
            }
        }
        if (-not $hardcodeFound) {
            Append-Section "✅ 未偵測到明顯硬編碼憑證模式" $outputFile
        }

        # .env.example vs process.env 比對
        Append-Section "`n## 環境變數一致性" $outputFile
        $envExample = Join-Path $ProjectRoot ".env.example"
        if (Test-Path $envExample) {
            $envKeys = (Get-Content $envExample) |
                Where-Object { $_ -match "^[A-Z_]+=?" } |
                ForEach-Object { ($_ -split "=")[0].Trim() }

            Append-Section ".env.example 定義變數：$($envKeys.Count) 個" $outputFile
            foreach ($key in $envKeys) {
                if (Test-Path "src") {
                    $usage = Select-String -Path "src/**/*" -Pattern "process\.env\.$key|process\.env\['$key'\]" -Recurse 2>$null
                    if (-not $usage) {
                        Append-Section "  🟡 $key — 已定義但未在 src/ 中使用" $outputFile
                    }
                }
            }
        } else {
            Append-Section "未找到 .env.example 檔案" $outputFile
        }

    } finally {
        Pop-Location
    }

    Write-Host "✅ security 掃描完成 → $outputFile"
}

# ============================================================
# MODULE: performance — Lighthouse 效能掃描
# ============================================================
function Invoke-PerformanceModule {
    $outputFile = Join-Path $logsDir "audit_perf.md"
    Write-ReportHeader -Title "健檢報告：效能掃描" -OutputFile $outputFile

    Push-Location $ProjectRoot
    try {
        # 判斷是否有前端
        $hasFrontend = (Test-Path "src/app") -or (Test-Path "src/pages") -or (Test-Path "app") -or (Test-Path "pages")

        if (-not $hasFrontend) {
            Append-Section "本專案無前端頁面（無 app/ 或 pages/ 目錄），效能掃描跳過。" $outputFile
            Write-Host "⏭️ 無前端頁面，效能掃描跳過"
            return
        }

        # 確認 dev server 可啟動
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        if (-not $packageJson.scripts.dev) {
            Append-Section "package.json 未定義 dev script，無法啟動開發伺服器，效能掃描跳過。" $outputFile
            return
        }

        # Lighthouse 掃描核心頁面
        Append-Section "## Lighthouse 效能掃描" $outputFile
        Append-Section "請確認開發伺服器已在 http://localhost:3000 啟動，再讀取此報告。" $outputFile
        Append-Section "`n執行命令（請在啟動 dev server 後手動執行）：" $outputFile
        Append-Section "``````powershell" $outputFile
        Append-Section "npx lighthouse http://localhost:3000 --output=json --output-path=$logsDir/lighthouse-home.json --chrome-flags=`"--headless`"" $outputFile
        Append-Section "``````" $outputFile
        Append-Section "`n判定標準：Performance < 90 → 🟡（< 70 → 🔴） | LCP > 2.5s → 🟡（> 4.0s → 🔴） | CLS > 0.1 → 🟡（> 0.25 → 🔴）" $outputFile

    } finally {
        Pop-Location
    }

    Write-Host "✅ performance 模組完成 → $outputFile"
}

# ============================================================
# 主執行流程
# ============================================================
switch ($Module) {
    "security"    { Invoke-SecurityModule }
    "performance" { Invoke-PerformanceModule }
    "all" {
        Invoke-SecurityModule
        Invoke-PerformanceModule
        Write-Host "`n✅ 所有健檢掃描模組完成，報告位於：$logsDir"
    }
}
