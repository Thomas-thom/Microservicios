# Sistema de Facturación Digital Basado en Microservicios (Go)

Sistema de facturación digital desarrollado en **Go** y una interfaz web moderna en **React 18 + Bootstrap 5.3**, estructurado en microservicios independientes con persistencia en archivos **JSON**, conforme a los requerimientos del proyecto académico `Proyecto1ProgramacionAvanzada.pdf`.

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

## 4. Cómo Iniciar los Servicios (Prueba Oficial en 4 Ventanas de CMD)

### Opción A: Lanzador Automático de las 4 Ventanas de CMD (Recomendado para Sustentación)
Haz doble clic en **`iniciar-4-cmd.bat`** (o ejecuta en consola):
```cmd
iniciar-4-cmd.bat
```
Esto abrirá automáticamente las **4 ventanas de CMD independientes** en el orden solicitado:
1. **Ventana CMD 1:** Servicio General de Facturación (`:8084`) + Servidor de Interfaz Web integrado (`:8080` y `:8084`).
2. **Ventana CMD 2:** Servicio de Autenticación (`:8081`).
3. **Ventana CMD 3:** Servicio de Productos (`:8082`).
4. **Ventana CMD 4:** Servicio de Clientes (`:8083`).

### Opción B: Abrir las 4 Ventanas de CMD Manualmente
Abre **4 ventanas de Símbolo del sistema (`cmd.exe`)** y sitúate en la carpeta raíz del proyecto en cada una:

```cmd
cd "C:\Users\Thuer\OneDrive\Documents\Microservicios"
```

Luego ejecuta cada servicio en su ventana correspondiente:

- **Ventana CMD 1 (Servicio General de Facturación + Interfaz Web - Puertos 8084 y 8080):**
  ```cmd
  go run ./services/facturacion
  ```
- **Ventana CMD 2 (Servicio de Autenticación - Puerto 8081):**
  ```cmd
  go run ./services/auth
  ```
- **Ventana CMD 3 (Servicio de Productos - Puerto 8082):**
  ```cmd
  go run ./services/productos
  ```
- **Ventana CMD 4 (Servicio de Clientes - Puerto 8083):**
  ```cmd
  go run ./services/clientes
  ```

*(Nota: También existe `iniciar-5-cmd.bat` si se desea correr el servidor de archivos estáticos `services/frontend` en una 5ta ventana separada).*

---

## 5. Pruebas de Sustentación del Profesor

### 5.1. Efecto de Matar / Detener Servicios por Separado sobre el Servicio de Facturas
Para detener cualquier servicio en su ventana de CMD, presiona **`Ctrl + C`** (o cierra su ventana) y en la interfaz web ve a **Punto de Venta (POS)** y haz clic en **"Emitir y Guardar Factura"** o en **"Probar Efecto en Facturación (:8084)"**:

| Servicio Detenido (`Ctrl+C`) | Efecto en el Servicio General de Facturación (`:8084`) |
| :--- | :--- |
| **Autenticación (`:8081`)** | Falla en el **Paso 1/4** (`GET /verify`). El servicio de facturación registra el fallo en su consola CMD y devuelve `HTTP 503 Service Unavailable`. No se emite factura ni se altera el stock. |
| **Clientes (`:8083`)** | Pasa el Paso 1 (Auth OK), pero falla en el **Paso 2/4** (`GET /clientes/{id}`). El servicio de facturación devuelve `HTTP 503 Service Unavailable` indicando que el servicio de Clientes está caído. No se altera el stock. |
| **Productos (`:8082`)** | Pasan los Pasos 1 y 2, pero falla en el **Paso 3/4 y 4/4** (`GET /productos/{id}` / `POST /productos/descontar`). El servicio de facturación devuelve `HTTP 503 Service Unavailable` y aborta la creación de la factura para proteger la integridad del inventario. |

Para volver a levantar un servicio detenido en su ventana de CMD, basta con presionar la flecha hacia arriba (`↑`) y `Enter`.

### 5.2. Modificación en Vivo de los Archivos JSON (`data/*.json`)
Todos los microservicios leen y escriben directamente sobre los archivos JSON en cada petición HTTP sin requerir reinicio:
- **`data/usuarios.json` (`:8081`):** Puedes editar nombres, roles o agregar un usuario nuevo (soporta tanto hashes `bcrypt` como contraseñas en texto plano escritas manualmente durante la prueba). El endpoint `/verify` consulta `usuarios.json` en tiempo real al emitir facturas.
- **`data/productos.json` (`:8082`):** Puedes modificar precios, cambiar existencias (`stock`) o agregar un producto nuevo. Al pulsar **"Recargar productos.json"** o emitir una factura, el backend tomará inmediatamente el nuevo precio y stock.
- **`data/clientes.json` (`:8083`):** Puedes modificar nombres, cédulas (`cc`), correos o agregar clientes y verlos reflejados al instante en la interfaz web.
- **`data/facturas.json` (`:8084`):** Almacena todas las facturas emitidas con numeración consecutiva (`5001+`).

---

## 6. Acceso al Frontend (JavaScript + React.js 18 + Bootstrap 5.3)

Una vez iniciadas las 4 ventanas de CMD, abre en tu navegador cualquiera de estas dos direcciones:

👉 **[http://localhost:8080](http://localhost:8080)** ó **[http://localhost:8084](http://localhost:8084)**

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
