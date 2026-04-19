/**
 * App.js — Punto de entrada de la app
 *
 * Lógica de navegación simple:
 *   - Si no hay cookies inyectadas → CookieScreen
 *   - Si las cookies están inyectadas → NetflixScreen (WebView)
 *
 * No se usa React Navigation para mantener la app lo más ligera posible.
 */

import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import CookieScreen from './src/screens/CookieScreen';
import NetflixScreen from './src/screens/NetflixScreen';

export default function App() {
  const [showNetflix, setShowNetflix] = useState(false);

  return (
    <SafeAreaView style={styles.root}>
      {showNetflix ? (
        <NetflixScreen onLogout={() => setShowNetflix(false)} />
      ) : (
        <CookieScreen onCookiesInjected={() => setShowNetflix(true)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#141414' },
});
