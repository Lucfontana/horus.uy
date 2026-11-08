import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import OrderItems from "./OrderItems.jsx";
import { solicitar } from "./services/api.js";

const currency = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" });
const validPhone = value => /^(?:598\d{8}|09\d{7})$/.test(value);

function restrictPhone(value) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits.startsWith("09") ? digits.slice(0, 9) : digits;
}

export default function ShippingPage({ entries, status, synchronize }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [order, setOrder] = useState(null);
    const addressIsValid = address.trim().length >= 15 && address.trim().length <= 240;
    const canSubmit = addressIsValid && validPhone(phone) && entries.length > 0 && status === "ready";

    async function placeOrder(event) {
        event.preventDefault();
        if (!canSubmit || busy) return;
        const whatsappWindow = window.open("about:blank", "_blank");
        if (whatsappWindow) whatsappWindow.opener = null;
        setBusy(true);
        setMessage("");
        try {
            const created = await solicitar("/api/orders", {
                method: "POST",
                body: JSON.stringify({
                    address,
                    phone,
                    couponCode: location.state?.couponCode || ""
                })
            });
            setOrder(created);
            setMessage(created.warning || "Orden creada. Te abrimos WhatsApp para coordinar el envío.");
            await synchronize();
            if (whatsappWindow) whatsappWindow.location.href = created.whatsappUrl;
        } catch (error) {
            if (whatsappWindow) whatsappWindow.close();
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    }

    if (order) {
        return <main className="checkout-main">
            <div className="checkout-heading"><p className="eyebrow">Horus Uruguay</p><h1>Orden recibida</h1></div>
            <section className="checkout-products shipping-confirmation">
                <p>Tu orden <strong>{order.id}</strong> quedó registrada con estado <strong>{order.status}</strong>.</p>
                <p>Total: <strong>{currency.format(order.total)}</strong></p>
                <OrderItems entries={order.items} />
                <a className="checkout-button checkout-button--finish shipping-whatsapp" href={order.whatsappUrl} target="_blank" rel="noreferrer">Continuar a WhatsApp</a>
                <Link className="checkout-continue" to="/cuenta">Ver mis órdenes</Link>
            </section>
        </main>;
    }

    return <main className="checkout-main">
        <div className="checkout-heading"><p className="eyebrow">Horus Uruguay</p><h1>Datos de envío</h1></div>
        {status !== "ready" && <p role={status === "error" ? "alert" : "status"}>{status === "error" ? "No se pudo cargar tu carrito. Volvé al checkout para reintentar." : "Cargando tu carrito..."}</p>}
        {status === "ready" && !entries.length && <p role="alert">Tu carrito está vacío. <button type="button" className="account-link" onClick={() => navigate("/checkout")}>Volver al checkout</button></p>}
        {entries.length > 0 && <div className="checkout-layout shipping-layout">
            <section className="checkout-products" aria-label="Productos de la orden"><OrderItems entries={entries} /></section>
            <aside className="checkout-summary"><h2>Datos para el envío</h2>
                <form className="shipping-form" onSubmit={placeOrder}>
                    <label className="account-field">Dirección de casa
                        <textarea name="address" value={address} onChange={event => setAddress(event.target.value)} minLength="15" maxLength="240" rows="4" autoComplete="street-address" required aria-describedby="shipping-address-help" />
                    </label>
                    <small id="shipping-address-help" className="shipping-help">Ingresá al menos 15 caracteres.</small>
                    <label className="account-field">Número de celular
                        <input name="phone" type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={event => setPhone(restrictPhone(event.target.value))} maxLength="11" pattern="(?:598[0-9]{8}|09[0-9]{7})" placeholder="598... o 09..." required aria-describedby="shipping-phone-help" />
                    </label>
                    <small id="shipping-phone-help" className="shipping-help">Usá 598 seguido de 8 dígitos, o 09 seguido de 7 dígitos.</small>
                    <button className="checkout-button checkout-button--finish" type="submit" disabled={!canSubmit || busy}>{busy ? "Creando orden..." : "Finalizar pedido"}</button>
                </form>
                <p role="alert" aria-live="polite">{message}</p>
            </aside>
        </div>}
    </main>;
}
