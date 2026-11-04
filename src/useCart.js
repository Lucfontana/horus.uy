import { useCallback, useEffect, useRef, useState } from "react";
import { CART_STORAGE_KEY, CART_UPDATED_EVENT, claveEntradaCarrito, guardarCarrito, leerCarrito } from "../backend/cart_storage.js";
import { solicitar } from "./services/api.js";

const pendingMergeKey = "horus-cart-pending-merge";
const cartChangedKey = "horus-account-cart-changed";

function withGuestLock(action) {
    return navigator.locks
        ? navigator.locks.request("horus-guest-cart", action)
        : action();
}

function notifyOtherTabs() {
    try { localStorage.setItem(cartChangedKey, crypto.randomUUID()); }
    catch (error) { console.error("No se pudo notificar el cambio de carrito a otras pestañas:", error); }
}

export function useCart(auth) {
    const userId = auth.user?.id || null;
    const owner = auth.status === "ready" ? userId || "guest" : null;
    const [state, setState] = useState({ owner: null, entries: [], status: "loading", version: 0, message: "" });
    const busy = useRef(false);
    const synchronizing = useRef(0);
    const currentOwner = useRef(owner);
    useEffect(() => { currentOwner.current = owner; }, [owner]);

    const synchronize = useCallback(async () => {
        if (!owner) return;
        synchronizing.current += 1;
        try {
            await withGuestLock(async () => {
                if (!userId) {
                    if (currentOwner.current === owner) {
                        setState({ owner, entries: leerCarrito(), status: "ready", version: 0, message: "" });
                    }
                    return;
                }
                let pending;
                try {
                    pending = JSON.parse(localStorage.getItem(pendingMergeKey) || "null");
                } catch {
                    throw new Error("No se pudo recuperar el carrito pendiente de combinar de este dispositivo.");
                }
                const guestEntries = leerCarrito();
                if (pending && pending.userId !== userId) {
                    throw new Error("Hay una combinación pendiente de otra cuenta. Iniciá sesión con esa cuenta para completarla.");
                }
                if (!pending && guestEntries.length) {
                    pending = { userId, mergeId: crypto.randomUUID(), entries: guestEntries };
                    localStorage.setItem(pendingMergeKey, JSON.stringify(pending));
                }
                const result = pending
                    ? await solicitar("/api/cart/merge", {
                        method: "POST", headers: { "X-Cart-User": userId },
                        body: JSON.stringify({ mergeId: pending.mergeId, entries: pending.entries })
                    })
                    : await solicitar("/api/cart", { headers: { "X-Cart-User": userId } });
                if (result.userId !== userId) {
                    window.dispatchEvent(new Event("horus-session-changed"));
                    throw new Error("La sesión cambió en otra pestaña. Actualizá tu cuenta antes de continuar.");
                }
                if (pending) {
                    if (!guardarCarrito([])) throw new Error("Tu carrito se guardó, pero no se pudo limpiar el carrito de invitado. Reintentá para completar la sincronización.");
                    localStorage.removeItem(pendingMergeKey);
                    notifyOtherTabs();
                }
                if (currentOwner.current === owner) {
                    setState(previous => previous.owner === owner && previous.version > result.version
                        ? previous : { owner, ...result, status: "ready", message: result.warnings.join(" ") });
                    if (pending && result.merged) {
                        window.alert(`Combinamos el carrito de este dispositivo con el de tu cuenta. Te recomendamos verificar que estén todos los productos y cantidades que deseás antes de comprar.${result.warnings.length ? `\n\n${result.warnings.join("\n")}` : ""}`);
                    }
                }
            });
        } catch (error) {
            if (error.status === 401 || error.status === 409) window.dispatchEvent(new Event("horus-session-changed"));
            if (currentOwner.current === owner) {
                setState({ owner, entries: [], version: 0, status: "error", message: error.message });
            }
        } finally {
            synchronizing.current -= 1;
        }
    }, [owner, userId]);

    useEffect(() => {
        synchronize();
        const onStorage = event => {
            if ([CART_STORAGE_KEY, cartChangedKey, null].includes(event.key)) synchronize();
        };
        window.addEventListener(CART_UPDATED_EVENT, synchronize);
        window.addEventListener("storage", onStorage);
        window.addEventListener("focus", synchronize);
        return () => {
            window.removeEventListener(CART_UPDATED_EVENT, synchronize);
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("focus", synchronize);
        };
    }, [synchronize]);

    async function mutate(entry, quantity, adding) {
        if (!owner || state.owner !== owner || state.status !== "ready") {
            throw new Error("Esperá a que se sincronice tu carrito o reintentá si ocurrió un error.");
        }
        if (busy.current) throw new Error("Se está guardando tu carrito. Esperá un momento.");
        busy.current = true;
        try {
            if (userId) {
                const previous = state.entries.find(item => claveEntradaCarrito(item) === claveEntradaCarrito(entry));
                const nextQuantity = adding ? Math.min(15, (previous?.quantity || 0) + entry.quantity) : quantity;
                const result = await solicitar("/api/cart/entry", {
                    method: "PUT", headers: { "X-Cart-User": userId },
                    body: JSON.stringify({ entry: { ...entry, quantity: nextQuantity }, version: state.version })
                });
                if (result.userId !== userId) {
                    window.dispatchEvent(new Event("horus-session-changed"));
                    throw new Error("La sesión cambió. Revisá tu cuenta antes de continuar.");
                }
                if (currentOwner.current === owner) {
                    setState(previous => previous.owner === owner && previous.version > result.version
                        ? previous : { owner, ...result, status: "ready", message: result.warnings.join(" ") });
                }
                notifyOtherTabs();
            } else {
                await withGuestLock(async () => {
                    try {
                        await solicitar("/api/session");
                    } catch (error) {
                        if (error.status !== 401) throw error;
                        const entries = leerCarrito();
                        const key = claveEntradaCarrito(entry);
                        const next = adding ? [...entries, entry] : quantity === 0
                            ? entries.filter(item => claveEntradaCarrito(item) !== key)
                            : entries.map(item => claveEntradaCarrito(item) === key ? { ...item, quantity } : item);
                        if (!guardarCarrito(next)) throw new Error("No se pudo guardar el carrito en este dispositivo.");
                        return;
                    }
                    window.dispatchEvent(new Event("horus-session-changed"));
                    throw new Error("Iniciaste sesión en otra pestaña. Esperá a que se sincronice el carrito y reintentá.");
                });
            }
        } catch (error) {
            if (error.status === 401) window.dispatchEvent(new Event("horus-session-changed"));
            if (error.status === 409) await synchronize();
            throw error;
        } finally {
            busy.current = false;
        }
    }

    return {
        entries: state.owner === owner && owner ? state.entries : [],
        status: auth.status === "error" ? "error" : state.owner === owner && owner ? state.status : "loading",
        message: state.owner === owner ? state.message : "",
        update: (entry, quantity) => mutate(entry, quantity, false),
        add: entry => mutate(entry, entry.quantity, true),
        synchronize,
        canLogout: () => !busy.current && synchronizing.current === 0
    };
}
