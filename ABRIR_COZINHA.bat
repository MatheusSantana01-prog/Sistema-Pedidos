@echo off
echo ========================================
echo  Sabor e Fogo — Abrindo tela Cozinha (TV)
echo ========================================
echo.
echo Iniciando servidor local na porta 3001...
start "" "http://localhost:3001/frontend/cozinha/index.html"
cd /d "%~dp0"
python -m http.server 3001
pause
