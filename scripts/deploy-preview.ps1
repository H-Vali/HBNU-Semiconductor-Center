param(
  [string]$PreviewRepo = "H-Vali/HBNU-Semiconductor-Center-Preview",
  [string]$PreviewDir = (Join-Path $env:USERPROFILE "Documents\HBNU-Semiconductor-Center-Preview")
)

$ErrorActionPreference = "Stop"

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
  }
}

function Resolve-Tool {
  param(
    [string]$Name,
    [string[]]$Candidates
  )

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  foreach ($candidate in $Candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  throw "$Name was not found. Install it or add it to PATH."
}

$git = Resolve-Tool "git.exe" @(
  "C:\Program Files\Git\cmd\git.exe",
  (Join-Path $env:LOCALAPPDATA "Programs\Git\cmd\git.exe")
)
$gh = Resolve-Tool "gh.exe" @(
  "C:\Program Files\GitHub CLI\gh.exe",
  (Join-Path $env:LOCALAPPDATA "GitHub CLI\gh.exe")
)
$npm = Resolve-Tool "npm.cmd" @(
  "C:\Program Files\nodejs\npm.cmd"
)

$gitDir = Split-Path $git -Parent
$ghDir = Split-Path $gh -Parent
$env:Path = "$gitDir;$ghDir;$env:Path"

Write-Host "Building web app for GitHub Pages..."

$env:GITHUB_PAGES_BASE = "/HBNU-Semiconductor-Center-Preview/"
try {
  Invoke-Native $npm run build --workspace "@hbnu/web"
} finally {
  Remove-Item Env:\GITHUB_PAGES_BASE -ErrorAction SilentlyContinue
}

if (-not (Test-Path $PreviewDir)) {
  Write-Host "Cloning preview repository into $PreviewDir..."
  Invoke-Native $gh repo clone $PreviewRepo $PreviewDir
}

Write-Host "Updating preview files..."
Get-ChildItem -Path $PreviewDir -Force |
  Where-Object { $_.Name -ne ".git" } |
  Remove-Item -Recurse -Force

Copy-Item -Path "apps\web\dist\*" -Destination $PreviewDir -Recurse -Force
New-Item -Path (Join-Path $PreviewDir ".nojekyll") -ItemType File -Force | Out-Null
Set-Content -Path (Join-Path $PreviewDir ".gitattributes") -Value @(
  "*.css text eol=lf"
  "*.js text eol=lf"
) -Encoding ascii
$workflowDir = Join-Path $PreviewDir ".github\workflows"
New-Item -Path $workflowDir -ItemType Directory -Force | Out-Null
Set-Content -Path (Join-Path $workflowDir "pages.yml") -Value @(
  "name: Deploy GitHub Pages"
  ""
  "on:"
  "  push:"
  "    branches: [main]"
  "  workflow_dispatch:"
  ""
  "permissions:"
  "  contents: read"
  "  pages: write"
  "  id-token: write"
  ""
  "concurrency:"
  "  group: pages"
  "  cancel-in-progress: true"
  ""
  "jobs:"
  "  deploy:"
  "    environment:"
  "      name: github-pages"
  "      url: `${{ steps.deployment.outputs.page_url }}"
  "    runs-on: ubuntu-latest"
  "    steps:"
  "      - uses: actions/checkout@v4"
  "      - uses: actions/configure-pages@v5"
  "      - uses: actions/upload-pages-artifact@v3"
  "        with:"
  "          path: ."
  "      - id: deployment"
  "        uses: actions/deploy-pages@v4"
) -Encoding ascii

Push-Location $PreviewDir
try {
  $configuredName = & $git config user.name
  $configuredEmail = & $git config user.email
  if (-not $configuredName) {
    Invoke-Native $git config user.name "H-Vali"
  }
  if (-not $configuredEmail) {
    Invoke-Native $git config user.email "294348281+H-Vali@users.noreply.github.com"
  }

  Invoke-Native $git add .
  $status = & $git status --porcelain
  if (-not $status) {
    Write-Host "Preview repository already matches the latest build."
    return
  }

  Invoke-Native $git commit -m "deploy: update preview build"
  Invoke-Native $git push origin main
  Write-Host "Preview deployed: https://h-vali.github.io/HBNU-Semiconductor-Center-Preview/"
} finally {
  Pop-Location
}
