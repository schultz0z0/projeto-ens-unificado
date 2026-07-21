param(
  [Parameter(Mandatory = $true)]
  [string]$RootEnv,
  [string]$SourcePictureEnv = ""
)

$ErrorActionPreference = "Stop"
$resolvedRootEnv = (Resolve-Path -LiteralPath $RootEnv).Path

function Read-DotEnvMap([string[]]$Lines) {
  $result = @{}
  foreach ($line in $Lines) {
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $result[$matches[1]] = $matches[2]
    }
  }
  return $result
}

function New-StrongSecret {
  $bytes = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$original = [IO.File]::ReadAllLines($resolvedRootEnv)
$current = Read-DotEnvMap $original
$source = @{}
if ($SourcePictureEnv) {
  $resolvedSource = (Resolve-Path -LiteralPath $SourcePictureEnv).Path
  $source = Read-DotEnvMap ([IO.File]::ReadAllLines($resolvedSource))
}

$falKey = [string]$current['NEXUS_PICTURE_FAL_KEY']
if (-not $falKey) { $falKey = [string]$source['FAL_KEY'] }
if (-not $falKey) { throw 'NEXUS_PICTURE_FAL_KEY/FAL_KEY real não encontrado.' }

$internalKey = [string]$current['NEXUS_PICTURE_INTERNAL_KEY']
if ($internalKey.Length -lt 32 -or $internalKey -match 'CHANGE_ME|PLACEHOLDER|EXAMPLE') {
  $internalKey = New-StrongSecret
}
$delegationKey = [string]$current['NEXUS_PICTURE_DELEGATION_ACTIVE_KEY']
if ($delegationKey.Length -lt 32 -or $delegationKey -match 'CHANGE_ME|PLACEHOLDER|EXAMPLE') {
  $delegationKey = New-StrongSecret
}

$filtered = New-Object Collections.Generic.List[string]
$insideManagedBlock = $false
foreach ($line in $original) {
  if ($line -eq '# BEGIN PICTURE-HERMES MANAGED') { $insideManagedBlock = $true; continue }
  if ($line -eq '# END PICTURE-HERMES MANAGED') { $insideManagedBlock = $false; continue }
  if ($insideManagedBlock) { continue }
  if ($line -match '^(?:NEXUS_DESIGNER_|NEXUS_PUBLIC_DESIGNER_|VITE_IMAGE_GENERATOR_API_URL=|VITE_API_BASE_URL=|NEXT_PUBLIC_API_BASE_URL=)') { continue }
  if ($line -match '^NEXUS_PUBLIC_CHAT_STREAM_FILE_HOSTS=(.*)$') {
    $hosts = $matches[1].Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notmatch 'designer' }
    $filtered.Add("NEXUS_PUBLIC_CHAT_STREAM_FILE_HOSTS=$($hosts -join ',')")
    continue
  }
  $filtered.Add($line)
}

$filtered.Add('')
$filtered.Add('# BEGIN PICTURE-HERMES MANAGED')
$filtered.Add('# Serviço interno: o browser acessa somente o Bridge autenticado.')
$filtered.Add('NEXUS_PICTURE_INTERNAL_URL=http://picture-it:8090')
$filtered.Add("NEXUS_PICTURE_INTERNAL_KEY=$internalKey")
$filtered.Add("NEXUS_PICTURE_FAL_KEY=$falKey")
$filtered.Add('NEXUS_PICTURE_MCP_URL=http://picture-it:8090/mcp')
$filtered.Add('NEXUS_PICTURE_MCP_TIMEOUT=300')
$filtered.Add('NEXUS_PICTURE_MCP_CONNECT_TIMEOUT=20')
$filtered.Add('NEXUS_PICTURE_DELEGATION_ACTIVE_KID=v1')
$filtered.Add("NEXUS_PICTURE_DELEGATION_ACTIVE_KEY=$delegationKey")
$filtered.Add('NEXUS_PICTURE_DELEGATION_PREVIOUS_KID=')
$filtered.Add('NEXUS_PICTURE_DELEGATION_PREVIOUS_KEY=')
$filtered.Add('NEXUS_PICTURE_DELEGATION_TTL_SECONDS=90')
$filtered.Add('NEXUS_PICTURE_DELEGATION_MAX_TTL_SECONDS=120')
$filtered.Add('NEXUS_PICTURE_ARTIFACT_TIMEOUT_MS=30000')
$filtered.Add('NEXUS_PICTURE_WORKER_CONCURRENCY=1')
$filtered.Add('NEXUS_PICTURE_WORKER_LEASE_SECONDS=120')
$filtered.Add('NEXUS_PICTURE_WORKER_MAX_ATTEMPTS=3')
$filtered.Add('NEXUS_PICTURE_WORKER_HEARTBEAT_MS=30000')
$filtered.Add('NEXUS_PICTURE_WORKER_POLL_MS=1000')
$filtered.Add('NEXUS_PICTURE_TEMP_MAX_BYTES=1073741824')
$filtered.Add('# END PICTURE-HERMES MANAGED')

$temporary = "$resolvedRootEnv.picture.tmp"
[IO.File]::WriteAllLines($temporary, $filtered, [Text.UTF8Encoding]::new($false))
Move-Item -LiteralPath $temporary -Destination $resolvedRootEnv -Force
Write-Output 'Picture-Hermes env sincronizado; valores secretos não foram exibidos.'
