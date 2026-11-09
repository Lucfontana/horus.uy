export async function obtenerProductos(signal) {
    const respuesta = await fetch("/api/products", { signal });
    if (!respuesta.ok) throw new Error("No se pudieron cargar los productos.");
    const datos = await respuesta.json();
    return Object.entries(datos.items).map(([id, producto]) => ({ ...producto, id }));
}

export async function obtenerPaginaProductos(searchParams, page, signal) {
    const query = new URLSearchParams({ page: String(page), limit: "12" });
    for (const [source, target] of [
        ["categoria", "category"], ["color", "color"], ["talle", "size"],
        ["precioMin", "minPrice"], ["precioMax", "maxPrice"], ["sort", "sort"]
    ]) {
        for (const value of searchParams.getAll(source)) query.append(target, value);
    }
    const respuesta = await fetch(`/api/products?${query}`, { signal });
    if (!respuesta.ok) throw new Error("No se pudieron cargar los productos.");
    const datos = await respuesta.json();
    return {
        ...datos,
        products: Object.entries(datos.items).map(([id, product]) => ({ ...product, id }))
    };
}

export function imagenProducto(ruta) {
    if (!ruta) return "/frontend/src/placeholder.png";
    if (/^(https?:|data:|\/)/.test(ruta)) return ruta;
    return `/frontend/${ruta.replace(/^\.\//, "")}`;
}