@echo off
echo ========================================
echo  Sabor e Fogo — Iniciando Backend (API)
echo ========================================
echo.
cd /d "%~dp0backend"
if not exist ".env" (
    echo ERRO: Arquivo .env nao encontrado!
    echo Copie .env.exemplo para .env e preencha a SERVICE_ROLE_KEY
    pause
    exit /b 1
)
pip install -r requisitos.txt --quiet
echo.
echo Servidor iniciando em http://localhost:8000
echo Documentacao: http://localhost:8000/docs
echo.
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
