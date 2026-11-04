import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const sessionCookie = "horus_session";
const sessionDuration = 7 * 24 * 60 * 60 * 1000;

export async function hashPassword(password) {
    const salt = randomBytes(16);
    const derivedKey = await scrypt(password, salt, 64);
    return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function verificarContrasena(password, encodedPassword) {
    const [algorithm, saltHex, keyHex] = encodedPassword?.split("$") || [];
    if (algorithm !== "scrypt" || !/^[\da-f]{32}$/i.test(saltHex) ||
        !/^[\da-f]{128}$/i.test(keyHex)) return false;
    const expected = Buffer.from(keyHex, "hex");
    const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
    return timingSafeEqual(actual, expected);
}

export function hashToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

export function leerTokenSesion(request) {
    const cookie = request.headers.cookie?.split(";").map(value => value.trim())
        .find(value => value.startsWith(`${sessionCookie}=`));
    return cookie?.slice(sessionCookie.length + 1) || "";
}

export function guardarCookieSesion(response, token) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    response.set("Set-Cookie", `${sessionCookie}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionDuration / 1000}${secure}`);
}

export function borrarCookieSesion(response) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    response.set("Set-Cookie", `${sessionCookie}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
}

export function crearTokenSesion() {
    return randomBytes(32).toString("base64url");
}

export function venceSesion() {
    return new Date(Date.now() + sessionDuration);
}
