import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { Link } from "react-router-dom";
import { solicitar } from "./services/api.js";

export default function AssistantChat({ open, visible, onClose }) {
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const input = useRef(null);
    const transcript = useRef(null);
    const active = open && visible;

    useEffect(() => {
        if (open && !visible) onClose();
    }, [open, visible, onClose]);

    useEffect(() => {
        if (active) input.current?.focus();
    }, [active]);

    useEffect(() => {
        if (!active) return undefined;
        function closeOnEscape(event) {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                window.requestAnimationFrame(() => document.getElementById("assistant-trigger")?.focus());
            }
        }
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [active, onClose]);

    useEffect(() => {
        if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
    }, [messages, sending]);

    async function sendMessage(event) {
        event.preventDefault();
        const content = draft.trim();
        if (!content || sending) return;

        const history = messages.slice(-10).map(({ role, content: text }) => ({ role, content: text }));
        setMessages(current => [...current, { role: "user", content }]);
        setDraft("");
        setSending(true);
        try {
            const result = await solicitar("/api/chat", {
                method: "POST",
                body: JSON.stringify({ message: content, history })
            });
            setMessages(current => [...current, {
                role: "assistant",
                content: result.answer,
                needsHuman: result.needsHuman,
                needsCatalog: result.needsCatalog
            }]);
        } catch (error) {
            const limited = error.status === 429;
            setMessages(current => [...current, {
                role: "assistant",
                content: limited ? error.message : "No es posible responder en este momento. Puede consultar con una persona por Instagram o mediante el formulario de contacto.",
                needsHuman: !limited
            }]);
        } finally {
            setSending(false);
        }
    }

    function closeAndRestoreFocus() {
        onClose();
        window.requestAnimationFrame(() => document.getElementById("assistant-trigger")?.focus());
    }

    function goToContactForm() {
        onClose();
        window.requestAnimationFrame(() => {
            document.getElementById("contacto-titulo")?.scrollIntoView({ behavior: "smooth", block: "start" });
            document.getElementById("contact-name")?.focus({ preventScroll: true });
        });
    }

    return <section className={`assistant-chat${active ? " is-open" : ""}`} role="dialog" aria-labelledby="assistant-title" aria-hidden={!active} inert={!active}>
        <header className="assistant-chat__header">
            <div><p className="assistant-chat__eyebrow">Atención Horus</p><h2 id="assistant-title">Asistente IA</h2></div>
            <button type="button" className="assistant-chat__close" aria-label="Cerrar chat" title="Cerrar chat" onClick={closeAndRestoreFocus}><X size={20} /></button>
        </header>
        <div className="assistant-chat__messages" ref={transcript} aria-live="polite" aria-relevant="additions text">
            {messages.map((message, index) => <article className={`assistant-chat__message assistant-chat__message--${message.role}`} key={`${index}-${message.role}`}>
                <p>{message.content}</p>
                {message.needsCatalog && <div className="assistant-chat__handoff"><Link to="/catalogo" onClick={onClose}>Ver catálogo y utilizar filtros</Link></div>}
                {message.needsHuman && <div className="assistant-chat__handoff">
                    <a href="https://instagram.com/horus.uy" target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" />Instagram de Horus</a>
                    <button type="button" onClick={goToContactForm}>Formulario de contacto</button>
                </div>}
            </article>)}
            {sending && <div className="assistant-chat__message assistant-chat__message--assistant assistant-chat__typing" role="status" aria-label="El asistente está respondiendo">
                <span /><span /><span />
            </div>}
        </div>
        <form className="assistant-chat__form" onSubmit={sendMessage}>
            <label className="assistant-chat__label" htmlFor="assistant-message">Tu mensaje</label>
            <div className="assistant-chat__composer">
                <textarea id="assistant-message" ref={input} value={draft} maxLength={400} rows={2} placeholder="¿En qué podemos ayudarte?" onChange={event => setDraft(event.target.value)} onKeyDown={event => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                    }
                }} disabled={sending} required />
                <button type="submit" aria-label="Enviar mensaje" title="Enviar mensaje" disabled={sending || !draft.trim()}><Send size={18} /></button>
            </div>
            <div className="assistant-chat__form-meta"><span>Horus no guarda esta conversación.</span><span>{draft.length}/400</span></div>
        </form>
    </section>;
}