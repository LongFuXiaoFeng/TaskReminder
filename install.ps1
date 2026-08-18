<#
.SYNOPSIS
  One-command installer for the DSH TaskReminder plugin.
  DSH TaskReminder 插件一键安装 / 卸载脚本。

.DESCRIPTION
  Installs TaskReminder into a DSH profile composition:
    1. locates the profile dir ($DSH_HOME/profiles/<Profile>)
    2. ensures the plugin source exists (uses -RepoPath, or clones from GitHub)
    3. creates a junction `<profile>/taskreminder` -> repo
    4. appends the loader patch row to cordis.patch.yml (idempotent)
  Run -Uninstall to remove the junction and the patch row.
  Restart DSH after installing: the plugin auto-loads and plays a crisp
  "ding" whenever a top-level session agent finishes a task.

  One line (PowerShell 7+):
    irm https://raw.githubusercontent.com/LongFuXiaoFeng/dsh-task-reminder/main/install.ps1 | iex

.PARAMETER Profile
  DSH profile name under $DSH_HOME/profiles. Default: web.

.PARAMETER RepoPath
  Path to an existing TaskReminder checkout. When omitted, the script clones
  the GitHub repo into $HOME/dsh-task-reminder (unless -NoClone).

.PARAMETER NoClone
  Never clone; require an existing repo at -RepoPath (or the default path).

.PARAMETER Uninstall
  Remove the junction and the patch row instead of installing.
#>
[CmdletBinding()]
param(
  [string]$Profile = 'web',
  [string]$RepoPath = '',
  [switch]$NoClone,
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "    $msg" -ForegroundColor Green }

$GITHUB_REPO = 'https://github.com/LongFuXiaoFeng/dsh-task-reminder.git'
$homeDir = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }
$profileDir = Join-Path $homeDir (Join-Path 'profiles' $Profile)
$patchFile = Join-Path $profileDir 'cordis.patch.yml'
$linkPath = Join-Path $profileDir 'taskreminder'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function New-Junction {
  param([string]$Path, [string]$Target)
  New-Item -ItemType Junction -Path $Path -Target $Target | Out-Null
}

# ── uninstall ───────────────────────────────────────────────────────────────
if ($Uninstall) {
  if (Test-Path $linkPath) {
    Remove-Item $linkPath -Force
    Ok "junction removed: $linkPath"
  } else {
    Ok "no junction at $linkPath"
  }
  if (Test-Path $patchFile) {
    $content = Get-Content $patchFile -Raw -Encoding UTF8
    $rowRe = '(?ms)(?:^[ \t]*#[^\r\n]*(?:\r?\n|$))+- insert:\r?\n[ \t]+- id: taskreminder\r?\n[ \t]+name: ./taskreminder/plugin/index\.js\r?\n?'
    if ($content -match $rowRe) {
      $content = $content -replace $rowRe, ''
      [System.IO.File]::WriteAllText($patchFile, $content.TrimEnd() + "`r`n", $utf8NoBom)
      Ok 'taskreminder patch row removed'
    } else {
      Ok 'patch contains no taskreminder row'
    }
  }
  Write-Host "`nUninstalled. Restart DSH to unload the plugin." -ForegroundColor Green
  exit 0
}

# ── install ─────────────────────────────────────────────────────────────────
if (-not (Test-Path $profileDir)) {
  throw "profile dir not found: $profileDir (is DSH installed? pass -Profile <name>)"
}

Step "Ensuring plugin source"
if (-not $RepoPath) { $RepoPath = Join-Path $HOME 'dsh-task-reminder' }
$repoPath = [System.IO.Path]::GetFullPath($RepoPath)
$pluginFile = Join-Path $repoPath 'plugin\index.js'
if (-not (Test-Path $pluginFile)) {
  if ($NoClone) { throw "plugin source not found: $pluginFile (pass -RepoPath or drop -NoClone)" }
  Step "Cloning $GITHUB_REPO"
  git clone $GITHUB_REPO $repoPath
  if (-not (Test-Path $pluginFile)) { throw 'clone failed: plugin/index.js missing' }
  Ok "cloned to $repoPath"
} else {
  Ok "source at $repoPath"
}

Step "Creating junction"
if (Test-Path $linkPath) {
  $item = Get-Item $linkPath
  if ($item.LinkType -eq 'Junction' -and $item.Target -eq $repoPath) {
    Ok "junction already correct: $linkPath"
  } else {
    Remove-Item $linkPath -Force
    New-Junction -Path $linkPath -Target $repoPath
    Ok "junction recreated: $linkPath -> $repoPath"
  }
} else {
  New-Junction -Path $linkPath -Target $repoPath
  Ok "junction created: $linkPath -> $repoPath"
}

Step "Updating composition patch"
if (-not (Test-Path $patchFile)) {
  $content = ''
} else {
  $content = Get-Content $patchFile -Raw -Encoding UTF8
}
if ($content -match 'id:\s*taskreminder') {
  Ok 'patch already contains the taskreminder row'
} else {
  $insert = @"

# TaskReminder (installed by install.ps1)
- insert:
    - id: taskreminder
      name: ./taskreminder/plugin/index.js
"@
  if ($content -match '(?ms)^\s*\[\s*\]\s*$') {
    $content = $content -replace '(?ms)^\s*\[\s*\]\s*$', $insert.TrimStart()
  } else {
    $content = $content.TrimEnd() + "`r`n" + $insert.TrimEnd()
  }
  [System.IO.File]::WriteAllText($patchFile, $content.TrimEnd() + "`r`n", $utf8NoBom)
  Ok "patch updated: $patchFile"
}

Write-Host "`nDone! Restart DSH to load TaskReminder." -ForegroundColor Green
Write-Host "    dsh --profile $Profile" -ForegroundColor Yellow
Write-Host 'On task completion you will hear a crisp ding.' -ForegroundColor Yellow
