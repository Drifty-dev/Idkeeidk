# Netflix Wrapper — APK Builder Guide

> ⚠️ **Solo para uso personal con tu propia cuenta Netflix.**  
> El uso de cookies de terceros viola los Términos de Netflix y puede resultar en baneo.

---

## Estructura del proyecto

```
NetflixWrapper/
├── App.js                          ← Entrada principal
├── package.json
├── src/
│   ├── screens/
│   │   ├── CookieScreen.js         ← Pantalla de login con cookies
│   │   └── NetflixScreen.js        ← WebView de Netflix
│   └── utils/
│       ├── cookieParser.js         ← Parsea formato Netscape y simple
│       └── cookieManager.js        ← Inyecta y persiste cookies
└── android/                        ← Generado por React Native init
```

---

## PASO 1 — Requisitos previos

Instala en tu PC (Windows/Mac/Linux):

| Herramienta | Versión mínima | Descarga |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| Java JDK | 17 | https://adoptium.net |
| Android Studio | Cualquiera reciente | https://developer.android.com/studio |
| React Native CLI | global | `npm install -g react-native-cli` |

Configura las variables de entorno:
```bash
# En ~/.bashrc o ~/.zshrc (Linux/Mac)
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

# En Windows: Configuración del sistema → Variables de entorno
# ANDROID_HOME = C:\Users\TU_USUARIO\AppData\Local\Android\Sdk
```

---

## PASO 2 — Crear el proyecto base con React Native

```bash
# Crear proyecto base (SOLO si empiezas desde cero)
npx react-native@0.73.6 init NetflixWrapper --version 0.73.6

# Entra al directorio
cd NetflixWrapper

# Reemplaza App.js y crea las carpetas src/ con los archivos de este repo
```

---

## PASO 3 — Instalar dependencias

```bash
cd NetflixWrapper
npm install

# Instalar dependencias nativas específicas
npm install react-native-webview
npm install @react-native-async-storage/async-storage
npm install @react-native-cookies/cookies

# Vincular módulos nativos (React Native 0.73+ hace auto-linking,
# pero por si acaso ejecuta también:)
npx react-native-asset
```

---

## PASO 4 — Configurar Android (archivo android/app/build.gradle)

Abre `android/app/build.gradle` y asegúrate de tener:

```gradle
android {
    compileSdkVersion 34
    
    defaultConfig {
        applicationId "com.netflixwrapper"
        minSdkVersion 26          // Android 8.0 mínimo
        targetSdkVersion 34
        versionCode 1
        versionName "1.0"
    }
    
    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'),
                          'proguard-rules.pro'
        }
    }
}
```

### Permisos en android/app/src/main/AndroidManifest.xml

Dentro de `<manifest>`, fuera de `<application>`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

Dentro de `<application>`:
```xml
<application
    android:usesCleartextTraffic="false"
    android:hardwareAccelerated="true"
    ...>
```

---

## PASO 5 — Generar APK de debug (para probar)

```bash
# Con un dispositivo conectado por USB (habilita "Depuración USB" en ajustes)
npx react-native run-android

# O para generar el APK sin instalar:
cd android
./gradlew assembleDebug

# El APK quedará en:
# android/app/build/outputs/apk/debug/app-debug.apk
```

---

## PASO 6 — Generar APK de release firmado (para distribuir)

### 6.1 Crear el keystore (firma digital)

```bash
keytool -genkeypair -v \
  -keystore netflix-wrapper-key.keystore \
  -alias netflix-wrapper \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Guarda el archivo `.keystore` en `android/app/`.  
**⚠️ NUNCA subas el .keystore a GitHub.** Agrégalo al `.gitignore`.

### 6.2 Configurar credenciales en gradle.properties

Edita `android/gradle.properties` y agrega:

```properties
MYAPP_UPLOAD_STORE_FILE=netflix-wrapper-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=netflix-wrapper
MYAPP_UPLOAD_STORE_PASSWORD=TU_PASSWORD_AQUI
MYAPP_UPLOAD_KEY_PASSWORD=TU_PASSWORD_AQUI
```

### 6.3 Referenciar el keystore en build.gradle

En `android/app/build.gradle`, sección `android {}`:

```gradle
signingConfigs {
    release {
        storeFile file(MYAPP_UPLOAD_STORE_FILE)
        storePassword MYAPP_UPLOAD_STORE_PASSWORD
        keyAlias MYAPP_UPLOAD_KEY_ALIAS
        keyPassword MYAPP_UPLOAD_KEY_PASSWORD
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'),
                      'proguard-rules.pro'
    }
}
```

### 6.4 Compilar el APK release

```bash
cd android
./gradlew assembleRelease

