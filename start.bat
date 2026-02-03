@echo off
REM 🎤 NeonPub Karaoke - Script di Avvio Facile (Windows)
REM Usa questo script per avviare tutto con un doppio click

echo 🎤 NeonPub Karaoke - Avvio Automatico
echo ======================================

REM Controlla se MongoDB è attivo
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo ⚠️  MongoDB non è attivo!
    echo Avvialo dai Servizi Windows o con: mongod
    pause
    exit /b 1
)

echo ✅ MongoDB attivo

REM Avvia Backend
echo.
echo 🐍 Avvio Backend...
cd backend
start "NeonPub Backend" cmd /k "venv\Scripts\activate && uvicorn server:app --host 0.0.0.0 --port 8001 --reload"

REM Aspetta che il backend si avvii
timeout /t 5 /nobreak > nul

REM Avvia Frontend
echo.
echo ⚛️  Avvio Frontend...
cd ..\frontend
start "NeonPub Frontend" cmd /k "npm start"

echo.
echo ✅ Applicazione avviata!
echo.
echo 📱 Il browser si aprirà automaticamente su http://localhost:3000
echo.
echo Per fermare: chiudi le finestre del terminale
echo.
pause
