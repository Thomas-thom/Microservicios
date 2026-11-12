@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==================================================================
echo    INICIANDO 4 VENTANAS DE CMD - SUSTENTACION MICROSERVICIOS GO
echo ==================================================================
echo Directorio de trabajo: %CD%
echo.
echo [CMD 1/4] Servicio General de Facturacion + Interfaz Web (Puertos 8084 / 8080)
echo [CMD 2/4] Servicio de Autenticacion (Puerto 8081)
echo [CMD 3/4] Servicio de Productos (Puerto 8082)
echo [CMD 4/4] Servicio de Clientes (Puerto 8083)
echo.

start "[CMD 1/4] Servicio General de Facturacion (Puerto 8084)" cmd /k "chcp 65001 >nul && title [CMD 1/4] Servicio General de Facturacion (Puerto 8084) && echo === VENTANA CMD 1: SERVICIO GENERAL DE FACTURACION (8084) + WEB (8080) === && echo Para detener este servicio presiona Ctrl+C && echo. && go run ./services/facturacion"
start "[CMD 2/4] Servicio de Autenticacion (Puerto 8081)" cmd /k "chcp 65001 >nul && title [CMD 2/4] Servicio de Autenticacion (Puerto 8081) && echo === VENTANA CMD 2: MICROSERVICIO DE AUTENTICACION (8081) === && echo Archivo JSON: data/usuarios.json && echo Para matar/detener este servicio presiona Ctrl+C && echo. && go run ./services/auth"
start "[CMD 3/4] Servicio de Productos (Puerto 8082)" cmd /k "chcp 65001 >nul && title [CMD 3/4] Servicio de Productos (Puerto 8082) && echo === VENTANA CMD 3: MICROSERVICIO DE PRODUCTOS (8082) === && echo Archivo JSON: data/productos.json && echo Para matar/detener este servicio presiona Ctrl+C && echo. && go run ./services/productos"
start "[CMD 4/4] Servicio de Clientes (Puerto 8083)" cmd /k "chcp 65001 >nul && title [CMD 4/4] Servicio de Clientes (Puerto 8083) && echo === VENTANA CMD 4: MICROSERVICIO DE CLIENTES (8083) === && echo Archivo JSON: data/clientes.json && echo Para matar/detener este servicio presiona Ctrl+C && echo. && go run ./services/clientes"

echo Las 4 ventanas de CMD han sido lanzadas exitosamente.
echo Interfaz Web disponible en: http://localhost:8080  (o http://localhost:8084)
echo.
pause

