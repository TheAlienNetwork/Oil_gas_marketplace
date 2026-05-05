# Register (or replace) the Stripe webhook for supabase/functions/stripe-webhook.
#
# Prerequisites: curl.exe (Windows 10+), Stripe secret key (test or live).
# Key source order: $env:STRIPE_SECRET_KEY, then repo .env STRIPE_SECRET_KEY=sk_...
#
# Examples (repo root):
#   .\scripts\register-stripe-webhook.ps1 -ProjectRef vqdvfxfzhsbhmfumvncy -ReplaceExisting -SyncSupabase
#
param(
  [string] $ProjectRef = "",
  [string] $WebhookUrl = "",
  [switch] $ReplaceExisting,
  [switch] $SyncSupabase
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Get-DotEnvValue {
  param([string] $Path, [string] $Key)
  if (-not (Test-Path $Path)) { return $null }
  foreach ($line in Get-Content -Path $Path) {
    $t = $line.Trim()
    if ($t.StartsWith("#") -or -not $t) { continue }
    if ($t -match "^${Key}=(.*)$") {
      $v = $matches[1].Trim().Trim('"').Trim("'")
      if ($v) { return $v }
    }
  }
  return $null
}

function Invoke-StripeCurlJson {
  param(
    [string] $Method,
    [string] $Path,
    [string] $Key,
    [string[]] $FormArgs = @()
  )
  $base = "https://api.stripe.com"
  $url = if ($Path.StartsWith("http")) { $Path } else { "$base$Path" }
  $curlArgs = @("-sS", "-X", $Method, "-u", "${Key}:", $url) + $FormArgs
  $raw = & curl.exe @curlArgs
  if ($LASTEXITCODE -ne 0) {
    throw "curl failed (exit $LASTEXITCODE)"
  }
  try {
    return ($raw | ConvertFrom-Json)
  } catch {
    throw "Stripe did not return JSON. Raw:`n$raw"
  }
}

$key = $env:STRIPE_SECRET_KEY
if (-not $key) {
  $key = Get-DotEnvValue -Path (Join-Path $RepoRoot ".env") -Key "STRIPE_SECRET_KEY"
}
if (-not $key -or $key -notmatch "^sk_(test|live)_") {
  # Single-quoted here-string: "STRIPE_SECRET_KEY" must not be parsed as STRIPE_SECRET_ + $KEY.
  Write-Error @'
Set STRIPE_SECRET_KEY before running:
  - PowerShell: $env:STRIPE_SECRET_KEY = 'sk_test_...'
  - Or add to .env (local only): STRIPE_SECRET_KEY=sk_test_...
'@
  exit 1
}

if (-not $WebhookUrl) {
  if (-not $ProjectRef) {
    Write-Error "Pass -ProjectRef <supabase-project-ref> or -WebhookUrl <full URL>."
    exit 1
  }
  $WebhookUrl = "https://$ProjectRef.supabase.co/functions/v1/stripe-webhook"
}

Write-Host "Target webhook URL: $WebhookUrl" -ForegroundColor Cyan
Write-Host "Stripe mode: $(if ($key -match '^sk_live_') { 'LIVE' } else { 'TEST' })" -ForegroundColor Cyan

if ($ReplaceExisting) {
  $list = Invoke-StripeCurlJson -Method "GET" -Path "/v1/webhook_endpoints" -Key $key
  foreach ($ep in $list.data) {
    if ($ep.url -eq $WebhookUrl) {
      Write-Host "Deleting existing endpoint $($ep.id) (same URL)..." -ForegroundColor Yellow
      $null = Invoke-StripeCurlJson -Method "DELETE" -Path "/v1/webhook_endpoints/$($ep.id)" -Key $key
    }
  }
}

Write-Host "Creating webhook endpoint..." -ForegroundColor Cyan
$form = @(
  "-d", "url=$WebhookUrl",
  "-d", "description=The Patch - Supabase stripe-webhook",
  "-d", "enabled_events[]=checkout.session.completed",
  "-d", "enabled_events[]=account.updated"
)
$created = Invoke-StripeCurlJson -Method "POST" -Path "/v1/webhook_endpoints" -Key $key -FormArgs $form

if ($created.error) {
  Write-Error "Stripe API error: $($created.error.message)"
  exit 1
}

$whsec = [string]$created.secret
Write-Host ""
Write-Host "OK - webhook id: $($created.id)" -ForegroundColor Green
Write-Host "Signing secret:" -ForegroundColor Yellow
Write-Host $whsec
Write-Host ""

if ($SyncSupabase) {
  if (-not $ProjectRef) {
    Write-Error "-SyncSupabase requires -ProjectRef."
    exit 1
  }
  Write-Host "Setting STRIPE_WEBHOOK_SECRET in Supabase (project $ProjectRef)..." -ForegroundColor Cyan
  & npx supabase secrets set "STRIPE_WEBHOOK_SECRET=$whsec" --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
  Write-Host "Supabase STRIPE_WEBHOOK_SECRET updated." -ForegroundColor Green
}

Write-Host ""
Write-Host "Next steps:"
# Use single-quoted Write-Host so STRIPE_SECRET_KEY is not parsed as STRIPE_SECRET_ + $KEY.
Write-Host '  1) Ensure Supabase Edge secrets include STRIPE_SECRET_KEY (same Stripe mode as this webhook) and FRONTEND_URL.'
Write-Host ('  2) Redeploy: npx supabase functions deploy stripe-webhook create-checkout stripe-connect-onboard generate-download-url --project-ref ' + $ProjectRef + ' --use-api')
