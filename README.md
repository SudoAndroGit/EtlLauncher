# EternalLauncher — Sakura Edition 🌸

**EternalLauncher** es una compilación privada y no oficial de Modrinth App con parches propios. No está afiliada a Rinth, Inc. El repositorio conserva por ahora el nombre histórico `WildMCs/EtlLauncher`.

## Identidad

- **Ejecutable/instalador:** `EternalLauncher`.
- **Nombre mostrado dentro del launcher:** **Eternal** (barra superior, bienvenida, pantalla de carga y ajustes).
- **Discord Rich Presence:** identidad de la aplicación **EternalLauncher** y recurso de imagen `eternal_logo`, solo cuando se configura una aplicación propia de Discord (ver abajo).
- **Tema único Sakura Glass:** cristal rosa con transparencias suaves, barra superior y laterales translúcidos, navegación redondeada y tarjetas ligeras. Conserva el icono personalizado.

## Tema Sakura Glass 🌸

El tema se aplica automáticamente en cada compilación usando `branding/theme.css`. **No se añadió ningún motor de temas** ni se modificó la estructura de Vue o Rust: los ajustes siguen funcionando como en el launcher original y el parche es fácil de revertir.

- Fondo con degradados rosa/lavanda, sin imágenes externas ni animaciones adicionales.
- Barra superior, navegación izquierda y panel derecho con efecto de cristal rosa.
- Tarjetas de instancias con fondo translúcido y bordes más suaves, **sin desenfoque por tarjeta**, para no castigar bibliotecas grandes.
- Compatibilidad con modo claro/oscuro, reducción de transparencia y el ajuste de renderizado avanzado (desactiva el blur).
- Si el desenfoque no está disponible, quedan los colores semitransparentes de respaldo.

Para deshacer este aspecto, basta con revertir los cambios CSS de `branding/theme.css`; no afecta a instancias, mods o partidas. La apariencia definitiva aún debe revisarse en Windows después de que el workflow compile.

## Fondo personalizado 🌸

En **Ajustes → Apariencia → Fondo de Eternal** puedes seleccionar un JPG, PNG o WebP de hasta 12 MB y restaurar el fondo Sakura Glass cuando quieras.

La fotografía se **reduce localmente** a un máximo aproximado de 1920×1080 y se guarda comprimida en el almacenamiento local del WebView. No se sube a ningún servicio, no se añaden permisos de acceso a archivos y no cambia tus instalaciones. El fondo Sakura Glass original es el predeterminado. Si se borran los datos del WebView, la personalización se perderá.

## Noticias remotas (sin actualizar el ejecutable)

El panel lateral carga noticias desde un archivo JSON público por HTTPS. Consulta al abrir y cada 15 minutos mientras esté abierto; permite actualización manual. Guarda un caché local con las últimas noticias válidas. Sin URL configurada, sin conexión o sin datos en caché, aparece la bienvenida incluida en el instalador.

### Publicarlo con Cloudflare Pages

1. Crea un proyecto **Cloudflare Pages** conectado a este repositorio privado de GitHub (el sitio publicado será público).
2. Selecciona la rama `main`, **sin comando de compilación**, y establece **`public-news` como directorio de salida**. El archivo `public-news/_headers` configura CORS y un tiempo corto de caché.
3. Abre la URL generada por Pages, por ejemplo `https://TU-PROYECTO.pages.dev/news.json`, y verifica que responde con JSON válido. También puedes utilizar un dominio personalizado propio.
4. Edita **`branding/news-config.json`** y pega la URL pública completa en el campo `url`. Compila **una vez**; el parche permite ese origen HTTPS en la política CSP de Tauri.
5. Para publicar noticias futuras, **solo edita `public-news/news.json`**. Cloudflare Pages publicará el JSON y los EternalLauncher instalados recibirán los cambios en su próxima consulta; no necesitan recompilarse.

Formato del archivo: `{ "version": 1, "updated_at": "AAAA-MM-DD", "items": [{ "id": "novedad", "title": "Título", "body": "Contenido de texto", "date": "AAAA-MM-DD", "url": "https://enlace-opcional" }] }`.

Las noticias se muestran como **texto plano**, nunca HTML, con máximo cinco entradas, límites de tamaño, enlaces HTTPS y consulta de red con timeout. No requiere cuentas, tokens, base de datos ni servidor propio. **Hasta configurar y publicar una URL real, las noticias remotas no están activas**; la bienvenida de Eternal permanece.

## Rendimiento del workflow

El workflow conserva la optimización anterior que **salta versiones de Modrinth ya compiladas**, y ahora también:

- Conserva las descargas de **pnpm** mediante `actions/cache@v4`.
- Reutiliza compilaciones de dependencias **Rust/Cargo** mediante `Swatinem/rust-cache@v2`.
- Escribe en el **resumen de GitHub Actions** el tiempo real de instalación de pnpm y compilación Tauri/NSIS, además del acierto de caché pnpm.

