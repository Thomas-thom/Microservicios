# Sistema de Facturación Digital Basado en Microservicios (Go)

Sistema de facturación digital desarrollado en **Go** y un cliente web en **JavaScript**, estructurado en microservicios independientes con persistencia en archivos **JSON**, conforme a los requerimientos del proyecto académico `Proyecto1ProgramacionAvanzada.pdf`.

---

## 1. Arquitectura y Puertos de los Servicios

El sistema se compone de 4 microservicios independientes en Go y un servidor para la interfaz web:

| Servicio | Puerto | Directorio | Archivo de Datos |
| :--- | :---: | :--- | :--- |
| **Servicio de Autenticación** | `8081` | `services/auth` | `data/usuarios.json` |
| **Servicio de Productos** | `8082` | `services/productos` | `data/productos.json` |
| **Servicio de Clientes** | `8083` | `services/clientes` | `data/clientes.json` |
| **Servicio de Facturación** | `8084` | `services/facturacion` | `data/facturas.json` |
| **Frontend Web** | `8080` | `services/frontend` | `frontend/` |

---

## 2. Requisitos Previos

- **Go:** Versión 1.20 o superior instalada (verificar con `go version`).
- **Navegador Web:** Chrome, Edge, Firefox o Safari (para la interfaz y exportación a PDF).

---

## 3. Credenciales de Prueba Iniciales

Los archivos de persistencia iniciales en la carpeta `data/` incluyen los siguientes usuarios precargados con contraseñas seguras cifradas con **bcrypt**:

| Nombre | Correo Electrónico | Contraseña | Rol |
| :--- | :--- | :--- | :--- |
| **Ricardo Gómez** | `ricardo@example.com` | `admin123` | `admin` |
| **María López** | `maria@example.com` | `cliente123` | `cliente` |

*También es posible crear nuevos usuarios desde el formulario de registro en la pantalla inicial.*

---

## 4. Cómo Iniciar los Servicios

### Opción 1: Runner Unificado en Go (Recomendado)
Ejecuta un solo comando desde la raíz del proyecto para iniciar todos los microservicios y el frontend concurrentemente:

```bash
go run scripts/runner/main.go
```

### Opción 2: Scripts de Windows
- En **CMD**:
  ```cmd
  scripts\start-all.bat
  ```
- En **PowerShell**:
  ```powershell
  .\scripts\start-all.ps1
  ```

### Opción 3: Terminales Independientes
Si prefieres iniciar cada microservicio manualmente en una terminal distinta:

```bash
# Terminal 1: Autenticación
go run ./services/auth

# Terminal 2: Productos
go run ./services/productos

# Terminal 3: Clientes
go run ./services/clientes

# Terminal 4: Facturación
go run ./services/facturacion

# Terminal 5: Frontend Web
go run ./services/frontend
```

---

## 5. Acceso al Frontend

Una vez iniciados los servicios, abre en tu navegador:

👉 **[http://localhost:8080](http://localhost:8080)**

### Funcionalidades de la Interfaz:
1. **Inicio de Sesión y Registro:** Autenticación protegida con tokens firmados por el microservicio de Auth.
2. **Dashboard:** Métricas en tiempo real de facturación total, cantidad de facturas, clientes y stock disponible.
3. **Gestión de Productos:** CRUD completo con buscador en vivo, validación de precios (>0) y control de stock.
4. **Gestión de Clientes:** CRUD completo con validación de cédula (`cc`), correo y dirección.
5. **Generar Factura:** Selección de cliente y múltiples productos, visualización de existencias en tiempo real, cálculo de subtotales/total en el backend y descuento automático de inventario.
6. **Historial de Facturas:** Listado de facturas emitidas, visualizador detallado en modal, descarga directa en JSON y botón de **"Imprimir / Exportar a PDF"** optimizado con CSS `@media print`.

---

## 6. Ejecución de Pruebas Automatizadas

Todos los microservicios cuentan con pruebas unitarias y de integración que validan operaciones críticas (hashing seguro, concurrencia, atomicidad de descuento de stock, validaciones de unicidad y orquestación de facturas):

```bash
# Ejecutar todas las pruebas del proyecto
go test ./... -v
```

O por microservicio individual:
```bash
go test ./services/auth -v
go test ./services/productos -v
go test ./services/clientes -v
go test ./services/facturacion -v
```

---

## 7. Estructura del Directorio

```text
Microservicios/
├── data/                       # Archivos JSON de persistencia
│   ├── usuarios.json
│   ├── clientes.json
│   ├── productos.json
│   └── facturas.json
├── docs/                       # Documentación técnica
│   └── arquitectura.md
├── frontend/                   # Interfaz de usuario (HTML, CSS, JS)
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── config.js
│       ├── toast.js
│       ├── api.js
│       ├── auth.js
│       ├── dashboard.js
│       ├── productos.js
│       ├── clientes.js
│       ├── facturacion.js
│       ├── facturas_list.js
│       └── app.js
├── pkg/                        # Paquetes comunes y utilidades
│   ├── middleware/cors.go
│   ├── response/response.go
│   └── token/token.go
├── scripts/                    # Scripts de orquestación y utilidades
│   ├── runner/main.go
│   ├── start-all.bat
│   └── start-all.ps1
├── services/                   # Código fuente de los microservicios en Go
│   ├── auth/
│   ├── productos/
│   ├── clientes/
│   ├── facturacion/
│   └── frontend/
├── go.mod
├── go.sum
└── README.md
```
