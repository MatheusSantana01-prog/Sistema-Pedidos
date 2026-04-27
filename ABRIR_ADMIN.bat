@echo off
echo ========================================
echo  Sabor e Fogo — Abrindo painel Admin
echo ========================================
echo.
echo Iniciando servidor local na porta 3000...
echo Nao feche esta janela enquanto usar o sistema.
echo.
start "" "http://localhost:3000/frontend/admin/index.html"
cd /d "%~dp0"
python -m http.server 3000
pause
