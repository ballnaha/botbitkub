@echo off
title Bitkub API Dashboard Launcher
echo ==============================================
echo  Bitkub API Dashboard UI Launcher
echo ==============================================
echo.
echo [1/3] Starting frontend (Next.js) on port 4011...
start "Bitkub Dashboard Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo [2/3] Opening dashboard in browser...
start http://127.0.0.1:4011

echo [3/3] Starting local Python server backend (FastAPI) on port 8282...

:: Check if Python exists in Laragon directory
if exist "C:\laragon\bin\python\python-3.13\python.exe" (
    start "Bitkub Dashboard Backend" cmd /k "cd /d %~dp0 && C:\laragon\bin\python\python-3.13\python.exe backend.py"
    goto end
)

:: Check if another Laragon Python version exists (using wildcard/search)
for /d %%d in (C:\laragon\bin\python\python-*) do (
    if exist "%%d\python.exe" (
        start "Bitkub Dashboard Backend" cmd /k "cd /d %~dp0 && ""%%d\python.exe"" backend.py"
        goto end
    )
)

:: Check if python is available in PATH
where python >nul 2>nul
if %errorlevel% equ 0 (
    start "Bitkub Dashboard Backend" cmd /k "cd /d %~dp0 && python backend.py"
    goto end
)

echo [ERROR] Python was not found on your system!
echo Please install Python, add it to your System PATH, or start Laragon first.

:end
echo.
echo Launcher finished. Keep the frontend and backend windows open while using the dashboard.
