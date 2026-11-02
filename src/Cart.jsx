import { Minus, Plus, Trash2 } from "lucide-react";
import { claveEntradaCarrito } from "../backend/cart_storage.js";
import { imagenProducto } from "./services/products.js";

const currency = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" });

export default function Cart({ entries, update }) {
    if (!entries.length) return <div className="checkout-empty"><p>Tu carrito está vacío.</p><a href="#/catalogo">Descubrir productos</a></div>;
    return <div>{entries.map(entry => <article className="checkout-item" key={claveEntradaCarrito(entry)}>
        <div className="checkout-item__product">
            <img className="checkout-item__image" src={imagenProducto(entry.imgSrc)} alt={entry.name} />
            <div className="checkout-item__info">
                <a href={`#/producto?id=${encodeURIComponent(entry.productId)}`} className="checkout-item__name">{entry.name}</a>
                <p className="checkout-item__category">Color: {entry.color} · Talle: {entry.size}</p>
            </div>
        </div>
        <div className="checkout-item__quantity">
            <button type="button" title="Disminuir cantidad" aria-label={`Disminuir cantidad de ${entry.name}`} disabled={entry.quantity <= 1} onClick={() => update(entry, entry.quantity - 1)}><Minus size={16} /></button>
            <span aria-label="Cantidad">{entry.quantity}</span>
            <button type="button" title="Aumentar cantidad" aria-label={`Aumentar cantidad de ${entry.name}`} disabled={entry.quantity >= 15} onClick={() => update(entry, entry.quantity + 1)}><Plus size={16} /></button>
        </div>
        <span className="checkout-item__price">{currency.format(entry.price * entry.quantity)}</span>
        <button type="button" className="checkout-item__remove" title="Eliminar producto" aria-label={`Eliminar ${entry.name}`} onClick={() => update(entry, 0)}><Trash2 size={18} /></button>
    </article>)}</div>;
}