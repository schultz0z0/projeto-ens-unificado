@echo off
REM ============================================================
REM  start_tunnel.bat — Expõe a API via Cloudflare Tunnel (grátis)
REM  Pré-requisito: cloudflared instalado (veja directives/)
REM  Uso: rode DEPOIS de start_api.bat, em outro CMD
REM ============================================================

echo.
echo  ===========================================
echo   ENS AI Banner Factory — Cloudflare Tunnel
echo  ===========================================
echo.

REM Tentar encontrar no PATH primeiro
where cloudflared >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo [INFO] cloudflared encontrado no PATH.
    echo [INFO] Iniciando tunnel para http://localhost:8000 ...
    echo [INFO] Aguarde a URL publica aparecer abaixo (trycloudflare.com)
    cloudflared tunnel --url http://localhost:8000
    goto :eof
)

REM Fallback para o caminho do WinGet
IF EXIST "C:\Users\raphaeloliveira\AppData\Local\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe" (
    echo [INFO] cloudflared encontrado no caminho do WinGet.
    echo [INFO] Iniciando tunnel para http://localhost:8000 ...
    echo [INFO] Aguarde a URL publica aparecer abaixo (trycloudflare.com)
    "C:\Users\raphaeloliveira\AppData\Local\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe" tunnel --url http://localhost:8000
    goto :eof
)

echo [ERRO] cloudflared nao encontrado no PATH nem no caminho padrao do WinGet.
echo.
echo Para instalar, execute no PowerShell como Administrador:
echo   winget install Cloudflare.cloudflared
echo.
echo Ou baixe em: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
pause
exit /b 1
