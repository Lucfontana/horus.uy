import { useEffect, useState } from "react";
import { CART_STORAGE_KEY, CART_UPDATED_EVENT, claveEntradaCarrito, guardarCarrito, leerCarrito } from "../backend/cart_storage.js";

export function useCart() {
    const [entries, setEntries] = useState(leerCarrito);
    useEffect(() => {
        const synchronize = () => setEntries(leerCarrito());
        const onStorage = event => {
            if (event.key === CART_STORAGE_KEY || event.key === null) synchronize();
        };
        window.addEventListener(CART_UPDATED_EVENT, synchronize);
        window.addEventListener("storage", onStorage);
        return () => {
            window.removeEventListener(CART_UPDATED_EVENT, synchronize);
            window.removeEventListener("storage", onStorage);
        };
    }, []);

    function save(next) {
        if (!guardarCarrito(next)) throw new Error("No se pudo guardar el carrito en este dispositivo.");
        setEntries(leerCarrito());
    }

    function update(entry, quantity) {
        const key = claveEntradaCarrito(entry);
        save(quantity === 0
            ? entries.filter(item => claveEntradaCarrito(item) !== key)
            : entries.map(item => claveEntradaCarrito(item) === key
                ? { ...item, quantity: Math.max(1, Math.min(15, quantity)) } : item));
    }

    function add(entry) {
        save([...leerCarrito(), entry]);
    }

    return { entries, update, add };
}