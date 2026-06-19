# Launches the backend (FastAPI) and frontend (static) servers in two windows.
# Usage:  right-click -> Run with PowerShell   OR   ./start.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "Starting backend on http://127.0.0.1:8000 ..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList @(
  "-NoExit","-Command",
  "cd '$root\backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
)

Write-Host "Starting frontend on http://127.0.0.1:5500 ..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList @(
  "-NoExit","-Command",
  "cd '$root\frontend'; python -m http.server 5500 --bind 127.0.0.1"
)

Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:5500"
Write-Host "Opened http://127.0.0.1:5500  (login: 9999999999 / admin123)" -ForegroundColor Green
