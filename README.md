# Horus Uruguay: Setup

El contexto original del proyecto está en [context.md](context.md).

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

## Configurar MongoDB

Si no tenés un `.env`, usá `.env.example` como base sin sobrescribir uno existente:

```bash
cp -n .env.example .env
```

En `.env`, configurá:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/horus
PORT=3000
```

La URI local requiere un MongoDB en ejecución en ese host y puerto.
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
npm run dev
```

Reinicia Node al cambiar archivos del servidor. Para iniciar sin watcher:

```bash
npm start
```

Ambos comandos cargan `.env` y conectan MongoDB antes de abrir el puerto HTTP.
Si la URI es inválida o la base no está disponible, terminan con un error;
no sustituyen los datos por placeholders. Si el puerto está ocupado, cambiá
`PORT` en `.env` o ejecutá `PORT=3001 npm run demo` en Linux.

## API

| Método | Ruta | Respuesta |
| --- | --- | --- |
| GET | `/api/products` | `{ "items": { "1": { ...camposProducto } } }` |
| GET | `/api/products/:id` | `{ "id": "1", ...camposProducto }` |
| POST | `/api/products` | `201` y `{ "id": "...", ...camposProducto }` |

El `POST` recibe JSON con `_id` (string), `is_new` (boolean), `name`, `imgSrc`,
`imgSrcHover` y `alt` (strings), y `price` (número finito mayor o igual a cero).
`categories`, `colors` y `size` son arreglos opcionales de strings; si se omiten,
se guardan vacíos. No se permiten campos adicionales.

El `POST` responde HTTP 400 si el producto no cumple el esquema, HTTP 409 si el
`_id` ya existe y HTTP 503 si no se pudo guardar en MongoDB. Requiere iniciar
con `npm start` y una URI válida; el modo `npm run demo` no escribe en MongoDB.
Producto inexistente en la consulta por ID: HTTP 404. Una base vacía devuelve
`{ "items": {} }`.

## Organización

- `server/`: aplicación Express, conexión, modelo, seed y pruebas de Node.
- `frontend/`: páginas, estilos e imágenes; servido en `/frontend`.
- `backend/`: módulos existentes del navegador, aunque su nombre sea backend.
	Express publica solamente los JavaScript autorizados; no publica el JSON,
	el código del servidor, `.env` ni la raíz del repositorio.
- `backend/load_products.js`: carga `/api/products` y conserva la API compartida
	`obtenerProductos()`, el filtrado local y la presentación del catálogo.

Los archivos que interactúan con `localStorage` no se modificaron. El carrito,
el tema y el checkout mantienen su persistencia actual. El cupón y la compra
siguen siendo placeholders; MongoDB guarda productos, no carritos ni pedidos.
