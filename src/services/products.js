export async function obtenerProductos(signal) {
    const respuesta = await fetch("/api/products", { signal });
    if (!respuesta.ok) throw new Error("No se pudieron cargar los productos.");
    const datos = await respuesta.json();
    return Object.entries(datos.items).map(([id, producto]) => ({ ...producto, id }));
}

export function imagenProducto(ruta) {
    if (!ruta) return "/frontend/src/placeholder.png";
    if (/^(https?:|data:|\/)/.test(ruta)) return ruta;
    return `/frontend/${ruta.replace(/^\.\//, "")}`;
}