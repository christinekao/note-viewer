@echo off
cd /d "%~dp0"
start cmd /k "npm run dev"
timeout /t 4 /nobreak
start http://localhost:5173
