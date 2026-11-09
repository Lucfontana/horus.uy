import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Cart from "./Cart.jsx";
import { solicitar } from "./services/api.js";

const currency = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" });

export default function CheckoutPage({ entries, update, status, auth }) {
    const [message, setMessage] = useState("");
    const [code, setCode] = useState("");
    const [coupon, setCoupon] = useState(null);
    const [applying, setApplying] = useState(false);
    const navigate = useNavigate();
    const subtotal = entries.reduce((sum, entry) => sum + entry.price * entry.quantity, 0);
    const discount = coupon ? Math.round((subtotal * coupon.discountPercent / 100 + Number.EPSILON) * 100) / 100 : 0;
    const total = subtotal - discount;

    async function applyCoupon(event) {
        event.preventDefault();
        if (applying) return;
        setApplying(true);
        setMessage("");
        try {
            const result = await solicitar("/api/coupons/validate", {
                method: "POST",
                body: JSON.stringify({ code })
            });
            setCoupon(result);
            setCode(result.code);
            setMessage(`Cupón aplicado: ${result.discountPercent}% de descuento.`);
        } catch (error) {
            setCoupon(null);
            setMessage(error.message);
        } finally {
            setApplying(false);
        }
    }

    function finishPurchase() {
        if (auth.user) {
            navigate("/datos-envio", { state: { couponCode: coupon?.code || "" } });
        } else {
            navigate("/login", {
                state: { checkout: { path: "/datos-envio", couponCode: coupon?.code || "" } }
            });
        }
    }

    return <main className="checkout-main">
        <div className="checkout-heading"><p className="eyebrow">Horus Uruguay</p><h1>Tu compra</h1></div>
        <div className="checkout-layout">
            <section className="checkout-products" aria-label="Productos en tu carrito">
                <div className="checkout-products__labels" aria-hidden="true"><span>Producto</span><span>Cantidad</span><span>Precio</span><span /></div>
                <div className="checkout-items" aria-live="polite">{status === "ready" ? <Cart entries={entries} update={update} /> : <p role="status">{status === "error" ? "No se pudieron actualizar los precios. Recargá la página para reintentar." : "Actualizando precios..."}</p>}</div>
            </section>
            <aside className="checkout-summary" aria-labelledby="summary-title"><h2 id="summary-title">Resumen de compra</h2>
                <form className="checkout-discount" onSubmit={applyCoupon}>
                    <label className="visually-hidden" htmlFor="discount-code">Código de descuento</label><input id="discount-code" name="coupon" value={code} onChange={event => { setCode(event.target.value); setCoupon(null); setMessage(""); }} maxLength="80" required placeholder="Ingresar cupón de descuento" /><button className="checkout-button checkout-button--apply" disabled={applying}>{applying ? "Aplicando..." : "Aplicar"}</button>
                </form>
                <dl className="checkout-totals"><div><dt>Subtotal</dt><dd>{currency.format(subtotal)}</dd></div>{coupon && <div><dt>Descuento ({coupon.discountPercent}%)</dt><dd>−{currency.format(discount)}</dd></div>}<div className="checkout-totals__total"><dt>Total</dt><dd>{currency.format(total)}</dd></div></dl>
                <button className="checkout-button checkout-button--finish" type="button" disabled={!entries.length || status !== "ready"} onClick={finishPurchase}>Finalizar compra</button>
                <p role="status" aria-live="polite">{message}</p><Link className="checkout-continue" to="/catalogo">Seguir comprando</Link>
            </aside>
        </div>
    </main>;
}