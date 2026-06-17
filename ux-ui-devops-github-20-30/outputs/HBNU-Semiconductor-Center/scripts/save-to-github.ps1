param(
  [string]$Message = "chore: auto-save development progress",
  [string]$RemoteUrl = "https://github.com/H-Vali/HBNU-Semiconductor-Center.git",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not installed or not available in PATH."
}

if (-not (Test-Path ".git")) {
  git init
  git branch -M $Branch
}

$origin = git remote get-url origin 2>$null
if (-not $origin) {
  git remote add origin $RemoteUrl
}

git add .
git commit -m $Message
git push -u origin $Branch
