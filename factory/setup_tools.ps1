$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Bin = Join-Path $Root "tools\bin"
$Mkfatfs = Join-Path $Bin "mkfatfs.exe"
$Tmp = Join-Path $Root "tools\tmp"

New-Item -ItemType Directory -Force -Path $Bin | Out-Null

if (Test-Path $Mkfatfs) {
    Write-Host "mkfatfs already present: $Mkfatfs"
} else {
    $sources = @(
        @{
            Url = "https://github.com/labplus-cn/mkfatfs/releases/download/v1.0/mkfatfs_v1.0.exe"
            Out = $Mkfatfs
        },
        @{
            Url = "https://github.com/labplus-cn/mkfatfs/releases/download/v2.0.1/mkfatfs.rar"
            Out = (Join-Path $Tmp "mkfatfs.rar")
            Extract = $true
        }
    )

    $ok = $false
    foreach ($src in $sources) {
        Write-Host "Downloading $($src.Url)..."
        New-Item -ItemType Directory -Force -Path (Split-Path $src.Out) | Out-Null
        try {
            curl.exe -fsSL -o $src.Out $src.Url
        } catch {
            Write-Host "curl failed: $_"
            continue
        }
        if (-not (Test-Path $src.Out) -or (Get-Item $src.Out).Length -lt 1000) {
            Write-Host "download too small or missing, trying next source..."
            continue
        }
        if ($src.Extract) {
            $sevenZip = @(
                "${env:ProgramFiles}\7-Zip\7z.exe",
                "${env:ProgramFiles(x86)}\7-Zip\7z.exe"
            ) | Where-Object { Test-Path $_ } | Select-Object -First 1
            if (-not $sevenZip) {
                Write-Host "7-Zip required to extract mkfatfs.rar (install 7-Zip or use v1.0 direct exe)"
                continue
            }
            & $sevenZip x $src.Out "-o$Bin" -y | Out-Null
            $found = Get-ChildItem -Path $Bin -Filter "mkfatfs*.exe" -Recurse | Select-Object -First 1
            if ($found) {
                Copy-Item $found.FullName $Mkfatfs -Force
            }
        }
        if (Test-Path $Mkfatfs) {
            $ok = $true
            Write-Host "Installed: $Mkfatfs"
            break
        }
    }
    if (-not $ok) {
        Write-Host ""
        Write-Host "Manual install:"
        Write-Host "  1. Download https://github.com/labplus-cn/mkfatfs/releases/download/v1.0/mkfatfs_v1.0.exe"
        Write-Host "  2. Rename to factory\tools\bin\mkfatfs.exe"
        exit 1
    }
}

Write-Host "Installing Python deps..."
python -m pip install -r (Join-Path $Root "requirements.txt")
