//Mi hoja de calculos
console.log("Calculadora del marketplace");
/*
    FUNCIÓN 1
    Calcula el precio de un producto después de aplicar un descuento.
*/
// function calcularPrecioConDescuento(precio, procentajeDescuento){
//     const valorDescuento = precio * (procentajeDescuento /100 );
//     const preciofinal = precio - valorDescuento;
//     return preciofinal;
// }
// /*
//     FUNCIÓN 2
//     Calcula el precio de un producto después de agregar un impuesto.
// */
// function calcularPrecioConImpuesto(precio, porcentajeImpuesto) {
//     const valorImpuesto = precio * (porcentajeImpuesto / 100);
//     const precioFinal = precio + valorImpuesto;
//     return precioFinal;
// }
// /*
//     FUNCIÓN 3
//     Calcula el total de un pedido teniendo en cuenta:
//     precio unitario, cantidad de productos y costo de envío.
// */
// function calcularTotalPedido(precioUnitario, cantidad, costoEnvio) {
//     if(cantidad > 5){
//         costoEnvio = 0;
//         console.log("El envío es gratis por comprar más de 5 productos");
//     }
//     const subtotal = precioUnitario * cantidad;
//     let totalPedido = subtotal + costoEnvio;
//     if(totalPedido > 100000){
//        totalPedido = calcularPrecioConDescuento(totalPedido, 10);
//         console.log("¡Felicidades! Has superado el umbral de $100,000 en tu pedido.");
//     }
//     return totalPedido;
// }


// const precioDescuento = calcularPrecioConDescuento(100000,50);
// console.log("El precio con descuento es: " + precioDescuento);
// const resultadoPedido = calcularTotalPedido(150000, 6, 5000);
// console.log("Total del pedido:" + resultadoPedido);
// const precioImpuesto = calcularPrecioConImpuesto(100000, 10);
// console.log("El precio con impuesto es: " + precioImpuesto);




// FUNCIONES PROPIAS

// Carrito de ejemplo
let carritoEjemplo = [
    {
        name: "Milanesa",
        cantidad: 3,
        precio: 1200
    },
    {
        name: "Alfajor",
        cantidad: 1,
        precio: 20
    }
]

//Recorre los objetos del carrito y va calculando segun la cantidad 
function calcularTotalCarrito(carrito){
    let total = 0;
    
    carrito.forEach((item) => {
        total += item.cantidad * item.precio
    })

    return total
}

console.log(`El precio total del carrito es de: ${calcularTotalCarrito(carritoEjemplo)}`)


function restarStock(stock, cantidad){
    if (cantidad > stock){
        return "La cantidad de elementos comprados es mayor al stock, vuelva a intentarlo"
    }

    if (cantidad <= 0){
        return "No puedes comprar items negativos"
    }

    return stock - cantidad
}

let stock = 100
let cantidad = 0
console.log(`Restaste ${cantidad} items del stock, ahora quedan ${restarStock(stock, cantidad)} en el stock`);