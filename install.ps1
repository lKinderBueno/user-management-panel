$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($scriptDir -and (Test-Path (Join-Path $scriptDir "setup.ps1"))) {
    & (Join-Path $scriptDir "setup.ps1") @args
} else {
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
    $script = (Invoke-WebRequest -Uri "https://ump.playlistlabs.io/setup.ps1" -UseBasicParsing).Content
    Invoke-Expression "& { $script } $($args -join ' ')"
}
