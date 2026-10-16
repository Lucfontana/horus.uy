import { obtenerProductos } from "./load_products.js";
import { CART_STORAGE_KEY, guardarIdsCarrito, leerIdsCarrito } from "./cart_storage.js";
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

function crearFilaCarrito(producto, cantidad) {
    const fila = document.createElement("article");
    fila.className = "checkout-item";
    fila.dataset.productId = String(producto.id);

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
    informacion.append(nombre, categoria);
    productoInfo.append(imagen, informacion);

    const cantidadControl = document.createElement("div");
    cantidadControl.className = "checkout-item__quantity";
    cantidadControl.setAttribute("aria-label", `Cantidad de ${producto.name}: ${cantidad}`);

    const disminuir = document.createElement("button");
    disminuir.type = "button";
    disminuir.dataset.action = "decrease";
    disminuir.textContent = "−";
    disminuir.disabled = cantidad <= 1;
    disminuir.setAttribute("aria-label", `Disminuir cantidad de ${producto.name}`);

    const valorCantidad = document.createElement("span");
    valorCantidad.className = "checkout-item__quantity-value";
    valorCantidad.textContent = String(cantidad);

    const aumentar = document.createElement("button");
    aumentar.type = "button";
    aumentar.dataset.action = "increase";
    aumentar.textContent = "+";
    aumentar.setAttribute("aria-label", `Aumentar cantidad de ${producto.name}`);

    cantidadControl.append(disminuir, valorCantidad, aumentar);

    const precio = document.createElement("span");
    precio.className = "checkout-item__price";
    precio.textContent = formatearPrecio(Number(producto.price) * cantidad);

    const eliminar = document.createElement("button");
    eliminar.type = "button";
    eliminar.className = "checkout-item__remove";
    eliminar.dataset.action = "remove";
    eliminar.textContent = "×";
    eliminar.setAttribute("aria-label", `Eliminar ${producto.name} del carrito`);

    fila.append(productoInfo, cantidadControl, precio, eliminar);
    return fila;
}

function renderizarCarrito(productos) {
    const ids = leerIdsCarrito();
    const productosPorId = new Map(productos.map(producto => [String(producto.id), producto]));
    const cantidades = new Map();
    ids.forEach(id => cantidades.set(id, (cantidades.get(id) || 0) + 1));
    const seleccionados = Array.from(cantidades, ([id, cantidad]) => ({
        producto: productosPorId.get(id),
        cantidad
    })).filter(item => item.producto);

    cartItems.replaceChildren();

    if (seleccionados.length === 0) {
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
        seleccionados.forEach(({ producto, cantidad }) =>
            cartItems.appendChild(crearFilaCarrito(producto, cantidad))
        );
    }

    const subtotal = seleccionados.reduce(
        (total, { producto, cantidad }) => total + Number(producto.price) * cantidad,
        0
    );
    subtotalElement.textContent = formatearPrecio(subtotal);
    totalElement.textContent = formatearPrecio(subtotal);

    const idsValidos = seleccionados.flatMap(({ producto, cantidad }) =>
        Array(cantidad).fill(String(producto.id))
    );
    if (idsValidos.length !== ids.length) guardarIdsCarrito(idsValidos);
}

cartItems.addEventListener("click", event => {
    const boton = event.target.closest("button[data-action]");
    if (!boton) return;

    const fila = boton.closest(".checkout-item");
    const id = fila.dataset.productId;
    let ids = leerIdsCarrito();

    if (boton.dataset.action === "remove") {
        ids = ids.filter(productId => productId !== id);
    } else if (boton.dataset.action === "increase") {
        ids.push(id);
    } else {
        if (ids.filter(productId => productId === id).length <= 1) return;
        const index = ids.indexOf(id);
        if (index !== -1) ids.splice(index, 1);
    }

    guardarIdsCarrito(ids);
    renderizarCarrito(productosDisponibles);
});

window.addEventListener("storage", event => {
    if (event.key === CART_STORAGE_KEY) renderizarCarrito(productosDisponibles);
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