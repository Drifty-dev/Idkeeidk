/**
 * cookieParser.js
 * 
 * Parsea cookies en formato Netscape (el que exportan extensiones como
 * "Get cookies.txt" de Chrome) y también el formato simple "name=value; name2=value2".
 *
 * Formato Netscape (separado por TABS):
 * .netflix.com  TRUE  /  FALSE  1776608358  nfvdid  BQFmAAEB...
 * Columnas: domain | includeSubdomains | path | secure | expiry | name | value
 */

/**
 * Detecta si el texto tiene formato Netscape (contiene tabs y columnas típicas)
 * @param {string} text 
 * @returns {boolean}
 */
export function isNetscapeFormat(text) {
  const lines = text.trim().split('\n').filter(l => l && !l.startsWith('#'));
  if (lines.length === 0) return false;
  // Una línea Netscape tiene al menos 6 tabs
  return lines[0].split('\t').length >= 6;
}

/**
 * Parsea cookies en formato Netscape (separado por tabs).
 * Solo extrae las cookies del dominio netflix.com.
 *
 * @param {string} text - Texto en formato Netscape
 * @returns {Array<{name: string, value: string, domain: string, path: string, secure: boolean, expires: number}>}
 */
export function parseNetscapeCookies(text) {
  const cookies = [];
  const lines = text
    .trim()
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 7) {
      // Algunas implementaciones usan 6 columnas (sin value separado)
      if (parts.length === 6) {
        // Asumimos que la última columna es el valor y no hay nombre
        continue;
      }
      continue;
    }

    const [domain, , path, secure, expires, name, value] = parts;

    // Solo aceptar cookies de netflix.com
    if (!domain.includes('netflix')) continue;

    cookies.push({
      name: name.trim(),
      value: value.trim(),
      domain: domain.trim(),          // Ej: .netflix.com
      path: path.trim() || '/',
      secure: secure.trim().toUpperCase() === 'TRUE',
      expires: parseInt(expires.trim(), 10) || 0,
      httpOnly: false,
    });
  }

  return cookies;
}

/**
 * Parsea cookies en formato simple: "Name=Value; Name2=Value2"
 * Asigna dominio .netflix.com por defecto.
 *
 * @param {string} text
 * @returns {Array<{name: string, value: string, domain: string, path: string, secure: boolean}>}
 */
export function parseSimpleCookies(text) {
  return text
    .split(';')
    .map(pair => pair.trim())
    .filter(pair => pair.includes('='))
    .map(pair => {
      const eqIndex = pair.indexOf('=');
      const name = pair.substring(0, eqIndex).trim();
      const value = pair.substring(eqIndex + 1).trim();
      return {
        name,
        value,
        domain: '.netflix.com',
        path: '/',
        secure: name === 'NetflixId' || name === 'SecureNetflixId',
        expires: 0,
        httpOnly: false,
      };
    });
}

/**
 * Función principal: parsea cualquier formato y devuelve array de cookies.
 * @param {string} text
 * @returns {Array<CookieObject>}
 */
export function parseCookies(text) {
  if (!text || text.trim().length === 0) {
    throw new Error('El campo de cookies está vacío.');
  }

  let cookies = [];

  if (isNetscapeFormat(text)) {
    cookies = parseNetscapeCookies(text);
  } else {
    cookies = parseSimpleCookies(text);
  }

  if (cookies.length === 0) {
    throw new Error(
      'No se encontraron cookies válidas de netflix.com. ' +
      'Asegúrate de que el formato sea Netscape (con tabs) o "Nombre=Valor; ..."'
    );
  }

  // Validar que estén las cookies críticas
  const names = cookies.map(c => c.name);
  const hasNetflixId = names.includes('NetflixId');
  const hasSecure = names.includes('SecureNetflixId');

  if (!hasNetflixId && !hasSecure) {
    console.warn(
      '[cookieParser] Advertencia: no se detectaron NetflixId ni SecureNetflixId. ' +
      'La sesión podría no iniciar correctamente.'
    );
  }

  return cookies;
}
