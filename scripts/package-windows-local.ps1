param(
  [string]$MsysRoot = "C:\msys64"
)

$ErrorActionPreference = "Stop"

function Fail($Message) {
  throw "[package-win] $Message"
}

function Require-Command($Name, $Hint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Fail "Missing $Name. $Hint"
  }
}

function Find-VsInstall {
  $vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
  if (-not (Test-Path $vswhere)) {
    return $null
  }
  & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
}

function Copy-MsysMpvRuntime {
  param([string]$Root)

  $bash = Join-Path $Root "usr\bin\bash.exe"
  if (-not (Test-Path $bash)) {
    Fail "Missing MSYS2 at $Root. Install MSYS2 and mingw-w64-x86_64-mpv first."
  }

  & $bash -lc @'
set -euo pipefail
workspace="$(pwd -W | sed 's#\\#/#g')"
target="$workspace/resources/native/win32/x64"
mkdir -p "$target/include/mpv"

for header in client.h render.h render_gl.h; do
  cp "/mingw64/include/mpv/$header" "$target/include/mpv/$header"
done

declare -A copied=()
copy_dll() {
  local source="$1"
  local name
  name="$(basename "$source")"
  if [ -n "${copied[$name]:-}" ]; then
    return
  fi
  copied[$name]=1
  cp -f "$source" "$target/$name"
  while IFS= read -r dep; do
    copy_dll "$dep"
  done < <(ldd "$source" | awk '{ for (i = 1; i <= NF; i++) if ($i ~ /^\/mingw64\/bin\/.*\.dll$/) print $i }')
}

copy_dll /mingw64/bin/libmpv-2.dll
find "$target" -maxdepth 1 -iname '*.dll' -print | sort
'@
}

if ($PWD.Provider.Name -ne "FileSystem") {
  Fail "Run this script from the repository directory on a Windows filesystem."
}

$repoPath = $PWD.Path
if ($repoPath.StartsWith("\\") -or $repoPath.Contains("::\\")) {
  Fail "Run from a Windows drive path, not a WSL UNC path. Copy/clone the repo to a path such as E:\workspace\emby-html-player."
}
if (-not (Test-Path "package.json") -or -not (Test-Path "native\mpv-player\binding.gyp")) {
  Fail "Run this script from the repository root."
}

Require-Command node "Install Node.js 22.x for Windows and put it on PATH."
Require-Command pnpm "Install pnpm 10.33.0 or enable it with Corepack."

$nodeVersion = (node --version).Trim()
if (-not $nodeVersion.StartsWith("v22.")) {
  Fail "Expected Node.js 22.x, got $nodeVersion."
}

$vsInstall = Find-VsInstall
if (-not $vsInstall) {
  Fail "Missing Visual Studio C++ Build Tools. Install workload Microsoft.VisualStudio.Workload.VCTools."
}

if (-not (Test-Path "vendor/mpv/win32/x64")) {
  Copy-MsysMpvRuntime -Root $MsysRoot
}

pnpm install --frozen-lockfile
pnpm package:win
