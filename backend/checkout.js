import { obtenerProductos } from "./load_products.js";
import {
    CART_STORAGE_KEY,
    CART_UPDATED_EVENT,
    claveEntradaCarrito,
    guardarCarrito,
    leerCarrito
} from "./cart_storage.js";

const cartItems = document.getElementById("checkout-items");
const subtotalElement = document.getElementById("checkout-subtotal");
const totalElement = document.getElementById("checkout-total");
let productosDisponibles = [];

function formatearPrecio(precio) {
    return `$ ${Number(precio).toLocaleString("es-UY", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function crearFilaCarrito(producto, entrada) {
    const fila = document.createElement("article");
    fila.className = "checkout-item";
    fila.dataset.productId = entrada.productId;
    fila.dataset.cartKey = claveEntradaCarrito(entrada);

    const productoInfo = document.createElement("div");
    productoInfo.className = "checkout-item__product";

    const imagen = document.createElement("img");
    imagen.className = "checkout-item__image";
    imagen.src = producto.imgSrc;
    imagen.alt = producto.alt || producto.name;
    imagen.loading = "lazy";

    const informacion = document.createElement("div");
    informacion.className = "checkout-item__info";

    const nombre = document.createElement("h3");
    nombre.className = "checkout-item__name";
    nombre.textContent = producto.name;

    const categoria = document.createElement("p");
    categoria.className = "checkout-item__category";
    categoria.textContent = Array.isArray(producto.categories)
        ? producto.categories.join(" · ")
        : "Horus Uruguay";

    const variante = document.createElement("p");
    variante.className = "checkout-item__category";
    variante.textContent = `Color: ${entrada.color} · Talle: ${entrada.size}`;
    informacion.append(nombre, categoria, variante);
    productoInfo.append(imagen, informacion);

    const cantidadControl = document.createElement("div");
    cantidadControl.className = "checkout-item__quantity";
    cantidadControl.setAttribute(
        "aria-label",
        `Cantidad de ${producto.name}: ${entrada.quantity}`
    );

    const disminuir = document.createElement("button");
    disminuir.type = "button";
    disminuir.dataset.action = "decrease";
    disminuir.textContent = "−";
    disminuir.disabled = entrada.quantity <= 1;
    disminuir.setAttribute("aria-label", `Disminuir cantidad de ${producto.name}`);

    const valorCantidad = document.createElement("span");
    valorCantidad.className = "checkout-item__quantity-value";
    valorCantidad.textContent = String(entrada.quantity);

    const aumentar = document.createElement("button");
    aumentar.type = "button";
    aumentar.dataset.action = "increase";
    aumentar.textContent = "+";
    aumentar.disabled = entrada.quantity >= 15;
    aumentar.setAttribute("aria-label", `Aumentar cantidad de ${producto.name}`);

    cantidadControl.append(disminuir, valorCantidad, aumentar);

    const precio = document.createElement("span");
    precio.className = "checkout-item__price";
    precio.textContent = formatearPrecio(Number(producto.price) * entrada.quantity);

    const eliminar = document.createElement("button");
    eliminar.type = "button";
    eliminar.className = "checkout-item__remove";
    eliminar.dataset.action = "remove";
    eliminar.textContent = "×";
    eliminar.setAttribute(
        "aria-label",
        `Eliminar ${producto.name}, color ${entrada.color}, talle ${entrada.size}`
    );

    fila.append(productoInfo, cantidadControl, precio, eliminar);
    return fila;
}

function renderizarCarrito(productos) {
    const entradas = leerCarrito();
    const productosPorId = new Map(productos.map(producto => [String(producto.id), producto]));
    const entradasValidas = entradas.filter(entrada => {
        const producto = productosPorId.get(entrada.productId);
        return producto &&
            Array.isArray(producto.colors) && producto.colors.includes(entrada.color) &&
            Array.isArray(producto.size) && producto.size.includes(entrada.size);
    });

    cartItems.replaceChildren();

    if (entradasValidas.length === 0) {
        const vacio = document.createElement("div");
        vacio.className = "checkout-empty";

        const mensaje = document.createElement("p");
        mensaje.textContent = "Tu carrito está vacío.";

        const enlace = document.createElement("a");
        enlace.href = "/frontend/catalogo.html";
        enlace.textContent = "Descubrir productos";

        vacio.append(mensaje, enlace);
        cartItems.appendChild(vacio);
    } else {
        entradasValidas.forEach(entrada =>
            cartItems.appendChild(
                crearFilaCarrito(productosPorId.get(entrada.productId), entrada)
            )
        );
    }

    const subtotal = entradasValidas.reduce((total, entrada) => {
        const producto = productosPorId.get(entrada.productId);
        return total + Number(producto.price) * entrada.quantity;
    }, 0);
    subtotalElement.textContent = formatearPrecio(subtotal);
    totalElement.textContent = formatearPrecio(subtotal);

    if (entradasValidas.length !== entradas.length) guardarCarrito(entradasValidas);
}

cartItems.addEventListener("click", event => {
    const boton = event.target.closest("button[data-action]");
    if (!boton) return;

    const fila = boton.closest(".checkout-item");
    const clave = fila.dataset.cartKey;
    const entradas = leerCarrito();
    const entrada = entradas.find(item => claveEntradaCarrito(item) === clave);
    if (!entrada) return;

    let entradasActualizadas;
    if (boton.dataset.action === "remove") {
        entradasActualizadas = entradas.filter(item => claveEntradaCarrito(item) !== clave);
    } else {
        const quantity = boton.dataset.action === "increase"
            ? Math.min(15, entrada.quantity + 1)
            : Math.max(1, entrada.quantity - 1);
        entradasActualizadas = entradas.map(item =>
            claveEntradaCarrito(item) === clave ? { ...item, quantity } : item
        );
    }

    guardarCarrito(entradasActualizadas);
    renderizarCarrito(productosDisponibles);
});

function actualizarCarritoPorCambio() {
    if (productosDisponibles.length) renderizarCarrito(productosDisponibles);
}

window.addEventListener(CART_UPDATED_EVENT, actualizarCarritoPorCambio);
window.addEventListener("storage", event => {
    if (event.key === CART_STORAGE_KEY) actualizarCarritoPorCambio();
});

async function cargarCarrito() {
    cartItems.replaceChildren();
    const cargando = document.createElement("p");
    cargando.className = "checkout-status checkout-status--loading";
    cargando.setAttribute("role", "status");
    cargando.textContent = "Cargando tu compra...";
    cartItems.appendChild(cargando);

    try {
        productosDisponibles = await obtenerProductos(true);
        renderizarCarrito(productosDisponibles);
    } catch (error) {
        console.error("No se pudo cargar el carrito:", error);
        const mensaje = document.createElement("p");
        mensaje.className = "checkout-status";
        mensaje.setAttribute("role", "alert");
        mensaje.textContent = "No se pudieron cargar los productos. Recargá la página para volver a intentar.";
        cartItems.replaceChildren(mensaje);
    }
}

cargarCarrito();
