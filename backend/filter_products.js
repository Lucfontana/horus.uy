formularioFiltros = document.getElementById("formularioFiltros")

formularioFiltros.addEventListener("submit", (e) => retrieveFiltros(e))
function retrieveFiltros(e){
    e.preventDefault()
    console.log("boton apretau")
}

function aplicarFiltros(productos, filtros) {
    let resultado = productos;
    resultado = filtrarPorCategoria(resultado, filtros.categoria);
    resultado = filtrarPorColor(resultado, filtros.color);
    resultado = filtrarPorPrecio(resultado, filtros.precioMin, filtros.precioMax);
    resultado = filtrarPorTalle(resultado, filtros.talle);
    return resultado;
}

function filtrarPorCategoria(productos, filtros){

}

function filtrarPorColor(productos, filtros){

}

function filtrarPorPrecio(productos, filtros){

}

function filtrarPorTalle(productos, filtros){

}



