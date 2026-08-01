$ErrorActionPreference = "Stop"

$Script = Join-Path $PSScriptRoot "start_app_visible.vbs"
wscript.exe $Script
