import { obtenerProductos } from "./load_products.js";
import { CART_STORAGE_KEY, guardarIdsCarrito, leerIdsCarrito } from "./cart_storage.js";
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

function actualizarContador(cantidad) {
    cartBadge.textContent = cantidad;
    cartBadge.hidden = cantidad === 0;
    cartButton.setAttribute(
        "aria-label",
        `Ver carrito (${cantidad} ${cantidad === 1 ? "producto" : "productos"})`
    );
}

function formatearPrecio(precio) {
    return `$ ${Number(precio).toLocaleString("es-UY")}`;
}

function crearFilaCarrito(producto, cantidad) {
    const fila = document.createElement("article");
    fila.className = "cart-item";
    fila.dataset.productId = String(producto.id);
    fila.dataset.quantity = String(cantidad);
    fila.dataset.unitPrice = String(Number(producto.price));

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

    const detalles = document.createElement("div");
    detalles.className = "cart-item__details";

    const cantidadControl = document.createElement("div");
    cantidadControl.className = "cart-item__qty";
    cantidadControl.setAttribute("aria-label", `Cantidad: ${cantidad}`);

    const disminuir = document.createElement("button");
    disminuir.type = "button";
    disminuir.className = "cart-item__quantity-btn";
    disminuir.dataset.action = "decrease";
    disminuir.textContent = "−";
    disminuir.setAttribute("aria-label", `Disminuir cantidad de ${producto.name}`);

    const valorCantidad = document.createElement("span");
    valorCantidad.className = "cart-item__quantity-value";
    valorCantidad.textContent = String(cantidad);

    const aumentar = document.createElement("button");
    aumentar.type = "button";
    aumentar.className = "cart-item__quantity-btn";
    aumentar.dataset.action = "increase";
    aumentar.textContent = "+";
    aumentar.setAttribute("aria-label", `Aumentar cantidad de ${producto.name}`);

    cantidadControl.append(disminuir, valorCantidad, aumentar);

    const precio = document.createElement("span");
    precio.className = "cart-item__price";
    precio.textContent = formatearPrecio(producto.price);

    const eliminar = document.createElement("button");
    eliminar.type = "button";
    eliminar.className = "cart-item__remove";
    eliminar.textContent = "\u00d7";
    eliminar.setAttribute("aria-label", `Eliminar ${producto.name} del carrito`);

    detalles.append(cantidadControl, precio);
    informacion.append(nombre, detalles);
    fila.append(imagen, informacion, eliminar);
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
    seleccionados.forEach(({ producto, cantidad }) =>
        cartItems.appendChild(crearFilaCarrito(producto, cantidad))
    );

    if (seleccionados.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "cart-empty";
        vacio.textContent = "Tu carrito está vacío.";
        cartItems.appendChild(vacio);
    }

    const subtotal = seleccionados.reduce(
        (total, { producto, cantidad }) => total + Number(producto.price) * cantidad,
        0
    );
    cartSubtotal.textContent = formatearPrecio(subtotal);
    actualizarContador(seleccionados.reduce((total, item) => total + item.cantidad, 0));

    const idsValidos = seleccionados.flatMap(({ producto, cantidad }) =>
        Array(cantidad).fill(String(producto.id))
    );
    if (idsValidos.length !== ids.length) {
        guardarIdsCarrito(idsValidos);
    }
}

cartItems.addEventListener("click", event => {
    const botonEliminar = event.target.closest(".cart-item__remove");
    const botonCantidad = event.target.closest(".cart-item__quantity-btn");
    if (!botonEliminar && !botonCantidad) return;

    const fila = event.target.closest(".cart-item");
    const id = fila.dataset.productId;
    let ids = leerIdsCarrito();

    if (botonEliminar) {
        ids = ids.filter(productId => productId !== id);
    } else if (botonCantidad.dataset.action === "increase") {
        ids.push(id);
    } else {
        const index = ids.indexOf(id);
        if (index !== -1) ids.splice(index, 1);
    }

    guardarIdsCarrito(ids);
    renderizarCarrito(productosDisponibles);
});

document.addEventListener("click", event => {
    const botonAgregar = event.target.closest(".product-card__cart");
    if (!botonAgregar) return;

    const ids = leerIdsCarrito();
    ids.push(botonAgregar.dataset.productId);
    guardarIdsCarrito(ids);
    actualizarContador(ids.length);
    if (cartDrawer.classList.contains("is-open") && productosDisponibles.length) {
        renderizarCarrito(productosDisponibles);
    }
});

cartButton.addEventListener("click", async () => {
    cartItems.replaceChildren(cartLoader);
    try {
        const productos = await obtenerProductos(true);
        productosDisponibles = productos;
        renderizarCarrito(productos);
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

window.addEventListener("storage", event => {
    if (event.key === CART_STORAGE_KEY) {
        actualizarContador(leerIdsCarrito().length);
        if (cartDrawer.classList.contains("is-open") && productosDisponibles.length) {
            renderizarCarrito(productosDisponibles);
        }
    }
});

actualizarContador(leerIdsCarrito().length);