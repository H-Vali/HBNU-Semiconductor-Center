param(
  [string]$PreviewRepo = "H-Vali/HBNU-Semiconductor-Center-Preview",
  [string]$PreviewDir = "..\..\work\HBNU-Semiconductor-Center-Preview"
)

$ErrorActionPreference = "Stop"

$git = "C:\Program Files\Git\cmd\git.exe"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$node = "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (-not (Test-Path $git)) { throw "Git executable was not found." }
if (-not (Test-Path $gh)) { throw "GitHub CLI executable was not found." }
if (-not (Test-Path $node)) { throw "Node executable was not found." }

$env:GITHUB_PAGES_BASE = "/HBNU-Semiconductor-Center-Preview/"
Push-Location "apps\web"
try {
  & $node ".\node_modules\vite\bin\vite.js" build
} finally {
  Pop-Location
  Remove-Item Env:\GITHUB_PAGES_BASE -ErrorAction SilentlyContinue
}

if (-not (Test-Path $PreviewDir)) {
  & $gh repo clone $PreviewRepo $PreviewDir
}

Get-ChildItem -Path $PreviewDir -Force |
  Where-Object { $_.Name -ne ".git" } |
  Remove-Item -Recurse -Force

Copy-Item -Path "apps\web\dist\*" -Destination $PreviewDir -Recurse -Force

Push-Location $PreviewDir
try {
  & $git add .
  & $git commit -m "deploy: update preview build"
  & $git push origin main
} finally {
  Pop-Location
}
