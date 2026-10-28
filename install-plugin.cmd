@echo off
setlocal
call "%~dp0scripts\setup-runtime.cmd"
if errorlevel 1 exit /b 1
set "REVERSI_CODEX="
for /f "delims=" %%I in ('where.exe codex 2^>nul') do if not defined REVERSI_CODEX set "REVERSI_CODEX=%%I"
if not defined REVERSI_CODEX if exist "%USERPROFILE%\.codex\plugins\.plugin-appserver\codex.exe" set "REVERSI_CODEX=%USERPROFILE%\.codex\plugins\.plugin-appserver\codex.exe"
if not defined REVERSI_CODEX (
  echo The official local Codex CLI was not found. Open START-HERE-ja.md.
  exit /b 2
)
call "%REVERSI_CODEX%" plugin marketplace add "%~dp0."
if errorlevel 1 exit /b 1
call "%REVERSI_CODEX%" plugin add gpt-reversi-local@gpt-game-local-validation
if errorlevel 1 exit /b 1
echo Installed. Open a new LOCAL chat in the supported desktop app.
echo If the tools do not appear, restart the desktop app after saving your work.
