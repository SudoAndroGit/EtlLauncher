# EtlLauncher Sakura Edition 🌸

Compilación privada y **no oficial** de Modrinth App, basada en el código fuente original. No está afiliada a Rinth, Inc.

## Personalizaciones automáticas

- Ventana e instalador: `EtlLauncher`.
- Oculta los anuncios de la interfaz principal (no elimina todo el código publicitario).
- Desactiva las actualizaciones del instalador original.
- Desactiva reportes de errores remotos a Sentry, mantiene las analíticas opcionales apagadas y muestra la telemetría deshabilitada en Privacidad.
- Sustituye el logo principal de la barra superior y pantalla de carga por el icono rosa sakura.
- Genera iconos de Windows (incluido `.ico`) con la herramienta de Tauri.
- Ajusta los colores verdes y el tema de marca a rosa pastel; mantiene superficies oscuras.
- Muestra `EtlLauncher` en el título y el panel de configuración.

## Construir

1. Abrir **Actions → Build EtlLauncher (experimental) → Run workflow**.
2. Esperar a que el trabajo Windows x64 finalice con éxito.
3. Descargar el artefacto privado `EtlLauncher-vX.Y.Z-windows-x64`.
4. Extraer el `.exe` del ZIP e instalarlo después de respaldar las instancias.

La comprobación automática está programada cada seis horas. Solo construye versiones no compiladas previamente de forma satisfactoria; una ejecución manual siempre inicia una nueva compilación.

## Estructura

- `.github/workflows/build.yml`: descarga el código oficial, aplica parches y genera instalador NSIS.
- `patches/patch_launcher.py`: ajustes del nombre, anuncios y actualizador original.
- `patches/brand_launcher.py`: añade el logo, el nombre y la hoja de colores rosa al frontend.
- `patches/privacy_launcher.py`: suprime Sentry en el arranque y fuerza la preferencia de telemetría desactivada.
- `branding/logo.png.b64`: copia reducida (PNG optimizado con transparencia) del logo sakura usado para la compilación.
- `branding/theme.css`: diseño Sakura.

## Seguridad y compatibilidad

- Los parches fallan explícitamente si cambia una sección esencial del código oficial.
- Los ejecutables no se distribuyen públicamente: quedan en los artefactos de un repositorio privado.
- El instalador aún no está firmado comercialmente y Windows puede advertir sobre editor desconocido.
- Desactivar telemetría opcional **no** elimina las conexiones necesarias con Modrinth (login, API, búsqueda, descargas, servicios online), ni la actividad de red de Minecraft o sus mods. Los registros locales permanecen para diagnóstico.
- Todavía hay que verificar esta **versión personalizada con logo y colores** mediante una compilación y prueba visual.
- La plataforma Modrinth y sus APIs siguen siendo de Modrinth; el cambio de marca solo identifica esta compilación privada.
- **Aviso de marca:** el diseño sakura conserva elementos de la marca original de Modrinth; su uso puede requerir permiso escrito de Rinth, Inc. No distribuyas esta variante ni la presentes como oficial.

El repositorio no contiene credenciales, claves privadas ni tokens de GitHub.
