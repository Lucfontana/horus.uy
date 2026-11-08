import { imagenProducto } from "./services/products.js";

const currency = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" });

export default function OrderItems({ entries }) {
    return <div>{entries.map((entry, index) => <article className="checkout-item" key={`${entry.productId}:${entry.color}:${entry.size}:${index}`}>
        <div className="checkout-item__product">
            <img className="checkout-item__image" src={imagenProducto(entry.imgSrc)} alt={entry.name} />
            <div className="checkout-item__info">
                <h3 className="checkout-item__name">{entry.name}</h3>
                <p className="checkout-item__category">Color: {entry.color} · Talle: {entry.size}</p>
            </div>
        </div>
        <span className="checkout-order__quantity">Cantidad: {entry.quantity}</span>
        <span className="checkout-item__price">{currency.format(entry.price * entry.quantity)}</span>
    </article>)}</div>;
}
