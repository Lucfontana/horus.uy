import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Save, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { solicitar } from "./services/api.js";

function PasswordField({ label, name, autoComplete, minLength }) {
    const [visible, setVisible] = useState(false);
    return <label className="account-field">{label}<span className="account-password">
        <input name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} maxLength="128" required />
        <button type="button" className="icon-btn" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    </span></label>;
}

export default function AccountPage({ auth, onAuthenticated, initialMode = "login" }) {
    const [mode, setMode] = useState(initialMode);
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const pageClassName = `account-page${auth.user ? "" : " account-page--standalone"}`;
    const backLink = <Link to="/" className="account-back"><ArrowLeft size={18} aria-hidden="true" />Volver</Link>;

    async function submit(event) {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        const values = Object.fromEntries(new FormData(form));
        setBusy(true);
        setMessage("");
        try {
            const user = await solicitar(mode === "register" ? "/api/register" : "/api/login", {
                method: "POST",
                body: JSON.stringify(values)
            });
            onAuthenticated(user);
            setMessage(mode === "register" ? "Tu cuenta se creó correctamente." : "Iniciaste sesión correctamente.");
        } catch (error) {
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function changePassword(event) {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        setBusy(true);
        setMessage("");
        try {
            const result = await solicitar("/api/change-password", {
                method: "PATCH",
                body: JSON.stringify(Object.fromEntries(new FormData(form)))
            });
            form.reset();
            setMessage(result.message);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    }

    if (auth.status === "loading") {
        return <main className={pageClassName}><section className="account-card">{backLink}<p role="status">Cargando tu cuenta...</p></section></main>;
    }
    if (auth.status === "error") {
        return <main className={pageClassName}><section className="account-card">{backLink}<p role="alert">No se pudo verificar tu sesión. Recargá la página para volver a intentar.</p></section></main>;
    }

    return <main className={pageClassName}>
        <section className="account-card">
            {!auth.user && backLink}
            {auth.user ? <>
                <header className="account-heading"><UserRound size={28} aria-hidden="true" /><div><p className="eyebrow">Tu cuenta</p><h1>Mi perfil</h1></div></header>
                <dl className="account-details">
                    <div><dt>Nombre</dt><dd>{auth.user.nombre} {auth.user.apellido}</dd></div>
                    <div><dt>Email</dt><dd>{auth.user.email}</dd></div>
                    <div><dt>Rol</dt><dd>{auth.user.role === "admin" ? "Administrador" : "Usuario"}</dd></div>
                    {auth.user.direccion && <div><dt>Dirección</dt><dd>{auth.user.direccion}</dd></div>}
                </dl>
                <h2>Cambiar contraseña</h2>
                <form className="account-form" onSubmit={changePassword}>
                    <PasswordField label="Contraseña actual" name="currentPassword" autoComplete="current-password" />
                    <PasswordField label="Nueva contraseña (mínimo 8 caracteres)" name="newPassword" autoComplete="new-password" minLength="8" />
                    <button className="admin-button" disabled={busy}><Save size={16} aria-hidden="true" />{busy ? "Guardando..." : "Actualizar contraseña"}</button>
                </form>
            </> : <>
                <header className="account-heading"><UserRound size={28} aria-hidden="true" /><div><p className="eyebrow">Horus Uruguay</p><h1>{mode === "register" ? "Crear cuenta" : "Iniciar sesión"}</h1></div></header>
                <form className="account-form" onSubmit={submit}>
                    {mode === "register" && <>
                        <label className="account-field">Nombre<input name="nombre" type="text" autoComplete="given-name" maxLength="80" required /></label>
                        <label className="account-field">Apellido<input name="apellido" type="text" autoComplete="family-name" maxLength="80" required /></label>
                    </>}
                    <label className="account-field">Email<input name="email" type="email" autoComplete="email" maxLength="254" required /></label>
                    <PasswordField label={mode === "register" ? "Contraseña (mínimo 8 caracteres)" : "Contraseña"} name="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? "8" : undefined} />
                    <button className="admin-button" disabled={busy}>{busy ? "Enviando..." : mode === "register" ? "Crear cuenta" : "Iniciar sesión"}</button>
                </form>
                <p className="account-switch">{mode === "register" ? "¿Ya tenés cuenta?" : "¿Todavía no tenés cuenta?"}{" "}
                    <button type="button" className="account-link" onClick={() => { setMode(mode === "register" ? "login" : "register"); setMessage(""); }}>
                        {mode === "register" ? "Iniciar sesión" : "Registrarme"}
                    </button>
                </p>
            </>}
            <p className="account-message" role={message && /no se pudo|incorrect|válid|existe/i.test(message) ? "alert" : "status"}>{message}</p>
        </section>
    </main>;
}
