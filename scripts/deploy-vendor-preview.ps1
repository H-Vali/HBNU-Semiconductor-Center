param(
  [string]$VendorRepo = "H-Vali/HBNU-Semiconductor-Center-Vendor-Preview",
  [string]$VendorDir = (Join-Path $env:USERPROFILE "Documents\HBNU-Semiconductor-Center-Vendor-Preview"),
  [string]$BasePath = "/HBNU-Semiconductor-Center-Vendor-Preview/"
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

function Mask-PersonName {
  param([string]$Value)

  $trimmed = ""
  if ($null -ne $Value) {
    $trimmed = $Value.Trim()
  }
  if (-not $trimmed) {
    return $trimmed
  }

  if ($trimmed -match "^[\p{IsHangulSyllables}]{2,5}(\s+[\p{IsHangulSyllables}]+)?$") {
    $parts = $trimmed -split "\s+", 2
    $name = $parts[0]
    $suffix = ""
    if ($parts.Length -gt 1) {
      $suffix = " $($parts[1])"
    }
    if ($name.Length -le 2) {
      return "$($name.Substring(0, 1))*$suffix"
    }
    return "$($name.Substring(0, 1))*$($name.Substring($name.Length - 1, 1))$suffix"
  }

  if ($trimmed -match "^[A-Za-z][A-Za-z\s.'-]+$") {
    $parts = $trimmed -split "\s+"
    return ($parts | ForEach-Object {
      if ($_.Length -le 1) { return $_ }
      "$($_.Substring(0, 1))$('*' * [Math]::Min($_.Length - 1, 4))"
    }) -join " "
  }

  return $trimmed
}

function Mask-Email {
  param([string]$Value)

  $trimmed = ""
  if ($null -ne $Value) {
    $trimmed = $Value.Trim()
  }
  if (-not $trimmed -or $trimmed -notmatch "@") {
    return $trimmed
  }

  return "user***@example.com"
}

function Replace-Literal {
  param(
    [string]$Text,
    [string]$From,
    [string]$To
  )

  if ([string]::IsNullOrEmpty($From) -or $From -eq $To) {
    return $Text
  }

  return [regex]::Replace($Text, [regex]::Escape($From), [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $To })
}

function Get-ManagedUserRows {
  $source = Get-Content -Path "apps\web\src\App.tsx" -Raw -Encoding UTF8
  $pattern = "\{\s*id:\s*'user-\d+'.*?name:\s*'(?<name>[^']+)'.*?roleLevel:\s*'(?<role>[^']+)'.*?department:\s*'(?<department>[^']+)'.*?labProfessor:\s*'(?<lab>[^']+)'.*?phone:\s*'(?<phone>[^']*)'.*?email:\s*'(?<email>[^']*)'"
  [regex]::Matches($source, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline) | ForEach-Object {
    [pscustomobject]@{
      Name = $_.Groups["name"].Value
      Lab = $_.Groups["lab"].Value
      Phone = $_.Groups["phone"].Value
      Email = $_.Groups["email"].Value
    }
  }
}

function Convert-DistToVendorPreview {
  param([string]$DistDir)

  $encoding = New-Object System.Text.UTF8Encoding($false)
  $textFiles = Get-ChildItem -Path $DistDir -Recurse -Include "*.html", "*.js", "*.css" -File
  $users = @(Get-ManagedUserRows)

  foreach ($file in $textFiles) {
    $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)

    foreach ($user in $users) {
      $text = Replace-Literal $text $user.Name (Mask-PersonName $user.Name)
      $text = Replace-Literal $text $user.Lab (Mask-PersonName $user.Lab)
      $labName = ($user.Lab -split "\s+", 2)[0]
      $text = Replace-Literal $text $labName (Mask-PersonName $labName)
      $text = Replace-Literal $text $user.Phone "010-****-****"
      $text = Replace-Literal $text $user.Email (Mask-Email $user.Email)
    }

    $literalReplacements = @(
      [pscustomobject]@{ From = "HBNU SEMICONDUCTOR CENTER"; To = "SEMICONDUCTOR CENTER DEMO" }
      [pscustomobject]@{ From = "HBNU Semiconductor Center"; To = "Semiconductor Center Demo" }
      [pscustomobject]@{ From = "HBNU"; To = "DEMO" }
      [pscustomobject]@{ From = "국립한밭대학교 창의융합교육센터"; To = "반도체 장비 공동활용센터" }
      [pscustomobject]@{ From = "국립한밭대학교"; To = "협력기관" }
      [pscustomobject]@{ From = "한밭대학교"; To = "협력기관" }
      [pscustomobject]@{ From = "한밭대"; To = "협력기관" }
      [pscustomobject]@{ From = "대전광역시"; To = "협력기관" }
      [pscustomobject]@{ From = "대전테크노파크"; To = "협력기관" }
      [pscustomobject]@{ From = "Daejeon"; To = "Partner" }
      [pscustomobject]@{ From = "Hanbat"; To = "Partner" }
    )

    foreach ($replacement in $literalReplacements) {
      $text = Replace-Literal $text $replacement.From $replacement.To
    }

    $text = Replace-Literal $text "/DEMO-Semiconductor-Center-Vendor-Preview/" $BasePath

    $text = $text -replace "010-\d{4}-\d{4}", "010-****-****"
    $text = $text -replace "[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", "user***@example.com"
    $text = $text -replace "hbnu-", "vendor-preview-"
    $text = Replace-Literal $text "/vendor-preview-Semiconductor-Center-Vendor-Preview/" $BasePath

    [System.IO.File]::WriteAllText($file.FullName, $text, $encoding)
  }

  $cssFiles = Get-ChildItem -Path (Join-Path $DistDir "assets") -Filter "index-*.css" -File -ErrorAction SilentlyContinue
  foreach ($cssFile in $cssFiles) {
    $css = [System.IO.File]::ReadAllText($cssFile.FullName, [System.Text.Encoding]::UTF8)
    $css += @"

/* Vendor quote preview sanitization */
.brand-mark,
.hero-logo-watermarks,
.hanbat-logo-mark {
  display: none !important;
}
"@
    [System.IO.File]::WriteAllText($cssFile.FullName, $css, $encoding)
  }
}

