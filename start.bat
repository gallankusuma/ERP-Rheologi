@echo off
:: ERP Manufacturing System - Quick Start (Windows Batch)
:: Last Updated: February 4, 2026

echo.
echo ========================================
echo   ERP Manufacturing System
echo   Quick Start Script
echo ========================================
echo.

:: Run PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"

pause
