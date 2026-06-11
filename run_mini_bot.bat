@echo off
title Bitkub Mini Bot Launcher
echo ===================================================
echo   Bitkub Mini Bot Launcher (Via Python)
echo ===================================================
echo.
echo [1/2] Verifying Python dependencies...
python -m pip install -r requirements.txt >nul 2>nul
python -m pip install pywebview >nul 2>nul

echo [2/2] Starting Bitkub Mini Bot Desktop App...
python gui.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start Python script!
    echo Please make sure Python is installed and added to your system PATH.
    pause
)
