//Mi hoja de calculos
console.log("Calculadora del marketplace");

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
        return
    }

    if (cantidad <= 0){
        return
    }

    return stock - cantidad
}

let stock = 100
let cantidad = 0
console.log(`Restaste ${cantidad} items del stock, ahora quedan ${restarStock(stock, cantidad)} en el stock`);