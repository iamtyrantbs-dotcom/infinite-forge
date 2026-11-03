@echo off
chcp 65001 > nul
powershell -ExecutionPolicy Bypass -File "%~dp0github_deploy.ps1"
pause
