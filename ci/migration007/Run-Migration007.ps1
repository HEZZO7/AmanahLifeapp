param(
    [ValidateSet('All', 'PGlite', 'Native')]
    [string]$Profile = 'All'
)
$ErrorActionPreference = 'Stop'
$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$ReportRoot = Join-Path ([IO.Path]::GetTempPath()) ('amanah007-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $ReportRoot | Out-Null
Push-Location $SourceRoot
try {
    & node ci/migration007/run.mjs verify $ReportRoot
    if ($LASTEXITCODE -ne 0) { throw 'Source/version verification failed.' }
    $Failures = 0
    if ($Profile -eq 'All' -or $Profile -eq 'PGlite') {
        & node ci/migration007/install.mjs $ReportRoot
        if ($LASTEXITCODE -ne 0) { $Failures++ }
        else {
            & node ci/migration007/run.mjs pglite $ReportRoot
            if ($LASTEXITCODE -ne 0) { $Failures++ }
        }
    }
    if ($Profile -eq 'All' -or $Profile -eq 'Native') {
        & node ci/migration007/run.mjs native $ReportRoot
        if ($LASTEXITCODE -ne 0) { $Failures++ }
    }
    if ($Failures -ne 0) { throw 'FAIL/BLOCKED: one or more profiles failed; inspect sanitized reports.' }
    Write-Host 'Requested profiles completed successfully. This does not authorize production.'
} finally {
    Pop-Location
    Write-Host ('Sanitized reports: ' + $ReportRoot)
}
