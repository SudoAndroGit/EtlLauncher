# EternalLauncher — Sakura Edition 🌸

**EternalLauncher** es una compilación privada y no oficial de Modrinth App con parches propios. No está afiliada a Rinth, Inc. El repositorio conserva por ahora el nombre histórico `WildMCs/EtlLauncher`.

## Identidad

- **Ejecutable/instalador:** `EternalLauncher`.
- **Nombre mostrado dentro del launcher:** **Eternal** (barra superior, bienvenida, pantalla de carga y ajustes).
- **Discord Rich Presence:** identidad de la aplicación **EternalLauncher** y recurso de imagen `eternal_logo`, solo cuando se configura una aplicación propia de Discord (ver abajo).
- Tema rosa Sakura e icono personalizado.

## Cambios de interfaz y privacidad

- Oculta la entrada de **Modrinth Hosting** del menú lateral. Mantiene las APIs necesarias para instalaciones, descargas y funciones online; **no** modifica el servicio de pago ni elimina todo el código de Hosting.
- Sustituye el panel lateral de noticias por la **bienvenida editable a la primera versión**. No realiza peticiones para cargar noticias en ese panel.
- Oculta publicidad y la opción de suscripción Modrinth+ del menú de perfil.
- Desactiva el actualizador oficial para no sustituir la versión personalizada.
- Desactiva la inicialización de Sentry y fuerza la telemetría opcional a OFF. Las conexiones necesarias con Modrinth/Minecraft siguen funcionando.

## Personalizar la bienvenida

Edita **`branding/welcome.json`** (texto del encabezado, título, descripción, lista de características y mensaje final). La próxima compilación incorporará los cambios. El componente visual está en `branding/welcome-sidebar.vue`; no necesitas modificar los archivos descargados de Modrinth.

## Configurar Discord Rich Presence

Discord determina **el nombre y el icono de la actividad** a partir de una aplicación registrada en su Developer Portal, no del nombre del ejecutable.

1. Entra a https://discord.com/developers/applications y crea una aplicación **EternalLauncher**.
2. En sus ajustes de Rich Presence/Art Assets, sube tu logo Sakura con el nombre exacto **`eternal_logo`**. La propagación de nuevos recursos puede tardar.
3. Copia el **Application ID**, que es un identificador público numérico (**no es un bot token**).
4. En el repositorio GitHub abre **Settings → Secrets and variables → Actions → Variables → New repository variable**. Crea `ETERNAL_DISCORD_CLIENT_ID` con ese ID.
5. Ejecuta de nuevo el workflow de compilación y activa Rich Presence en la sección Privacidad del launcher.

**Si la variable no está configurada**, la integración de Discord se mantiene desactivada en vez de mostrar el nombre y logo oficiales de Modrinth. No hace falta crear un bot, usar un token ni abrir puertos.

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
- `branding/theme.css`: tema rosa.
- `branding/welcome.json` y `branding/welcome-sidebar.vue`: contenido editable de bienvenida.

## Avisos y compatibilidad

- Se conserva el identificador original de Tauri y los datos de Modrinth por compatibilidad. Si ya tienes Modrinth instalado, respalda tus instancias; el instalador personalizado puede interferir con esa instalación.
- No hay firma comercial: Windows podría advertir sobre aplicaciones desconocidas.
- Este es un trabajo derivado de Modrinth y continúa usando sus servicios y APIs. El logo personalizado es derivado de la marca original; su uso o distribución podría requerir permisos. **No lo presentes como un producto oficial**.
- Las nuevas personalizaciones requieren verificar una compilación y su aspecto en Windows antes de considerarlas estables.
