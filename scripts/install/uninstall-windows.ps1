$DemaHome = if ($env:DEMA_HOME) { $env:DEMA_HOME } else { Join-Path $HOME ".dema" }
$ExpectedPhrase = "REMOVE DEMA LOCAL DATA"

if (-not (Test-Path -LiteralPath $DemaHome)) {
  Write-Host "Nothing to uninstall: $DemaHome does not exist."
  exit 0
}

# Resolve to canonical absolute path (defends against relative inputs + symlinks).
try {
  $Resolved = (Resolve-Path -LiteralPath $DemaHome -ErrorAction Stop).Path
} catch {
  Write-Host "Refusing to delete: cannot resolve $DemaHome to an absolute path."
  exit 1
}

$ResolvedTrimmed = $Resolved.TrimEnd('\', '/')
$Root = [System.IO.Path]::GetPathRoot($Resolved).TrimEnd('\', '/')

# Reject empty / drive root.
if ([string]::IsNullOrEmpty($ResolvedTrimmed) -or $ResolvedTrimmed -ieq $Root) {
  Write-Host "Refusing to delete: $Resolved is a drive root or empty."
  exit 1
}

# Reject home / userprofile.
$HomeTrimmed = if ($HOME) { $HOME.TrimEnd('\', '/') } else { '' }
$UserProfileTrimmed = if ($env:USERPROFILE) { $env:USERPROFILE.TrimEnd('\', '/') } else { '' }
if (($HomeTrimmed -and $ResolvedTrimmed -ieq $HomeTrimmed) -or
    ($UserProfileTrimmed -and $ResolvedTrimmed -ieq $UserProfileTrimmed)) {
  Write-Host "Refusing to delete: $Resolved is your home directory."
  exit 1
}

# Require at least 1 path segment below the drive root (defends against C:\, D:\, etc.).
$RelativeFromRoot = if ($Root) { $Resolved.Substring($Root.Length).TrimStart('\', '/') } else { $Resolved }
$Segments = ($RelativeFromRoot -split '[\\/]' | Where-Object { $_ -ne '' })
if ($Segments.Count -lt 1) {
  Write-Host "Refusing to delete: $Resolved is too shallow."
  exit 1
}

Write-Host "Dema uninstall will delete $Resolved and all of its contents:"
Write-Host "  receipts/ memory/ logs/ skills/ profile.json config.local.json"
Write-Host ""
Write-Host "This deletes local Dema state on this machine. It is irreversible."
Write-Host ""
Write-Host "Type the exact phrase to confirm (case-sensitive):"
Write-Host "  $ExpectedPhrase"
Write-Host ""
$Confirmation = Read-Host "> "

if ($Confirmation -ceq $ExpectedPhrase) {
  Remove-Item -Recurse -Force -LiteralPath $Resolved
  Write-Host ""
  Write-Host "Deleted: $Resolved"
  Write-Host "Done. Local Dema state removed from this machine."
} else {
  Write-Host ""
  Write-Host "Phrase did not match. Nothing was deleted."
  exit 1
}
