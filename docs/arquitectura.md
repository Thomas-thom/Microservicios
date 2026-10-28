# Arquitectura del Sistema de Facturación Digital

Este documento describe la arquitectura modular del sistema de facturación basado en microservicios independientes desarrollados en **Go** y un cliente web en **JavaScript**, con persistencia en archivos **JSON**.

---

## 1. Diagrama de Arquitectura del Sistema

```mermaid
graph TB
    subgraph Frontend["Frontend Web (Puerto 8080)"]
        UI["SPA en React 18 + Bootstrap 5.3"]
    end

    subgraph Microservicios["Ecosistema de Microservicios en Go"]
        Auth["Microservicio de Autenticación\n(:8081)"]
        Productos["Microservicio de Productos\n(:8082)"]
        Clientes["Microservicio de Clientes\n(:8083)"]
        Facturacion["Microservicio de Facturación\n(:8084)"]
    end

    subgraph Persistencia["Capa de Persistencia JSON"]
        FileUsers[("data/usuarios.json")]
        FileProds[("data/productos.json")]
        FileClients[("data/clientes.json")]
        FileInvoices[("data/facturas.json")]
    end

    %% Comunicación Frontend -> Servicios
    UI -- "Login / Registro / Token" --> Auth
    UI -- "CRUD Productos" --> Productos
    UI -- "CRUD Clientes" --> Clientes
    UI -- "Generar / Listar Facturas" --> Facturacion

    %% Orquestación de Facturación
    Facturacion -- "1. Validar Bearer Token" --> Auth
    Facturacion -- "2. Obtener datos Cliente" --> Clientes
    Facturacion -- "3. Verificar precio y stock" --> Productos
    Facturacion -- "4. Descontar stock atómico" --> Productos

    %% Persistencia a archivos
    Auth --> FileUsers
    Productos --> FileProds
    Clientes --> FileClients
    Facturacion --> FileInvoices
```

---

## 2. Descripción de Componentes

| Componente | Puerto | Archivo de Persistencia | Responsabilidad Principal |
| :--- | :---: | :--- | :--- |
| **Auth Service** | `8081` | `data/usuarios.json` | Registro de usuarios, hashing de contraseñas con `bcrypt`, generación y validación de tokens HMAC-SHA256. |
| **Productos Service** | `8082` | `data/productos.json` | CRUD de productos, validación de precios (>0) y stock (>=0), y descuento atómico de existencias. |
| **Clientes Service** | `8083` | `data/clientes.json` | CRUD de clientes, validación de datos requeridos y control de duplicidad en identificación (`cc`) y correo (`email`). |
| **Facturación Service** | `8084` | `data/facturas.json` | Orquestador de facturación: consume Auth, Clientes y Productos, calcula subtotales y total en backend, reserva existencias y persiste facturas. |
| **Frontend Web** | `8080` | N/A | Interfaz de usuario responsiva, panel de control, gestión de catálogos, emisión y visualización / impresión a PDF. |

---

## 3. Catálogo de Endpoints REST

### 3.1. Microservicio de Autenticación (`:8081`)

| Método | Endpoint | Descripción | Encabezados Requeridos |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Registra un nuevo usuario con contraseña cifrada (bcrypt). | `Content-Type: application/json` |
| `POST` | `/login` | Valida credenciales y genera un token Bearer firmado. | `Content-Type: application/json` |
| `GET` | `/verify` | Valida el token del usuario y retorna claims de identidad. | `Authorization: Bearer <token>` |
| `GET` | `/usuarios` | Lista todos los usuarios registrados (sin contraseñas). | Ninguno |
| `GET` | `/usuarios/{id}` | Retorna el detalle de un usuario por su identificador. | Ninguno |

### 3.2. Microservicio de Productos (`:8082`)

| Método | Endpoint | Descripción | Payload / Parámetros |
| :--- | :--- | :--- | :--- |
| `GET` | `/productos` | Lista todos los productos disponibles. | Ninguno |
| `GET` | `/productos/{id}` | Obtiene los datos de un producto específico. | ID en URL |
| `POST` | `/productos` | Registra un nuevo producto (nombre, precio > 0, stock >= 0). | `{ "nombre": "...", "precio": 12000.0, "stock": 50 }` |
| `PUT` | `/productos/{id}` | Actualiza información de un producto existente. | Campos modificados |
| `DELETE`| `/productos/{id}` | Elimina un producto del catálogo. | ID en URL |
| `POST` | `/productos/descontar` | Aplica un descuento atómico a una lista de productos. | `{ "items": [{ "id": 101, "cantidad": 2 }] }` |

### 3.3. Microservicio de Clientes (`:8083`)

