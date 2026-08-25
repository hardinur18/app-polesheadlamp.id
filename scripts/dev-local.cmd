@echo off
setlocal

set "NODE20=%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS.20_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v20.20.2-win-x64\node.exe"
set "VITE_BIN=%~dp0..\node_modules\vite\bin\vite.js"

if exist "%NODE20%" (
  "%NODE20%" "%VITE_BIN%" --host 127.0.0.1 --port 5174 --strictPort --clearScreen false %*
) else (
  node "%VITE_BIN%" --host 127.0.0.1 --port 5174 --strictPort --clearScreen false %*
)
