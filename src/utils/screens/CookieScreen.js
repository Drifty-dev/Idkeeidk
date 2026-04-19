/**
 * CookieScreen.js
 *
 * Pantalla de inicio: el usuario pega sus cookies de Netflix
 * en formato Netscape (separado por tabs) o "Nombre=Valor; ..."
 *
 * Acepta el formato exportado por extensiones como:
 * - "Get cookies.txt LOCALLY" (Chrome/Edge)
 * - "Cookie-Editor" (Chrome/Firefox)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseCookies } from '../utils/cookieParser';
import { injectCookies, saveCookies, loadSavedCookies, clearAllCookies } from '../utils/cookieManager';

const PLACEHOLDER = `.netflix.com\tTRUE\t/\tFALSE\t1776608358\tnfvdid\tTU_COOKIE_AQUI
.netflix.com\tTRUE\t/\tTRUE\t1801338865\tNetflixId\tTU_NETFLIX_ID_AQUI
.netflix.com\tTRUE\t/\tTRUE\t1801338865\tSecureNetflixId\tTU_SECURE_ID_AQUI

— O bien en formato simple —
NetflixId=xxx; SecureNetflixId=yyy; nfvdid=zzz`;

export default function CookieScreen({ onCookiesInjected }) {
  const [cookieText, setCookieText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [hasSaved, setHasSaved] = useState(false);

  // Al montar, verificar si hay cookies guardadas
  useEffect(() => {
    (async () => {
      const saved = await loadSavedCookies();
      if (saved) {
        setHasSaved(true);
        setStatusMsg('✓ Sesión guardada encontrada. Puedes continuar o ingresar nuevas cookies.');
      }
    })();
  }, []);

  /**
   * Flujo principal:
   * 1. Parsear texto de cookies (Netscape o simple)
   * 2. Inyectar en CookieManager (antes de que el WebView cargue)
   * 3. Guardar en AsyncStorage para próximos inicios
   * 4. Llamar onCookiesInjected() para mostrar el WebView
   */
  const handleInject = useCallback(async () => {
    if (!cookieText.trim()) {
      Alert.alert('Campo vacío', 'Por favor pega tus cookies de Netflix.');
      return;
    }

    setIsLoading(true);
    setStatusMsg('Parseando cookies...');

    try {
      // 1. Parsear
      const parsed = parseCookies(cookieText);
      setStatusMsg(`Encontradas ${parsed.length} cookies. Inyectando...`);

      // 2. Inyectar
      const result = await injectCookies(parsed);

      if (!result.success) {
        throw new Error('No se pudieron inyectar las cookies.');
      }

      if (result.errors.length > 0) {
        console.warn('[CookieScreen] Errores parciales:', result.errors);
      }

      // 3. Guardar para sesiones futuras
      await saveCookies(cookieText);

      setStatusMsg(`✓ ${result.count} cookies inyectadas. Abriendo Netflix...`);

      // 4. Navegar al WebView
      setTimeout(() => {
        setIsLoading(false);
        onCookiesInjected();
      }, 800);

    } catch (err) {
      setIsLoading(false);
      setStatusMsg('');
      Alert.alert('Error', err.message || 'Ocurrió un error inesperado.');
    }
  }, [cookieText, onCookiesInjected]);

  /**
   * Restaurar sesión guardada sin re-ingresar cookies.
   */
  const handleRestoreSession = useCallback(async () => {
    setIsLoading(true);
    setStatusMsg('Restaurando sesión guardada...');
    try {
      const saved = await loadSavedCookies();
      if (!saved) throw new Error('No hay sesión guardada.');

      const parsed = parseCookies(saved);
      const result = await injectCookies(parsed);
      if (!result.success) throw new Error('Error al restaurar cookies.');

      setStatusMsg('✓ Sesión restaurada.');
      setTimeout(() => {
        setIsLoading(false);
        onCookiesInjected();
      }, 600);
    } catch (err) {
      setIsLoading(false);
      Alert.alert('Error', err.message);
    }
  }, [onCookiesInjected]);

  /**
   * Limpiar toda la sesión guardada.
   */
  const handleClear = useCallback(() => {
    Alert.alert(
      'Limpiar sesión',
      '¿Eliminar todas las cookies guardadas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await clearAllCookies();
            setCookieText('');
            setHasSaved(false);
            setStatusMsg('Cookies eliminadas.');
          },
        },
      ]
    );
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* Logo / Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>N</Text>
          <Text style={styles.title}>Netflix Cookie Login</Text>
          <Text style={styles.subtitle}>
            Pega las cookies exportadas de tu cuenta Netflix
          </Text>
        </View>

        {/* Aviso legal */}
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ Solo usa cookies de <Text style={styles.bold}>TU PROPIA cuenta</Text>.
            Compartir cookies viola los Términos de Netflix y puede resultar en
            el bloqueo de la cuenta.
          </Text>
        </View>

        {/* Instrucción de formato */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Formatos aceptados:</Text>
          <Text style={styles.infoText}>
            • <Text style={styles.bold}>Netscape (con tabs)</Text>: exportado por extensiones
            como "Get cookies.txt LOCALLY" o "Cookie-Editor"{'\n'}
            • <Text style={styles.bold}>Simple</Text>: {`NetflixId=xxx; SecureNetflixId=yyy`}
          </Text>
          <Text style={styles.infoText}>
            Columnas Netscape: dominio | subdominios | ruta | seguro | expiración | nombre | valor
          </Text>
        </View>

        {/* TextInput de cookies */}
        <TextInput
          style={styles.textInput}
          placeholder={PLACEHOLDER}
          placeholderTextColor="#555"
          multiline
          numberOfLines={8}
          value={cookieText}
          onChangeText={setCookieText}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          textAlignVertical="top"
        />

        {/* Mensaje de estado */}
        {statusMsg !== '' && (
          <Text style={styles.statusMsg}>{statusMsg}</Text>
        )}

        {/* Botón principal */}
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, isLoading && styles.btnDisabled]}
          onPress={handleInject}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>🍪 Inyectar Cookies y Abrir Netflix</Text>
          }
        </TouchableOpacity>

        {/* Restaurar sesión guardada */}
        {hasSaved && (
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={handleRestoreSession}
            disabled={isLoading}
          >
            <Text style={[styles.btnText, { color: '#E50914' }]}>
              ▶ Restaurar sesión guardada
            </Text>
          </TouchableOpacity>
        )}

        {/* Limpiar */}
        {hasSaved && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClear}
            disabled={isLoading}
          >
            <Text style={styles.clearBtnText}>✕ Limpiar cookies guardadas</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#141414' },
  container: {
    padding: 20,
    paddingBottom: 48,
  },
  header: { alignItems: 'center', marginVertical: 32 },
  logo: {
    fontSize: 64,
    fontWeight: '900',
    color: '#E50914',
    letterSpacing: -2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 4,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: '#2a1a00',
    borderLeftWidth: 3,
    borderLeftColor: '#f90',
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
  },
  warningText: { color: '#f90', fontSize: 13, lineHeight: 20 },
  bold: { fontWeight: '700' },
  infoBox: {
    backgroundColor: '#1e1e1e',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  infoTitle: { color: '#fff', fontWeight: '700', marginBottom: 6, fontSize: 13 },
  infoText: { color: '#aaa', fontSize: 12, lineHeight: 18, marginBottom: 4 },
  textInput: {
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    color: '#e0e0e0',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
    fontSize: 11,
    padding: 12,
    minHeight: 180,
    marginBottom: 16,
  },
  statusMsg: {
    color: '#4caf50',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  btn: {
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnPrimary: { backgroundColor: '#E50914' },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#E50914',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  clearBtn: { alignItems: 'center', paddingVertical: 12 },
  clearBtnText: { color: '#666', fontSize: 14 },
});
