@echo off
title Bitkub API Dashboard Launcher
echo ==============================================
echo  Bitkub API Dashboard UI Launcher
echo ==============================================
echo.
echo [1/2] Opening dashboard in browser...
start http://127.0.0.1:8000

echo [2/2] Starting local Python server backend (FastAPI)...

:: Check if Python exists in Laragon directory
if exist "C:\laragon\bin\python\python-3.13\python.exe" (
    "C:\laragon\bin\python\python-3.13\python.exe" backend.py
    goto end
)

:: Check if another Laragon Python version exists (using wildcard/search)
for /d %%d in (C:\laragon\bin\python\python-*) do (
    if exist "%%d\python.exe" (
        "%%d\python.exe" backend.py
        goto end
    )
)

:: Check if python is available in PATH
where python >nul 2>nul
if %errorlevel% equ 0 (
    python backend.py
    goto end
)

echo [ERROR] Python was not found on your system!
echo Please install Python, add it to your System PATH, or start Laragon first.

:end
echo.
echo Server stopped.
pause
