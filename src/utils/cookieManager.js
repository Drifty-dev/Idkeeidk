/**
 * cookieManager.js
 *
 * Gestiona la inyección de cookies en el CookieManager de Android
 * y la persistencia en AsyncStorage.
 *
 * ⚠️ ADVERTENCIA: Inyectar cookies de sesión ajenas puede violar
 * los Términos de Servicio de Netflix y resultar en baneo de cuenta.
 * Usa únicamente cookies de TU PROPIA cuenta.
 */

import CookieManager from '@react-native-cookies/cookies';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@netflix_cookies_v1';
const NETFLIX_URL = 'https://www.netflix.com';

/**
 * Inyecta un array de cookies en el CookieManager de Android
 * ANTES de que el WebView cargue la URL.
 *
 * @param {Array<CookieObject>} cookies - Array de objetos cookie parseados
 * @returns {Promise<{success: boolean, count: number, errors: string[]}>}
 */
export async function injectCookies(cookies) {
  const errors = [];
  let successCount = 0;

  // Limpiar cookies previas del dominio para evitar conflictos
  try {
    await CookieManager.clearByName(NETFLIX_URL, 'NetflixId');
    await CookieManager.clearByName(NETFLIX_URL, 'SecureNetflixId');
  } catch (_) {
    // Ignorar si no existían
  }

  for (const cookie of cookies) {
    try {
      await CookieManager.set(NETFLIX_URL, {
        name: cookie.name,
        value: cookie.value,
        domain: '.netflix.com',      // Siempre forzar dominio correcto
        path: cookie.path || '/',
        secure: cookie.secure || false,
        httpOnly: cookie.httpOnly || false,
        ...(cookie.expires && cookie.expires > 0
          ? { expires: new Date(cookie.expires * 1000).toISOString() }
          : {}),
      });
      successCount++;
    } catch (err) {
      errors.push(`Error en cookie "${cookie.name}": ${err.message}`);
      console.warn('[cookieManager] Error inyectando cookie:', cookie.name, err);
    }
  }

  return { success: successCount > 0, count: successCount, errors };
}

/**
 * Persiste el texto original de cookies en AsyncStorage
 * para restaurar la sesión en futuros inicios de la app.
 *
 * @param {string} rawCookieText - Texto original pegado por el usuario
 */
export async function saveCookies(rawCookieText) {
  await AsyncStorage.setItem(STORAGE_KEY, rawCookieText);
}

/**
 * Carga el texto de cookies guardado previamente.
 * @returns {Promise<string|null>}
 */
export async function loadSavedCookies() {
  return AsyncStorage.getItem(STORAGE_KEY);
}

/**
 * Elimina todas las cookies guardadas (logout).
 * También limpia las cookies del CookieManager del sistema.
 */
export async function clearAllCookies() {
  await AsyncStorage.removeItem(STORAGE_KEY);
  await CookieManager.clearAll();
  console.log('[cookieManager] Todas las cookies eliminadas.');
}

/**
 * Verifica si hay cookies guardadas para restaurar la sesión.
 * @returns {Promise<boolean>}
 */
export async function hasSavedCookies() {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  return saved !== null && saved.trim().length > 0;
}
