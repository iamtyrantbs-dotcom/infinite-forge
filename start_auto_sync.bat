@echo off
title Infinite Forge - Auto Git Sync Watcher
chcp 65001 > nul
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0auto_git_watcher.ps1"
pause
