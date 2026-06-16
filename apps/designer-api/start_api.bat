@echo off
REM ============================================================
REM  start_api.bat — Inicia a API do ENS AI Banner Factory
REM  Uso: clique duplo ou rode no CMD na raiz do projeto
REM ============================================================

echo.
echo  ===========================================
echo   ENS AI Banner Factory — API Start Script
echo  ===========================================
echo.

REM Verificar se .env existe
IF NOT EXIST .env (
    echo [ERRO] Arquivo .env nao encontrado!
    echo Copie .env.example para .env e preencha as credenciais.
    pause
    exit /b 1
)

IF NOT EXIST .venv\Scripts\python.exe (
    echo [ERRO] Ambiente virtual .venv nao encontrado!
    echo Execute: py -m venv .venv
    echo Depois: .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    pause
    exit /b 1
)

echo [INFO] Ativando ambiente virtual...
call .venv\Scripts\activate.bat

REM Iniciar API com uvicorn
echo [INFO] Iniciando API na porta 8000...
echo [INFO] Swagger UI: http://localhost:8000/docs
echo [INFO] Pressione Ctrl+C para parar.
echo.

.venv\Scripts\python.exe -m uvicorn api.app:app --host 0.0.0.0 --port 8000 --reload

pause
