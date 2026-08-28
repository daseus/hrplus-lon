param(
  [string]$OutDir = "dist"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceIndex = Join-Path $root "index.html"
$sourceVendor = Join-Path $root "vendor\xlsx.full.min.js"
$sourceNoticeFile = Join-Path $root "source-notice.html"
$dist = Join-Path $root $OutDir

$rootFull = [System.IO.Path]::GetFullPath($root)
$distFull = [System.IO.Path]::GetFullPath($dist)

if (-not $distFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Output directory must be inside the project folder."
}

if (-not (Test-Path -LiteralPath $sourceIndex)) {
  throw "Missing index.html."
}

if (-not (Test-Path -LiteralPath $sourceVendor)) {
  throw "Missing vendor/xlsx.full.min.js."
}

$utf8 = New-Object System.Text.UTF8Encoding($false)

function Get-ShortHash([string]$Text) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = $utf8.GetBytes($Text)
    $hash = $sha.ComputeHash($bytes)
    return (($hash | ForEach-Object { $_.ToString("x2") }) -join "").Substring(0, 12)
  } finally {
    $sha.Dispose()
  }
}

if (Test-Path -LiteralPath $distFull) {
  Remove-Item -LiteralPath $distFull -Recurse -Force
}

New-Item -ItemType Directory -Path (Join-Path $distFull "vendor") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $distFull "assets") | Out-Null

$sourceNotice = if (Test-Path -LiteralPath $sourceNoticeFile) {
  [System.IO.File]::ReadAllText($sourceNoticeFile, $utf8)
} else {
  "<!-- Lönefiler behandlas lokalt i webbläsaren och laddas inte upp. -->"
}

$html = [System.IO.File]::ReadAllText($sourceIndex, $utf8)
$html = $html -replace "(?i)^<!doctype html>", "<!doctype html>`r`n$sourceNotice"

$vendorContent = [System.IO.File]::ReadAllText($sourceVendor, $utf8)
$vendorVersion = Get-ShortHash $vendorContent
$html = $html -replace 'src="vendor/xlsx\.full\.min\.js(?:\?v=[^"]*)?"', "src=`"vendor/xlsx.full.min.js?v=$vendorVersion`""

$styleMatch = [regex]::Match($html, "(?s)<style>\s*(?<css>.*?)\s*</style>")
if ($styleMatch.Success) {
  $css = $styleMatch.Groups["css"].Value.Trim()
  $cssVersion = Get-ShortHash $css
  [System.IO.File]::WriteAllText((Join-Path $distFull "assets\app.css"), $css, $utf8)
  $html = $html.Remove($styleMatch.Index, $styleMatch.Length).Insert($styleMatch.Index, "<link rel=`"stylesheet`" href=`"assets/app.css?v=$cssVersion`">")
}

$scriptMatch = [regex]::Match($html, "(?s)<script>\s*(?<js>const APP_INFO[\s\S]*?)\s*</script>")
if (-not $scriptMatch.Success) {
  throw "Could not find the application script in index.html."
}

$js = $scriptMatch.Groups["js"].Value.Trim()
$jsVersion = Get-ShortHash $js
$appVersionMatch = [regex]::Match($js, 'version:\s*"(?<version>[^"]+)"')
if (-not $appVersionMatch.Success) {
  throw "Could not find APP_INFO.version in index.html."
}
$appVersion = $appVersionMatch.Groups["version"].Value
[System.IO.File]::WriteAllText((Join-Path $distFull "assets\app.js"), $js, $utf8)
$html = $html.Remove($scriptMatch.Index, $scriptMatch.Length).Insert($scriptMatch.Index, "<script src=`"assets/app.js?v=$jsVersion`"></script>")

$html = $html -replace "(\r?\n){3,}", "`r`n`r`n"

[System.IO.File]::WriteAllText((Join-Path $distFull "index.html"), $html, $utf8)
Copy-Item -LiteralPath $sourceVendor -Destination (Join-Path $distFull "vendor\xlsx.full.min.js") -Force

$release = [ordered]@{
  version = $appVersion
  build = $jsVersion
}
$releaseJson = $release | ConvertTo-Json
[System.IO.File]::WriteAllText((Join-Path $distFull "version.json"), $releaseJson, $utf8)

 $headers = @"
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'

/
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

/index.html
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

/version.json
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/vendor/*
  Cache-Control: public, max-age=31536000, immutable
"@

[System.IO.File]::WriteAllText((Join-Path $distFull "_headers"), $headers, $utf8)

Write-Host "Created $distFull"
Write-Host "Publish this folder in Cloudflare Pages: $OutDir"
