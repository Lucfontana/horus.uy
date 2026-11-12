export function construirFiltros(origen, precioMinDefault, precioMaxDefault) {
    return {
        categoria: origen.getAll("categoria"),
        color: origen.getAll("color"),
        talle: origen.getAll("talle"),
        precioMin: origen.has("precioMin") ? Number(origen.get("precioMin")) : precioMinDefault,
        precioMax: origen.has("precioMax") ? Number(origen.get("precioMax")) : precioMaxDefault,
    };
}