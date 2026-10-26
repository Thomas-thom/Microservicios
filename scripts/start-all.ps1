# Script de PowerShell para iniciar todos los microservicios
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "      INICIANDO MICROSERVICIOS DE FACTURACIÓN DIGITAL (Go)       " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "go run ./services/auth"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "go run ./services/productos"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "go run ./services/clientes"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "go run ./services/facturacion"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "go run ./services/frontend"

Write-Host "`nTodos los servicios están iniciándose." -ForegroundColor Yellow
Write-Host "Ingresa a la aplicación en: http://localhost:8080`n" -ForegroundColor Green
