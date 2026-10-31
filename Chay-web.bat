@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   TRON DE KIEM TRA - dang khoi dong web...
echo   Dia chi: http://localhost:8080/index.html
echo   (Dong cua so nay de tat web)
echo ============================================
where python >nul 2>nul && (start "" http://localhost:8080/index.html & python -m http.server 8080 --bind 127.0.0.1 & goto :eof)
where py >nul 2>nul && (start "" http://localhost:8080/index.html & py -m http.server 8080 --bind 127.0.0.1 & goto :eof)
where npx >nul 2>nul && (start "" http://localhost:8080/index.html & npx --yes http-server -p 8080 -a 127.0.0.1 & goto :eof)
echo.
echo Khong tim thay Python hoac Node.js tren may.
echo Ban van co the mo truc tiep tep index.html bang Chrome hoac Edge.
echo Xem huong dan trong HUONG-DAN.md.
pause
