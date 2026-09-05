param(
  [string]$OutDir = "dist"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$buildScript = Join-Path $root "build.mjs"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js krävs för att bygga projektet."
}

& node $buildScript $OutDir
if ($LASTEXITCODE -ne 0) {
  throw "Bygget misslyckades med exitkod $LASTEXITCODE."
}
