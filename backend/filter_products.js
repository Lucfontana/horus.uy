export function construirFiltros(origen, precioMinDefault, precioMaxDefault) {
    return {
        categoria: origen.getAll("categoria"),
        color: origen.getAll("color"),
        talle: origen.getAll("talle"),
        precioMin: origen.has("precioMin") ? Number(origen.get("precioMin")) : precioMinDefault,
        precioMax: origen.has("precioMax") ? Number(origen.get("precioMax")) : precioMaxDefault,
    };
}

export function aplicarFiltros(productos, filtros) {
    let resultado = productos;
    resultado = filtrarPorCategoria(resultado, filtros.categoria);
    resultado = filtrarPorColor(resultado, filtros.color);
    resultado = filtrarPorPrecio(resultado, filtros.precioMin, filtros.precioMax);
    resultado = filtrarPorTalle(resultado, filtros.talle);
    return resultado;
}

export function filtrarPorCategoria(productos, categoriasSeleccionadas) {
    if (categoriasSeleccionadas.length === 0) return productos;
    return productos.filter(producto =>
        producto.categories.some(cat =>
            categoriasSeleccionadas.includes(cat.toLowerCase())
        )
    );
}

export function filtrarPorColor(productos, coloresSeleccionados) {
    if (coloresSeleccionados.length === 0) return productos;
    return productos.filter(producto =>
        producto.colors.some(color =>
            coloresSeleccionados.includes(color.toLowerCase())
        )
    );
}

export function filtrarPorPrecio(productos, precioMin, precioMax) {
    return productos.filter(producto =>
        producto.price >= precioMin && producto.price <= precioMax
    );
}

export function filtrarPorTalle(productos, tallesSeleccionados) {
    if (tallesSeleccionados.length === 0) return productos;
    return productos.filter(producto =>
        producto.size.some(talle => tallesSeleccionados.includes(talle))
    );
}