La primera compilación que crea las cachés puede tardar lo mismo o más. Las mejoras reales deben comprobarse en la segunda ejecución comparable. No se ha medido todavía un tiempo de referencia confiable ni se garantiza una reducción concreta.

## Cambios de interfaz y privacidad

- Oculta la entrada de **Modrinth Hosting** del menú lateral. Mantiene las APIs necesarias para instalaciones, descargas y funciones online; **no** modifica el servicio de pago ni elimina todo el código de Hosting.
- Sustituye el panel lateral de noticias por la **bienvenida editable a la primera versión**. No realiza peticiones para cargar noticias en ese panel.
- Oculta publicidad y la opción de suscripción Modrinth+ del menú de perfil.
- Desactiva el actualizador oficial para no sustituir la versión personalizada.
- Desactiva la inicialización de Sentry y fuerza la telemetría opcional a OFF. Las conexiones necesarias con Modrinth/Minecraft siguen funcionando.

## Personalizar la bienvenida

Edita **`branding/welcome.json`** (texto del encabezado, título, descripción, lista de características y mensaje final). La próxima compilación incorporará los cambios. El componente visual está en `branding/welcome-sidebar.vue`; no necesitas modificar los archivos descargados de Modrinth.

## Discord Rich Presence — EternalLauncher

El parche ya incorpora el **Application ID** público `1269391023797436426` para las compilaciones nuevas. También puedes sustituirlo más adelante mediante la variable de GitHub Actions `ETERNAL_DISCORD_CLIENT_ID`, sin editar el parche.

Mensajes personalizados:

- **Sin jugar:** `Ausente (｡-ω-) zzZ` y `Disfrutando de un descansito 🌸`.
- **Jugando a una instancia:** `Jugando: {nombre de la instancia}` y `¡De aventura! (ง •̀ω•́)ง`.
- **Logo (tooltip):** `EternalLauncher 🌸`.

Discord muestra el **nombre de aplicación** registrado en el Developer Portal: debe llamarse **EternalLauncher**. En [Discord Developer Portal](https://discord.com/developers/applications), abre tu aplicación y configura en **Rich Presence / Art Assets** el logo Sakura con la clave exacta `eternal_logo`. El recurso puede tardar en aparecer en Discord.

No hace falta un bot, un token ni abrir puertos. La opción Discord Rich Presence sigue siendo configurable desde **Privacidad**, y necesitarás reiniciar el launcher tras cambiarla. Aún falta comprobar el resultado visual en una compilación real.

## Construir

1. Abre **Actions → Build EternalLauncher (experimental) → Run workflow**.
2. Descarga el artefacto `EternalLauncher-vX.Y.Z-windows-x64` cuando termine correctamente.
3. Extrae el instalador `.exe` y haz una copia de seguridad de las instancias antes de instalar.

El workflow revisa las versiones oficiales cada seis horas; los cambios en `patches/**`, `branding/**` y el workflow inician una nueva compilación. Los parches fallan explícitamente si cambia una sección esencial del código fuente original.

## Publicar una Release privada

En **Run workflow**, marca **Publish a private GitHub Release after the build succeeds** para publicar el instalador y su comprobación SHA-256 en https://github.com/WildMCs/EtlLauncher/releases. Las publicaciones se marcan como versiones experimentales; las automáticas no publican Releases por sí solas.

## Estructura

- `.github/workflows/build.yml`: descarga el código oficial, aplica los parches, genera los iconos y compila NSIS.
- `patches/patch_launcher.py`: nombre del ejecutable, anuncios y actualizador.
- `patches/brand_launcher.py`: marca interna Eternal, iconos, colores y promoción del perfil.
- `patches/eternal_features.py`: Hosting en navegación, bienvenida editable y Discord Rich Presence.
- `patches/privacy_launcher.py`: privacidad de la compilación.
- `branding/logo.png.b64`: logo transparente para el compilador.
- `branding/theme.css`: tema Sakura Glass (CSS únicamente, sin motor de temas).
- `branding/welcome.json`, `branding/welcome-sidebar.vue` y `branding/news-config.json`: bienvenida y noticias remotas.
- `public-news/news.json` y `public-news/_headers`: archivos listos para publicar en Cloudflare Pages.
- `branding/wallpaper.ts`, `branding/wallpaper-settings.vue`: selección y persistencia local del fondo.
- `patches/wallpaper_news_launcher.py`: añade la opción de fondo a Apariencia y configura el origen HTTPS de noticias.

## Avisos y compatibilidad

- Se conserva el identificador original de Tauri y los datos de Modrinth por compatibilidad. Si ya tienes Modrinth instalado, respalda tus instancias; el instalador personalizado puede interferir con esa instalación.
- No hay firma comercial: Windows podría advertir sobre aplicaciones desconocidas.
- Este es un trabajo derivado de Modrinth y continúa usando sus servicios y APIs. El logo personalizado es derivado de la marca original; su uso o distribución podría requerir permisos. **No lo presentes como un producto oficial**.
- Las nuevas personalizaciones requieren verificar una compilación y su aspecto en Windows antes de considerarlas estables.
