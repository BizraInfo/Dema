param(
  [switch]$DryRun,
  [switch]$Check,
  [switch]$Help
)

$DemaHome = if ($env:DEMA_HOME) { $env:DEMA_HOME } else { Join-Path $HOME ".dema" }

if ($Help) {
  Write-Host "Usage: install-windows.ps1 [-DryRun | -Check]"
  Write-Host ""
  Write-Host "  -DryRun  Show what would be created; write nothing."
  Write-Host "  -Check   Report current state of `$DEMA_HOME; write nothing."
  Write-Host "  (no flag) Apply: create missing dirs/files; preserve existing."
  Write-Host ""
  Write-Host "DEMA_HOME defaults to `$HOME\.dema (currently: $DemaHome)."
  exit 0
}

$Mode = if ($DryRun) { "dry-run" } elseif ($Check) { "check" } else { "apply" }

function Process-DemaDir($Name) {
  $Path = Join-Path $DemaHome $Name
  if (Test-Path $Path -PathType Container) {
    if ($Mode -eq "apply") { Write-Host "Preserved: $Path" } else { Write-Host "Existing: $Path" }
  } else {
    switch ($Mode) {
      "apply" {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
        Write-Host "Created: $Path"
      }
      "dry-run" { Write-Host "Would create: $Path" }
      "check"   { Write-Host "Missing: $Path" }
    }
  }
}

function Process-DemaFile($Path, $BodyObj) {
  if (Test-Path $Path -PathType Leaf) {
    if ($Mode -eq "apply") { Write-Host "Preserved: $Path" } else { Write-Host "Existing: $Path" }
  } else {
    switch ($Mode) {
      "apply" {
        $BodyObj | ConvertTo-Json | Set-Content -Path $Path -Encoding UTF8
        Write-Host "Created: $Path"
      }
      "dry-run" { Write-Host "Would create: $Path" }
      "check"   { Write-Host "Missing: $Path" }
    }
  }
}

if ($Mode -eq "apply") {
  New-Item -ItemType Directory -Force -Path $DemaHome | Out-Null
}

Write-Host "Mode: $Mode"
Write-Host "DEMA_HOME: $DemaHome"
Write-Host "---"
Process-DemaDir "receipts"
Process-DemaDir "memory"
Process-DemaDir "logs"
Process-DemaDir "skills"

$ProfileObj = @{
  schema         = "bizra.dema.profile.v0.1"
  preferred_name = $null
  memory_consent = "local"
  hidden_autonomy = $false
}

$ConfigObj = @{
  schema                 = "bizra.dema.local_config.v0.1"
  mode                   = "local"
  noHiddenDaemon         = $true
  requireExplicitConsent = $true
  nextArtifact           = "ARTIFACT-011"
}

Process-DemaFile (Join-Path $DemaHome "profile.json") $ProfileObj
Process-DemaFile (Join-Path $DemaHome "config.local.json") $ConfigObj

Write-Host "---"
switch ($Mode) {
  "apply"   { Write-Host "Dema local setup complete at $DemaHome" }
  "dry-run" { Write-Host "Dry-run complete: no files written." }
  "check"   { Write-Host "Check complete: state above is current." }
}

if ($Mode -eq "apply") {
  Write-Host "Not touched: daemon state, mission runtime, runtime pulse, receipt history, external provider settings."
  Write-Host "No daemon was started. No mission was executed. ARTIFACT-011 was not issued."
  Write-Host "Next: run 'dema status'."
}
