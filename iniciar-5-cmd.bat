@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==================================================================
echo       INICIANDO 5 VENTANAS DE CMD - MICROSERVICIOS EN GO
echo ==================================================================
echo Directorio de trabajo: %CD%
echo.

start "[CMD 1/5] Auth Service (Puerto 8081)" cmd /k "chcp 65001 >nul && title [CMD 1/5] Auth Service (Puerto 8081) && echo === VENTANA CMD 1: MICROSERVICIO DE AUTENTICACION (8081) === && go run ./services/auth"
start "[CMD 2/5] Productos Service (Puerto 8082)" cmd /k "chcp 65001 >nul && title [CMD 2/5] Productos Service (Puerto 8082) && echo === VENTANA CMD 2: MICROSERVICIO DE PRODUCTOS (8082) === && go run ./services/productos"
start "[CMD 3/5] Clientes Service (Puerto 8083)" cmd /k "chcp 65001 >nul && title [CMD 3/5] Clientes Service (Puerto 8083) && echo === VENTANA CMD 3: MICROSERVICIO DE CLIENTES (8083) === && go run ./services/clientes"
start "[CMD 4/5] Facturacion Service (Puerto 8084)" cmd /k "chcp 65001 >nul && title [CMD 4/5] Facturacion Service (Puerto 8084) && echo === VENTANA CMD 4: MICROSERVICIO DE FACTURACION (8084) === && go run ./services/facturacion"
start "[CMD 5/5] Frontend Web (Puerto 8080)" cmd /k "chcp 65001 >nul && title [CMD 5/5] Frontend Web (Puerto 8080) && echo === VENTANA CMD 5: SERVIDOR FRONTEND WEB (8080) === && go run ./services/frontend"

echo Todos los 5 servicios han sido lanzados en 5 ventanas de CMD independientes.
echo Accede a la interfaz web en: http://localhost:8080
echo.
pause

