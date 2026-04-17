@echo off
echo ================================================
echo  Sistema de Pedidos - Sabor e Fogo
echo  Script de instalacao automatica
echo ================================================
echo.

REM Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Python nao encontrado.
    echo Instale Python 3.11 ou 3.12 em python.org
    pause
    exit /b 1
)

echo [1/3] Instalando dependencias Python...
cd /d "%~dp0backend"
pip install -r requirements.txt
if errorlevel 1 (
    echo Tentando com --break-system-packages...
    pip install -r requirements.txt --break-system-packages
)

echo.
echo [2/3] Verificando configuracao...
if not exist backend\.env (
    echo AVISO: Arquivo .env nao encontrado.
    echo Copie backend\.env.example para backend\.env e preencha a SERVICE_ROLE_KEY
) else (
    findstr "COLE_SUA_SERVICE_ROLE_KEY" backend\.env >nul
    if not errorlevel 1 (
        echo.
        echo *** ATENCAO ***
        echo Voce precisa preencher a SUPABASE_SERVICE_KEY no arquivo backend\.env
        echo Acesse: https://app.supabase.com/project/lhrfemeunswviwzdpppp/settings/api
        echo Copie a "service_role" key e cole no .env
        echo.
    )
)

echo.
echo [3/3] Instalacao concluida!
echo.
echo Para iniciar o servidor:
echo   cd backend
echo   uvicorn main:app --reload --host 0.0.0.0 --port 8000
echo.
echo Arquivos do sistema:
echo   frontend\cliente.html   - Cardapio (hospedar online)
echo   frontend\cozinha.html   - TV da cozinha (abrir no Chrome)
echo   frontend\admin.html     - Painel admin (abrir no Chrome)
echo.
pause
