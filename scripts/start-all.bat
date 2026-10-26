@echo off
chcp 65001 >nul
echo ==================================================================
echo       INICIANDO MICROSERVICIOS DE FACTURACIÓN DIGITAL (Go)
echo ==================================================================

start "Microservicio Auth (8081)" cmd /k "go run ./services/auth"
start "Microservicio Productos (8082)" cmd /k "go run ./services/productos"
start "Microservicio Clientes (8083)" cmd /k "go run ./services/clientes"
start "Microservicio Facturacion (8084)" cmd /k "go run ./services/facturacion"
start "Servidor Frontend Web (8080)" cmd /k "go run ./services/frontend"

echo.
echo Todos los microservicios han sido lanzados en terminales separadas.
echo Accede a la aplicación en: http://localhost:8080
echo.
pause
