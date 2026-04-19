/**
 * NetflixScreen.js
 *
 * Pantalla principal con el WebView que carga Netflix.
 * Configurado para mostrar la versión móvil (no escritorio).
 *
 * Razón técnica: Netflix decide la interfaz según User-Agent + viewport.
 * Al usar un UA de Chrome Android + viewport correcto → interfaz móvil táctil.
 *
 * ⚠️ Aviso: La reproducción de DRM puede fallar en WebView (Widevine L3 en
 * lugar de L1). Esto es una limitación del sistema, no un bug de la app.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  BackHandler,
  StatusBar,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';

const NETFLIX_URL = 'https://www.netflix.com/browse';

/**
 * User-Agent de Chrome Android real (Pixel 7, Android 14).
 * RAZÓN: Si el UA es desktop, Netflix sirve la versión de PC.
 * Si es móvil Android Chrome, sirve la interfaz con menú inferior táctil.
 */
const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';

/**
 * JavaScript inyectado DESPUÉS de cargar la página para:
 * 1. Forzar viewport móvil correcto
 * 2. Eliminar cualquier override de Netflix que cause layout de PC
 * 3. Interceptar intentos de abrir la app nativa (intent://)
 */
const INJECTED_JS = `
(function() {
  // 1. Forzar viewport móvil
  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  meta.setAttribute(
    'content',
    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
  );

  // 2. Marcar el documento como móvil (algunos frameworks lo leen)
  document.documentElement.classList.add('is-mobile');
  document.documentElement.setAttribute('data-platform', 'android');

  // 3. Override de window.open para evitar popups que rompen el flujo
  window.open = function(url) {
    window.location.href = url;
    return null;
  };

  true; // Necesario para react-native-webview
})();
`;

export default function NetflixScreen({ onLogout }) {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Manejar botón "Atrás" del dispositivo
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // Consumir el evento
      }
      return false; // Salir de la app
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [canGoBack]);

  /**
   * Intercepta URLs antes de navegar.
   * RAZÓN: Netflix a veces genera URLs de tipo intent:// para abrir la app nativa.
   * Las bloqueamos y redirigimos al browser normal.
   */
  const handleShouldStartLoad = useCallback(({ url }) => {
    if (url.startsWith('intent://')) {
      // Bloquear intent de abrir app nativa
      console.log('[NetflixScreen] Bloqueando intent URL:', url);
      return false;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Bloquear otros esquemas no-HTTP
      return false;
    }
    return true;
  }, []);

  const handleNavigationChange = useCallback(({ canGoBack: cgb }) => {
    setCanGoBack(cgb);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
    setLoadError(null);
  }, []);

  const handleError = useCallback(({ nativeEvent }) => {
    setIsLoading(false);
    if (nativeEvent.code === -2) {
      setLoadError('Sin conexión a internet.');
    } else if (nativeEvent.code === 401 || nativeEvent.description?.includes('401')) {
      setLoadError('Sesión expirada. Las cookies han caducado.');
    } else {
      setLoadError(`Error de red: ${nativeEvent.description || 'desconocido'}`);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    webViewRef.current?.reload();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* WebView principal */}
      <WebView
        ref={webViewRef}
        source={{ uri: NETFLIX_URL }}
        style={styles.webview}

        // ── Usuario-Agente móvil ──
        // RAZÓN: Netflix usa el UA para decidir qué interfaz servir.
        userAgent={MOBILE_USER_AGENT}

        // ── JS y storage ──
        javaScriptEnabled={true}
        domStorageEnabled={true}
        thirdPartyCookiesEnabled={true}
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"

        // ── Viewport ──
        // setUseWideViewPort(false) + setLoadWithOverviewMode(false)
        // evitan que el WebView renderice en modo "pantalla grande"
        scalesPageToFit={false}
        useWebView2={false}

        // ── Multimedia ──
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}

        // ── JS inyectado post-carga ──
        injectedJavaScript={INJECTED_JS}
        injectedJavaScriptBeforeContentLoaded={`
          // Prevenir detección de automatización antes de que cargue el JS de Netflix
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          true;
        `}

        // ── Handlers ──
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onNavigationStateChange={handleNavigationChange}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onHttpError={handleError}

        // ── Fullscreen automático en video ──
        onMessage={() => {}} // Necesario para que injectedJS funcione correctamente
      />

      {/* Indicador de carga */}
      {isLoading && !loadError && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#E50914" />
          <Text style={styles.loadingText}>Cargando Netflix...</Text>
        </View>
      )}

      {/* Pantalla de error */}
      {loadError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
            <Text style={styles.retryBtnText}>Reintentar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutBtnText}>Cambiar cookies</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Barra inferior flotante con controles mínimos */}
      {!isLoading && !loadError && (
        <View style={styles.controlBar}>
          <TouchableOpacity
            style={[styles.controlBtn, !canGoBack && styles.controlBtnDisabled]}
            onPress={() => canGoBack && webViewRef.current?.goBack()}
          >
            <Text style={styles.controlBtnText}>‹ Atrás</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={handleRefresh}>
            <Text style={styles.controlBtnText}>↻</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={onLogout}>
            <Text style={[styles.controlBtnText, { color: '#E50914' }]}>✕ Salir</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: { color: '#aaa', marginTop: 12, fontSize: 14 },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    zIndex: 10,
  },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 24 },
  retryBtn: {
    backgroundColor: '#E50914',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 4,
    marginBottom: 12,
  },
  retryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  logoutBtn: { paddingVertical: 12 },
  logoutBtnText: { color: '#aaa', fontSize: 14 },
  controlBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  controlBtn: { paddingHorizontal: 20, paddingVertical: 8 },
  controlBtnDisabled: { opacity: 0.3 },
  controlBtnText: { color: '#fff', fontSize: 16 },
});
