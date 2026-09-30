export const CART_STORAGE_KEY = "horus-cart";

export function leerIdsCarrito() {
    try {
        const ids = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
        return Array.isArray(ids) ? ids.map(String) : [];
    } catch (error) {
        console.error("No se pudo leer el carrito:", error);
        return [];
    }
}

export function guardarIdsCarrito(ids) {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(ids));
    } catch (error) {
        console.error("No se pudo guardar el carrito:", error);
    }
}