function Ensure-Repository {
  param(
    [string]$Repo,
    [string]$Gh
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $Gh repo view $Repo --json name *> $null
  $repoViewExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference

  if ($repoViewExitCode -eq 0) {
    return
  }

  Write-Host "Creating vendor preview repository $Repo..."
  Invoke-Native $Gh repo create $Repo --public --description "One-time sanitized quote preview for HBNU Semiconductor Center" --clone=false
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

Write-Host "Building sanitized vendor preview..."
$env:GITHUB_PAGES_BASE = $BasePath
try {
  Invoke-Native $npm run build --workspace "@hbnu/web"
} finally {
  Remove-Item Env:\GITHUB_PAGES_BASE -ErrorAction SilentlyContinue
}

Convert-DistToVendorPreview -DistDir "apps\web\dist"
Ensure-Repository -Repo $VendorRepo -Gh $gh

try {
  & $gh api --method POST "repos/$VendorRepo/pages" -f build_type=workflow *> $null
} catch {
  Write-Host "Pages workflow configuration already exists or will be configured by GitHub Actions."
}

if (-not (Test-Path $VendorDir)) {
  Write-Host "Cloning vendor preview repository into $VendorDir..."
  Invoke-Native $gh repo clone $VendorRepo $VendorDir
} else {
  Write-Host "Syncing vendor preview repository..."
  Push-Location $VendorDir
  try {
    Invoke-Native $git pull --rebase origin main
  } finally {
    Pop-Location
  }
}

Write-Host "Updating vendor preview files..."
Get-ChildItem -Path $VendorDir -Force |
  Where-Object { $_.Name -ne ".git" } |
  Remove-Item -Recurse -Force

Copy-Item -Path "apps\web\dist\*" -Destination $VendorDir -Recurse -Force

New-Item -Path (Join-Path $VendorDir ".nojekyll") -ItemType File -Force | Out-Null
Set-Content -Path (Join-Path $VendorDir ".gitattributes") -Value @(
  "*.css text eol=lf"
  "*.js text eol=lf"
) -Encoding ascii

$workflowDir = Join-Path $VendorDir ".github\workflows"
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

Push-Location $VendorDir
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
    Write-Host "Vendor preview repository already matches the latest sanitized build."
    Write-Host "Vendor preview: https://h-vali.github.io/HBNU-Semiconductor-Center-Vendor-Preview/"
    return
  }

  Invoke-Native $git commit -m "deploy: update sanitized vendor preview"
  Invoke-Native $git push origin main
  Write-Host "Vendor preview deployed: https://h-vali.github.io/HBNU-Semiconductor-Center-Vendor-Preview/"
} finally {
  Pop-Location
}
