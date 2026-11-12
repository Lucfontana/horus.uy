export async function solicitar(url, opciones = {}) {
    const esMultipart = opciones.body instanceof FormData;
    const respuesta = await fetch(url, {
        ...opciones,
        headers: {
            ...(!esMultipart ? { "Content-Type": "application/json" } : {}),
            ...opciones.headers
        }
    });
    const datos = respuesta.status === 204 ? null : await respuesta.json();
    if (!respuesta.ok) {
        const error = new Error(datos?.error || `Error HTTP ${respuesta.status}`);
        error.status = respuesta.status;
        throw error;
    }
    return datos;
}