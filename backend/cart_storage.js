export const CART_STORAGE_KEY = "horus-cart";
export const CART_UPDATED_EVENT = "horus-cart-updated";

export function claveEntradaCarrito(entrada) {
    return JSON.stringify([
        String(entrada.productId),
        entrada.color,
        entrada.size
    ]);
}

function normalizarCarrito(entradas) {
    if (!Array.isArray(entradas)) return [];

    const carrito = [];
    const indicesPorClave = new Map();
    entradas.forEach(entrada => {
        if (
            !entrada ||
            typeof entrada !== "object" ||
            Array.isArray(entrada) ||
            typeof entrada.productId !== "string" ||
            !entrada.productId ||
            typeof entrada.name !== "string" ||
            !entrada.name ||
            typeof entrada.imgSrc !== "string" ||
            !entrada.imgSrc ||
            !Number.isFinite(entrada.price) ||
            entrada.price < 0 ||
            typeof entrada.color !== "string" ||
            !entrada.color ||
            typeof entrada.size !== "string" ||
            !entrada.size ||
            !Number.isInteger(entrada.quantity) ||
            entrada.quantity < 1 ||
            entrada.quantity > 15
        ) return;

        const normalizada = {
            productId: entrada.productId,
            name: entrada.name,
            imgSrc: entrada.imgSrc,
            price: entrada.price,
            color: entrada.color,
            size: entrada.size,
            quantity: entrada.quantity
        };
        const clave = claveEntradaCarrito(normalizada);
        const indiceExistente = indicesPorClave.get(clave);
        if (indiceExistente === undefined) {
            indicesPorClave.set(clave, carrito.length);
            carrito.push(normalizada);
        } else {
            carrito[indiceExistente].quantity = Math.min(
                15,
                carrito[indiceExistente].quantity + normalizada.quantity
            );
        }
    });
    return carrito;
}

export function leerCarrito() {
    try {
        const guardado = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
        const carrito = normalizarCarrito(guardado);
        if (JSON.stringify(guardado) !== JSON.stringify(carrito)) {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(carrito));
        }
        return carrito;
    } catch (error) {
        console.error("No se pudo leer el carrito:", error);
        return [];
    }
}

export function guardarCarrito(entradas) {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalizarCarrito(entradas)));
        window.dispatchEvent(new Event(CART_UPDATED_EVENT));
        return true;
    } catch (error) {
        console.error("No se pudo guardar el carrito:", error);
        return false;
    }
}
