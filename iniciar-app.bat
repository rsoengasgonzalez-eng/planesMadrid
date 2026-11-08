@echo off
setlocal
cd /d "%~dp0"
echo.
echo  Iniciando "Que plan hacemos" en http://127.0.0.1:8080
echo  Mantén esta ventana abierta mientras uses la app.
echo  Para detenerla, pulsa Ctrl+C.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor-local.ps1" -Port 8080
if errorlevel 1 (
  echo.
  echo No se pudo iniciar el servidor. Prueba a ejecutar PowerShell como usuario normal
  echo o consulta README.md.
  pause
)
