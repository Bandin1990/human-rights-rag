$ErrorActionPreference = "Stop"

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Please run this script from PowerShell opened as Administrator."
    Write-Host "Command:"
    Write-Host "  CheckNetIsolation LoopbackExempt -a -n=OpenAI.Codex_2p2nqsd0c76g0"
    exit 1
}

CheckNetIsolation LoopbackExempt -a -n=OpenAI.Codex_2p2nqsd0c76g0
CheckNetIsolation LoopbackExempt -s
