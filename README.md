# Horus Uruguay: Setup

El contexto original del proyecto está en [context.md](context.md).

## Migración a React + Vite

La aplicación React está disponible en `/react/` y usa rutas hash para permitir
recargas y enlaces directos sin cambiar las rutas de la API:

| Vista | Ruta |
| --- | --- |
| Inicio | `/react/` |
| Catálogo | `/react/#/catalogo` |
| Producto | `/react/#/producto?id=ID` |
| Carrito | Drawer del encabezado o `/react/#/carrito` |
| Checkout | `/react/#/checkout` |
| Cuenta | `/react/#/cuenta` |
| Administración | `/react/#/administracion` |

Las páginas originales siguen disponibles en `/frontend/` como referencia.
React reutiliza las hojas de estilo originales, los filtros y la persistencia
del carrito. No importa los scripts antiguos que renderizan el DOM. Los servicios
de `src/services/` consultan la misma API Express.

Producto conserva la validación de variantes por API. Drawer y checkout comparten
estado, sincronizan cambios entre pestañas y contrastan las variantes y precios
con el catálogo al navegar. Las variantes que ya no existen no se muestran.
Administración permite listar, crear, editar y eliminar productos y categorías;
requiere una sesión de administrador. Las escrituras necesitan MongoDB, no el
modo de demostración.

No hay todavía API de pedidos, pagos, cupones ni contacto. Las vistas lo indican
al intentar esas acciones y no simulan operaciones exitosas.

Desde `horus.uy/`, iniciá Express en una terminal:

```bash
npm run demo
```

O usá `npm run dev:server` para conectar MongoDB con las variables de `.env`.
En otra terminal iniciá Vite:

```bash
npm run dev
```

Abrí `http://localhost:5173/react/` (o el puerto que indique Vite). El proxy
envía `/api`, `/frontend` y `/backend` a Express en el puerto 3000. No expongas
credenciales de MongoDB en variables `VITE_*`: son públicas en el navegador.

```bash
npm run lint
npm run build
```

ESLint revisa `src/`, las configuraciones nuevas y el módulo de filtros
reutilizado; aún no cubre todos los scripts antiguos ni el servidor. El build
se genera en `dist/` y Express lo sirve en `http://localhost:3000/react/`.
Los recursos y páginas antiguas siguen siendo servidos por Express.
`npm run preview` previsualiza solamente el build; para usar la API y recursos
existentes, comprobá el build desde Express.

## Requisitos

- Node.js 22.16 o superior y npm.
- MongoDB local o un cluster de MongoDB Atlas, solo para el modo MongoDB.
- Ejecutar todos los comandos siguientes desde `horus.uy/`.

## Instalación

```bash
npm install
```

Express sirve la web y la API desde el mismo origen. No uses Live Server ni
el servidor estático de Python para esta versión: no ofrecen `/api/products`.

## Probar sin MongoDB

La URI actual de `.env` es un placeholder. Mientras no tengas una conexión
válida, ejecutá:

```bash
npm run demo
```

Abrí <http://localhost:3000/frontend/catalogo.html>. El checkout está en
<http://localhost:3000/frontend/checkout.html>.

Este modo lee `backend/db/db.json` en el servidor, valida sus productos y los
entrega mediante la misma API. No conecta ni escribe en MongoDB, ni modifica
el JSON. Se activa exclusivamente con `--fixtures`; nunca se usa como fallback
automático cuando falla la conexión a la base.
Las cuentas, sesiones, carritos, productos creados y sus imágenes se guardan en
memoria en este modo y se pierden al reiniciar el proceso.

## Configurar MongoDB

Si no tenés un `.env`, usá `.env.example` como base sin sobrescribir uno existente:

```bash
cp -n .env.example .env
```

