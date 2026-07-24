@echo off
cd /d "%~dp0"
echo Starting OBLAKO...
start "OBLAKO server" cmd /k "npm start"
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"
start "" "http://localhost:3000/admin.html"
echo.
echo Menu:  http://localhost:3000
echo Admin: http://localhost:3000/admin.html
echo Login: hmeeti / 2289073
echo.
pause