# APK final en:
# android/app/build/outputs/apk/release/app-release.apk
```

---

## PASO 7 — Subir a GitHub y usar GitHub Actions para compilar en la nube

### 7.1 Crear el repositorio

```bash
cd NetflixWrapper
git init
git add .
git commit -m "feat: Netflix wrapper initial commit"

# Crear repositorio en github.com y luego:
git remote add origin https://github.com/TU_USUARIO/netflix-wrapper.git
git push -u origin main
```

### 7.2 .gitignore (obligatorio — no subir credenciales)

Crea/edita `.gitignore`:

```gitignore
# React Native
node_modules/
.gradle/
build/
*.keystore          ← MUY IMPORTANTE: nunca subir el keystore
*.jks

# Gradle
android/.gradle/
android/app/build/

# Variables de entorno con contraseñas
android/gradle.properties   ← Si tiene passwords, NO subirlo
.env
```

### 7.3 Guardar el keystore como GitHub Secret

En tu repositorio de GitHub:
- Ve a **Settings → Secrets and variables → Actions**
- Crea los siguientes secrets:

| Nombre del Secret | Valor |
|---|---|
| `KEYSTORE_BASE64` | El keystore en base64: `base64 -w 0 netflix-wrapper-key.keystore` |
| `KEYSTORE_PASSWORD` | Tu contraseña del keystore |
| `KEY_ALIAS` | `netflix-wrapper` |
| `KEY_PASSWORD` | Tu contraseña de la key |

### 7.4 Workflow de GitHub Actions (.github/workflows/build-apk.yml)

Crea este archivo en tu repositorio:

```yaml
name: Build Release APK

on:
  push:
    branches: [main]
  workflow_dispatch:   # Permite ejecutar manualmente desde la UI de GitHub

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Configurar Node.js 18
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Configurar Java 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Instalar dependencias npm
        run: npm ci

      - name: Restaurar keystore desde secret
        run: |
          echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 --decode > android/app/netflix-wrapper-key.keystore

      - name: Configurar gradle.properties con credenciales
        run: |
          echo "MYAPP_UPLOAD_STORE_FILE=netflix-wrapper-key.keystore" >> android/gradle.properties
          echo "MYAPP_UPLOAD_KEY_ALIAS=${{ secrets.KEY_ALIAS }}" >> android/gradle.properties
          echo "MYAPP_UPLOAD_STORE_PASSWORD=${{ secrets.KEYSTORE_PASSWORD }}" >> android/gradle.properties
          echo "MYAPP_UPLOAD_KEY_PASSWORD=${{ secrets.KEY_PASSWORD }}" >> android/gradle.properties

      - name: Dar permisos a gradlew
        run: chmod +x android/gradlew

      - name: Compilar APK release
        run: |
          cd android
          ./gradlew assembleRelease --no-daemon

      - name: Subir APK como artifact descargable
        uses: actions/upload-artifact@v4
        with:
          name: app-release
          path: android/app/build/outputs/apk/release/app-release.apk
          retention-days: 30
```

Una vez que hagas push a `main`, GitHub compilará automáticamente el APK.  
Lo encontrarás en: **Repositorio → Actions → (último run) → Artifacts → app-release**

---

## Cómo obtener tus cookies de Netflix

### Opción A — Extensión "Get cookies.txt LOCALLY" (Chrome/Edge)
1. Instala la extensión
2. Ve a netflix.com con sesión iniciada
3. Haz clic en la extensión → "Export"
4. Copia el contenido del archivo `.txt` → pégalo en la app

### Opción B — DevTools manual
1. Abre netflix.com en Chrome → F12 → Application → Cookies → www.netflix.com
2. Copia manualmente: `NetflixId`, `SecureNetflixId`, `nfvdid`
3. Pégalos en formato: `NetflixId=xxx; SecureNetflixId=yyy; nfvdid=zzz`

---

## Limitaciones conocidas

| Problema | Causa | Estado |
|---|---|---|
| Video no reproduce o mala calidad | Widevine L3 (no L1) en WebView | No soluble sin Widevine L1 |
| Netflix redirige a /login | Cookies expiradas o mal copiadas | Re-exporta las cookies |
| Se ve como versión PC | User-Agent no detectado | Forzado en código — reportar |
| No pasa Play Store review | Violación de TOS | Esperado — solo instalación manual (APK) |

---

## Advertencias finales

- La app **no es oficial** de Netflix
- No funcionará en todos los dispositivos para streaming de video (depende de Widevine L1)
- Las cookies de sesión expiran periódicamente — deberás renovarlas
- Usar SOLO con **tu propia cuenta**
