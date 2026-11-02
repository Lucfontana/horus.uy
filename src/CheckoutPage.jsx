import { useState } from "react";
import { Link } from "react-router-dom";
import Cart from "./Cart.jsx";

const currency = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" });

export default function CheckoutPage({ entries, update, status }) {
    const [message, setMessage] = useState("");
    const total = entries.reduce((sum, entry) => sum + entry.price * entry.quantity, 0);
    return <main className="checkout-main">
        <div className="checkout-heading"><p className="eyebrow">Horus Uruguay</p><h1>Tu compra</h1></div>
        <div className="checkout-layout">
            <section className="checkout-products" aria-label="Productos en tu carrito">
                <div className="checkout-products__labels" aria-hidden="true"><span>Producto</span><span>Cantidad</span><span>Precio</span><span /></div>
                <div className="checkout-items" aria-live="polite">{status === "ready" ? <Cart entries={entries} update={update} /> : <p role="status">{status === "error" ? "No se pudieron actualizar los precios. Recargá la página para reintentar." : "Actualizando precios..."}</p>}</div>
            </section>
            <aside className="checkout-summary" aria-labelledby="summary-title"><h2 id="summary-title">Resumen de compra</h2>
                <form className="checkout-discount" onSubmit={event => { event.preventDefault(); setMessage("Los cupones todavía no están disponibles."); }}>
                    <label className="visually-hidden" htmlFor="discount-code">Código de descuento</label><input id="discount-code" name="coupon" required placeholder="Ingresar cupón de descuento" /><button className="checkout-button checkout-button--apply">Aplicar</button>
                </form>
                <dl className="checkout-totals"><div><dt>Subtotal</dt><dd>{currency.format(total)}</dd></div><div className="checkout-totals__total"><dt>Total</dt><dd>{currency.format(total)}</dd></div></dl>
                <button className="checkout-button checkout-button--finish" type="button" disabled={!entries.length || status !== "ready"} onClick={() => setMessage("La compra en línea todavía no está habilitada. No se realizó ningún cobro.")}>Finalizar compra</button>
                <p role="status">{message}</p><Link className="checkout-continue" to="/catalogo">Seguir comprando</Link>
            </aside>
        </div>
    </main>;
}