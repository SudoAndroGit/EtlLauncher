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
- `branding/welcome.json` y `branding/welcome-sidebar.vue`: contenido editable de bienvenida.

## Avisos y compatibilidad

- Se conserva el identificador original de Tauri y los datos de Modrinth por compatibilidad. Si ya tienes Modrinth instalado, respalda tus instancias; el instalador personalizado puede interferir con esa instalación.
- No hay firma comercial: Windows podría advertir sobre aplicaciones desconocidas.
- Este es un trabajo derivado de Modrinth y continúa usando sus servicios y APIs. El logo personalizado es derivado de la marca original; su uso o distribución podría requerir permisos. **No lo presentes como un producto oficial**.
- Las nuevas personalizaciones requieren verificar una compilación y su aspecto en Windows antes de considerarlas estables.
