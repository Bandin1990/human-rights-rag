$ErrorActionPreference = "Stop"

$Script = Join-Path $PSScriptRoot "start_ollama.js"
node $Script