En `.env`, configurá:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/horus
PORT=3000
WHATSAPP_BUSINESS_NUMBER=59812345678
```

La URI local requiere un MongoDB en ejecución en ese host y puerto.
Reemplazá el ejemplo de `WHATSAPP_BUSINESS_NUMBER` por el número real del negocio
en formato internacional, solo dígitos y sin el signo `+`; es necesario para
finalizar órdenes y generar el enlace de WhatsApp.
Para Atlas, reemplazala por la URI de **Connect > Drivers**, con el usuario de
base de datos, contraseña y nombre de base. Autorizá también la IP de salida
del servidor en Atlas. No compartas la URI ni la incluyas en código del navegador.
En un contenedor, `127.0.0.1` corresponde al contenedor, no a tu computadora.

`.env` y `node_modules/` se ignoran en Git. Si `.env` ya estaba versionado,
agregarlo a `.gitignore` no lo elimina del historial ni del índice: retiralo del
seguimiento y rotá las credenciales reales que se hayan publicado.

## Importar los productos iniciales

Con una URI válida:

```bash
npm run seed
```

Importa los productos actuales de `backend/db/db.json` a la colección `products`.
Las claves de `items` se usan como `_id` string: los IDs que ya guarda el carrito
siguen siendo válidos. Se mantienen los campos `is_new`, `name`, `categories`,
`price`, `imgSrc`, `imgSrcHover`, `alt`, `colors` y `size`.

El script valida todos los productos antes de escribir. Puede repetirse:
inserta solamente IDs ausentes, no borra ni sobrescribe documentos existentes.
El servidor no importa productos automáticamente al arrancar. Cambiar el JSON
después del seed no actualiza los documentos ya importados.

## Iniciar con MongoDB

```bash
npm run dev:server
```

Reinicia Node al cambiar archivos del servidor. Para iniciar sin watcher:

```bash
npm start
```

`npm run dev:server` y `npm start` cargan `.env` y conectan MongoDB antes de abrir el puerto HTTP.
Si la URI es inválida o la base no está disponible, terminan con un error;
no sustituyen los datos por placeholders. Si el puerto está ocupado, cambiá
`PORT` en `.env` o ejecutá `PORT=3001 npm run demo` en Linux.

## API

La API JSON está disponible bajo `/api`. Los endpoints de lectura de catálogo
son públicos. Las escrituras de productos y categorías requieren sesión de
administrador. Los endpoints de cuenta usan una cookie de sesión HttpOnly; las
contraseñas nunca se devuelven.

### Autenticación y cuenta

Los formularios de login y registro se muestran sin navbar ni footer y tienen un
botón «Volver» al inicio. El perfil requiere iniciar sesión. Las contraseñas se
guardan con scrypt. El registro siempre asigna el rol `user`; para promover
manualmente una cuenta, conectate a MongoDB y ejecutá:

```javascript
db.users.updateOne({ email: "admin@ejemplo.com" }, { $set: { role: "admin" } })
```

| Método | Ruta | Acceso | Cuerpo | Respuesta |
| --- | --- | --- | --- | --- |
| POST | `/api/register` | Público | `{ "nombre", "apellido", "email", "password" }` | `201`, perfil y cookie de sesión; `409` si el email existe |
| POST | `/api/login` | Público | `{ "email", "password" }` | `200`, perfil y cookie; `401` si las credenciales no coinciden |
| GET | `/api/session` | Sesión | — | `200`, perfil; `401` si no hay sesión válida |
| POST | `/api/logout` | Público | — | `204`; invalida la cookie/sesión actual si existe |
| PATCH | `/api/change-password` | Sesión | `{ "currentPassword", "newPassword" }` | `200`; requiere contraseña actual correcta y nueva de 8–128 caracteres |

El perfil contiene `id`, `uuid`, `nombre`, `apellido`, `email`, `role` y
`direccion`. El registro requiere nombre/apellido (hasta 80 caracteres), email
válido y contraseña de 8–128 caracteres.

### Productos

| Método | Ruta | Acceso | Cuerpo | Respuesta |
| --- | --- | --- | --- | --- |
| GET | `/api/products` | Público | — | `200`, `{ "items": { "ID": { ...producto } } }` |
| GET | `/api/products?page=1&limit=12` | Público | Filtros opcionales `category`, `color`, `size`, `minPrice`, `maxPrice` y `sort` | `200`, hasta 12 productos y metadatos de paginación |
| GET | `/api/products/:id` | Público | — | `200`, producto; `404` si no existe |
| GET | `/api/products/images/:id` | Público | — | Imagen almacenada en GridFS |
| POST | `/api/products` | Admin | JSON de producto o `multipart/form-data` con `product`, `image` y `hoverImage` | `201`, producto creado; `409` si el ID ya existe |
| PATCH | `/api/products/:id` | Admin | Campos del producto y archivos opcionales `image` / `hoverImage` | `200`, producto actualizado; `404` si no existe |
| DELETE | `/api/products/:id` | Admin | — | `200`, `{ "id" }`; `404` si no existe |
| POST | `/api/products/:id/variants` | Público | `{ "color", "size" }` | `200`, `{ "valid": true }`; `400` si la variante no está disponible |

Producto: `_id` (opcional; string, se genera uno si se omite), `is_new`
(boolean), `name`, `imgSrc`, `imgSrcHover`, `alt` (strings), `price` (número
finito mayor o igual a uno), `categories` (nombres) o `categoryIds` (IDs),
`colors` y `size` (arreglos opcionales de strings). No se aceptan campos
adicionales. Los productos devueltos incluyen `id`, `categories` y
`categoryIds`. Un catálogo vacío devuelve `{ "items": {} }`.
El catálogo React solicita 12 productos por página y conserva los filtros y
orden al usar «Cargar más». El formulario de administración acepta JPEG, PNG y
WebP de hasta 5 MB por imagen; los archivos se almacenan en GridFS y se eliminan
al reemplazar o borrar el producto. Las cargas requieren MongoDB; los productos
existentes que usan URLs continúan siendo compatibles.

### Categorías

| Método | Ruta | Acceso | Cuerpo | Respuesta |
| --- | --- | --- | --- | --- |
| GET | `/api/categories` | Público | — | `200`, arreglo de `{ "id", "name" }` |
| POST | `/api/categories` | Admin | `{ "name" }` | `201`, categoría creada; `409` si el nombre ya existe |
| PATCH | `/api/categories/:id` | Admin | `{ "name" }` | `200`, categoría actualizada; `404` si no existe |
| DELETE | `/api/categories/:id` | Admin | — | `200`, `{ "id" }`; `409` si está asignada a productos |

El nombre debe contener entre 1 y 80 caracteres. Las escrituras administrativas
responden `401` sin sesión, `403` si el rol no es `admin` y `503` si ocurre un
fallo de base de datos.

### Carritos

El carrito de invitado se mantiene en `localStorage`. El carrito de cada cuenta
se guarda en la colección `carts`, asociado a la sesión. Al iniciar sesión o
registrarse, ambos se combinan automáticamente; las cantidades de la misma
combinación de producto, color y talle se suman hasta 15 unidades. Se admiten
hasta 200 variantes distintas. La combinación usa un identificador persistente
para que un reintento no duplique artículos; el carrito de invitado solo se
limpia tras confirmar el guardado. Se alerta al usuario para que verifique sus
productos y cantidades. Los precios se obtienen del catálogo del servidor y se
valida la disponibilidad de colores y talles (no hay inventario numérico).

| Método | Ruta | Acceso | Cuerpo | Respuesta |
| --- | --- | --- | --- | --- |
| GET | `/api/cart` | Sesión | — | `200`, `{ "userId", "entries", "version", "warnings" }` con precios actuales |
| POST | `/api/cart/merge` | Sesión | `{ "mergeId", "entries" }` | `200`, carrito combinado e indicador `merged`; es idempotente por `mergeId` |
| PUT | `/api/cart/entry` | Sesión | `{ "entry": { "productId", "color", "size", "quantity" }, "version" }` | `200`, carrito actualizado; `quantity: 0` elimina la variante |

Los elementos recibidos por merge contienen producto, color, talle y cantidad
(1–15); el servidor ignora nombre, imagen y precio proporcionados por el cliente,
y vuelve a comprobar la variante y el precio actual. Los conflictos de versión
responden `409`; sin sesión, los endpoints del carrito responden `401`. El
carrito de cuenta permanece en MongoDB al cerrar sesión y no se muestra al
siguiente usuario del dispositivo.

## Organización

- `server/`: aplicación Express, conexión, modelo, seed y pruebas de Node.
- `frontend/`: páginas, estilos e imágenes; servido en `/frontend`.
- `backend/`: módulos existentes del navegador, aunque su nombre sea backend.
	Express publica solamente los JavaScript autorizados; no publica el JSON,
	el código del servidor, `.env` ni la raíz del repositorio.
- `backend/load_products.js`: carga `/api/products` y conserva la API compartida
	`obtenerProductos()`, el filtrado local y la presentación del catálogo.

El tema mantiene su persistencia local. El carrito de invitado sigue usando
`localStorage`; los carritos de cuentas se guardan en MongoDB. Los cupones y
órdenes se almacenan en MongoDB. Al finalizar una orden se prepara un mensaje de
WhatsApp; no se procesa ningún pago en línea.
