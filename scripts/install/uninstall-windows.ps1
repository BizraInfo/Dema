$DemaHome = if ($env:DEMA_HOME) { $env:DEMA_HOME } else { Join-Path $HOME ".dema" }
$ExpectedPhrase = "REMOVE DEMA LOCAL DATA"

if (-not (Test-Path $DemaHome)) {
  Write-Host "Nothing to uninstall: $DemaHome does not exist."
  exit 0
}

Write-Host "Dema uninstall will delete $DemaHome and all of its contents:"
Write-Host "  receipts/ memory/ logs/ skills/ profile.json config.local.json"
Write-Host ""
Write-Host "This deletes local Dema state on this machine. It is irreversible."
Write-Host ""
Write-Host "Type the exact phrase to confirm (case-sensitive):"
Write-Host "  $ExpectedPhrase"
Write-Host ""
$Confirmation = Read-Host "> "

if ($Confirmation -ceq $ExpectedPhrase) {
  Remove-Item -Recurse -Force $DemaHome
  Write-Host ""
  Write-Host "Deleted: $DemaHome"
  Write-Host "Done. Local Dema state removed from this machine."
} else {
  Write-Host ""
  Write-Host "Phrase did not match. Nothing was deleted."
  exit 1
}
