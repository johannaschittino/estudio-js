# Estudio — análisis de cobertura

## Qué es esto

La versión publicable del Estudio: la misma herramienta que probaste en el chat, pero ahora con:

- **Login privado** (Firebase Authentication) — solo entra quien tenga el usuario y contraseña que ya creaste.
- **Guardado en la nube** (Firestore) — tus clientes quedan accesibles desde cualquier dispositivo, no atados a esta PC ni a ninguna cuenta laboral.
- **Línea de tiempo de compromisos financieros** — la suma asegurada ideal ahora también considera la universidad de los hijos, créditos a plazo, y proyectos futuros, no solo el ingreso de hoy.

## Cómo subir esto a Netlify

1. Andá a [app.netlify.com](https://app.netlify.com) y entrá con tu cuenta (la misma de Trïbu).
2. Click en **"Add new site" → "Deploy manually"**.
3. Arrastrá la carpeta completa `estudio-js` (o el ZIP descomprimido) al recuadro que dice "Drag and drop your site output folder here".

   **Importante**: Netlify necesita la carpeta ya compilada (`dist`), no el código fuente. Si no tenés forma de compilarlo vos misma, avisame y lo hago yo en mi entorno y te paso el ZIP de `dist` listo para arrastrar.

4. Una vez subido, Netlify te da una URL tipo `nombre-random-123.netlify.app`.
5. Andá a **"Site configuration" → "Change site name"** y poné algo como `estudio-js` para que la URL quede `estudio-js.netlify.app`.

## Antes de usarlo en producción

Reglas de seguridad de Firestore: el archivo `firestore.rules` que está en esta carpeta define que **solo el usuario dueño de cada cliente puede leer o escribir sus datos**. Hay que publicar esas reglas en Firebase:

1. Andá a la consola de Firebase → tu proyecto `jslifeadvisor-estudio` → **Firestore Database → Reglas**.
2. Reemplazá el contenido por el de `firestore.rules`.
3. Click en **"Publicar"**.

Sin este paso, cualquiera con tu URL (aunque no tenga tu login) podría llegar a leer o escribir en la base de datos. Es el paso más importante de todos antes de cargar datos reales de clientes.

## Cómo se ve por dentro

- `src/App.jsx` — toda la aplicación (lista de clientes, ficha, análisis, generación de PDF).
- `src/Login.jsx` — pantalla de login.
- `src/firebase.js` — credenciales y conexión a Firebase.
- `src/data.js` — funciones de guardado/lectura en Firestore.
- `src/tokens.js` — paleta de colores y tipografía compartida.
