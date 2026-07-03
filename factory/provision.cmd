@echo off
setlocal
cd /d "%~dp0.."
python factory\provision.py %*
