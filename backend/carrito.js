import { obtenerProductos } from "./load_products.js";
import {
    CART_STORAGE_KEY,
    CART_UPDATED_EVENT,
    claveEntradaCarrito,
    guardarCarrito,
    leerCarrito
} from "./cart_storage.js";

const cartButton = document.getElementById("cart-btn");
const cartItems = document.getElementById("cart-items");
const cartSubtotal = document.getElementById("cart-subtotal");
const cartBadge = cartButton.querySelector(".icon-btn__badge");
const cartDrawer = document.getElementById("cart-drawer");
const cartLoader = document.createElement("img");
cartLoader.className = "cart-loading";
cartLoader.src = new URL("../frontend/src/loading-orange.gif", import.meta.url).href;
cartLoader.alt = "Cargando carrito";
let productosDisponibles = [];

function formatearPrecio(precio) {
    return `$ ${Number(precio).toLocaleString("es-UY")}`;
}

function actualizarContador(cantidad) {
    cartBadge.textContent = cantidad;
    cartBadge.hidden = cantidad === 0;
    cartButton.setAttribute(
        "aria-label",
        `Ver carrito (${cantidad} ${cantidad === 1 ? "producto" : "productos"})`
    );
}

function crearFilaCarrito(producto, entrada) {
    const fila = document.createElement("article");
    fila.className = "cart-item";
    fila.dataset.productId = entrada.productId;
    fila.dataset.cartKey = claveEntradaCarrito(entrada);

    const imagen = document.createElement("img");
    imagen.className = "cart-item__img";
    imagen.src = producto.imgSrc;
    imagen.alt = producto.name;
    imagen.loading = "lazy";

    const informacion = document.createElement("div");
    informacion.className = "cart-item__info";

    const nombre = document.createElement("h3");
    nombre.className = "cart-item__name";
    nombre.textContent = producto.name;

    const variante = document.createElement("p");
    variante.className = "cart-item__variant";
    variante.textContent = `Color: ${entrada.color} · Talle: ${entrada.size}`;

    const detalles = document.createElement("div");
    detalles.className = "cart-item__details";

    const cantidadControl = document.createElement("div");
    cantidadControl.className = "cart-item__qty";
    cantidadControl.setAttribute("aria-label", `Cantidad: ${entrada.quantity}`);

    const disminuir = document.createElement("button");
    disminuir.type = "button";
    disminuir.className = "cart-item__quantity-btn";
    disminuir.dataset.action = "decrease";
    disminuir.textContent = "−";
    disminuir.disabled = entrada.quantity <= 1;
    disminuir.setAttribute("aria-label", `Disminuir cantidad de ${producto.name}`);

    const valorCantidad = document.createElement("span");
    valorCantidad.className = "cart-item__quantity-value";
    valorCantidad.textContent = String(entrada.quantity);

    const aumentar = document.createElement("button");
    aumentar.type = "button";
    aumentar.className = "cart-item__quantity-btn";
    aumentar.dataset.action = "increase";
    aumentar.textContent = "+";
    aumentar.disabled = entrada.quantity >= 15;
    aumentar.setAttribute("aria-label", `Aumentar cantidad de ${producto.name}`);

    cantidadControl.append(disminuir, valorCantidad, aumentar);

    const precio = document.createElement("span");
    precio.className = "cart-item__price";
    precio.textContent = formatearPrecio(producto.price);

    const eliminar = document.createElement("button");
    eliminar.type = "button";
    eliminar.className = "cart-item__remove";
    eliminar.textContent = "\u00d7";
    eliminar.setAttribute(
        "aria-label",
        `Eliminar ${producto.name}, color ${entrada.color}, talle ${entrada.size}`
    );

    detalles.append(cantidadControl, precio);
    informacion.append(nombre, variante, detalles);
    fila.append(imagen, informacion, eliminar);
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
    entradasValidas.forEach(entrada =>
        cartItems.appendChild(crearFilaCarrito(productosPorId.get(entrada.productId), entrada))
    );

    if (entradasValidas.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "cart-empty";
        vacio.textContent = "Tu carrito está vacío.";
        cartItems.appendChild(vacio);
    }

    const subtotal = entradasValidas.reduce((total, entrada) => {
        const producto = productosPorId.get(entrada.productId);
        return total + Number(producto.price) * entrada.quantity;
    }, 0);
    cartSubtotal.textContent = formatearPrecio(subtotal);
    actualizarContador(entradasValidas.reduce((total, entrada) => total + entrada.quantity, 0));

    if (entradasValidas.length !== entradas.length) guardarCarrito(entradasValidas);
}

cartItems.addEventListener("click", event => {
    const botonEliminar = event.target.closest(".cart-item__remove");
    const botonCantidad = event.target.closest(".cart-item__quantity-btn");
    if (!botonEliminar && !botonCantidad) return;

    const fila = event.target.closest(".cart-item");
    const clave = fila.dataset.cartKey;
    const entradas = leerCarrito();
    const entrada = entradas.find(item => claveEntradaCarrito(item) === clave);
    if (!entrada) return;

    let nuevasEntradas;
    if (botonEliminar) {
        nuevasEntradas = entradas.filter(item => claveEntradaCarrito(item) !== clave);
    } else {
        const cantidad = botonCantidad.dataset.action === "increase"
            ? Math.min(15, entrada.quantity + 1)
            : Math.max(1, entrada.quantity - 1);
        nuevasEntradas = entradas.map(item =>
            claveEntradaCarrito(item) === clave ? { ...item, quantity: cantidad } : item
        );
    }

    guardarCarrito(nuevasEntradas);
    renderizarCarrito(productosDisponibles);
});

cartButton.addEventListener("click", async () => {
    cartItems.replaceChildren(cartLoader);
    try {
        productosDisponibles = await obtenerProductos(true);
        renderizarCarrito(productosDisponibles);
    } catch (error) {
        console.error("No se pudo cargar el carrito:", error);
        cartItems.replaceChildren();
        const errorMessage = document.createElement("p");
        errorMessage.className = "cart-empty";
        errorMessage.textContent = "No se pudieron cargar los productos.";
        cartItems.appendChild(errorMessage);
    } finally {
        cartLoader.remove();
    }
});

function actualizarCarritoPorCambio() {
    actualizarContador(leerCarrito().reduce((total, entrada) => total + entrada.quantity, 0));
    if (cartDrawer.classList.contains("is-open") && productosDisponibles.length) {
        renderizarCarrito(productosDisponibles);
    }
}

window.addEventListener(CART_UPDATED_EVENT, actualizarCarritoPorCambio);
window.addEventListener("storage", event => {
    if (event.key === CART_STORAGE_KEY) actualizarCarritoPorCambio();
});

actualizarContador(leerCarrito().reduce((total, entrada) => total + entrada.quantity, 0));