| Método | Endpoint | Descripción | Payload / Parámetros |
| :--- | :--- | :--- | :--- |
| `GET` | `/clientes` | Obtiene la lista completa de clientes. | Ninguno |
| `GET` | `/clientes/{id}` | Consulta un cliente por ID. | ID en URL |
| `POST` | `/clientes` | Registra un nuevo cliente (nombre, cc, email, dirección). | `{ "nombre": "...", "cc": "...", "email": "...", "direccion": "..." }` |
| `PUT` | `/clientes/{id}` | Actualiza datos de un cliente. | Campos modificados |
| `DELETE`| `/clientes/{id}` | Elimina un cliente registrado. | ID en URL |

### 3.4. Microservicio de Facturación (`:8084`)

| Método | Endpoint | Descripción | Seguridad / Encabezados |
| :--- | :--- | :--- | :--- |
| `POST` | `/facturas` | Genera una nueva factura orquestando los 3 servicios. | `Authorization: Bearer <token>` |
| `GET` | `/facturas` | Lista todas las facturas históricas generadas. | Ninguno |
| `GET` | `/facturas/{id}` | Obtiene el detalle de una factura por su ID. | ID en URL |

---

## 4. Flujo Detallado de Emisión de Facturas

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant UI as Frontend Web
    participant Facturacion as Servicio Facturación (:8084)
    participant Auth as Servicio Auth (:8081)
    participant Clientes as Servicio Clientes (:8083)
    participant Productos as Servicio Productos (:8082)

    Usuario->>UI: Selecciona Cliente y Productos con Cantidades
    Usuario->>UI: Clic en "Emitir y Guardar Factura"
    UI->>Facturacion: POST /facturas (Authorization: Bearer <token>, cliente_id, items)

    Facturacion->>Auth: GET /verify (Authorization: Bearer <token>)
    Auth-->>Facturacion: 200 OK (UserClaims: id, nombre, rol)

    Facturacion->>Clientes: GET /clientes/{cliente_id}
    Clientes-->>Facturacion: 200 OK (Cliente: id, nombre, email)

    loop Por cada producto solicitado
        Facturacion->>Productos: GET /productos/{id}
        Productos-->>Facturacion: 200 OK (Producto: precio_real, stock_actual)
        Facturacion->>Facturacion: Valida stock_actual >= cantidad y calcula subtotal
    end

    Facturacion->>Facturacion: Calcula total sumando subtotales

    Facturacion->>Productos: POST /productos/descontar (items)
    alt Stock suficiente en todos los productos
        Productos-->>Facturacion: 200 OK (Stock actualizado en productos.json)
        Facturacion->>Facturacion: Asigna correlativo 5000+ y fecha actual
        Facturacion->>Facturacion: Guarda factura en facturas.json
        Facturacion-->>UI: 201 Created (Factura armada completa)
        UI-->>Usuario: Muestra comprobante con botón de imprimir / exportar a PDF
    else Stock insuficiente en algún producto
        Productos-->>Facturacion: 409 Conflict (Stock insuficiente)
        Facturacion-->>UI: 409 Conflict (Detalle del producto agotado)
        UI-->>Usuario: Muestra Toast de error y no descuenta nada
    end
```

---

## 5. Ejemplo de Factura Generada (Estándar del PDF)

Estructura persistida en `data/facturas.json`:

```json
[
  {
    "factura_id": 5001,
    "cliente": {
      "id": 201,
      "nombre": "Carlos Pérez",
      "email": "carlos@example.com"
    },
    "usuario": {
      "id": 1,
      "nombre": "Ricardo Gómez",
      "rol": "admin"
    },
    "productos": [
      {
        "id": 101,
        "nombre": "Laptop Lenovo ThinkPad",
        "cantidad": 1,
        "precio_unitario": 3500000.00,
        "subtotal": 3500000.00
      },
      {
        "id": 102,
        "nombre": "Mouse inalámbrico Logitech",
        "cantidad": 2,
        "precio_unitario": 12000.00,
        "subtotal": 24000.00
      }
    ],
    "total": 3524000.00,
    "fecha": "2026-10-18"
  }
]
```

---

## 6. Mecanismos de Seguridad y Concurrencia

1. **Persistencia Concurrente Segura:**
   Todos los repositorios implementan `sync.RWMutex` para garantizar lecturas simultáneas seguras y escrituras exclusivas atómicas, evitando corrupción de archivos JSON.
2. **Cifrado de Contraseñas:**
   Uso de `golang.org/x/crypto/bcrypt` con costo estándar. Las contraseñas nunca se guardan en texto claro ni se devuelven en las respuestas de la API.
3. **Cálculo de Importes en el Servidor:**
   El frontend únicamente envía IDs de producto y cantidades solicitadas; el backend consulta los precios oficiales y calcula subtotales y total sin confiar en la entrada del cliente.
4. **Descuento Atómico de Existencias:**
   El endpoint `/productos/descontar` realiza una verificación preliminar de la totalidad del pedido antes de descontar inventario, previniendo estados inconsistentes o stock negativo.
