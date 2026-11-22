# EtlLauncher 🌸

Versión privada y experimental de Modrinth App, personalizada como **EtlLauncher**.

## Objetivo
- Cambiar el nombre visible del launcher y su instalador.
- Desactivar la presentación de anuncios de la interfaz.
- Usar el logotipo rosa con sakuras.
- Construir un instalador de Windows desde GitHub Actions, comprobando cambios en el código oficial.

## Estado
Preparación inicial. **Todavía no hay ejecutable compilado ni probado.**

## Principios
- El código fuente oficial se obtiene de https://github.com/modrinth/code en el workflow.
- El parche falla si cambia la estructura esperada, en lugar de producir un instalador no verificado.
- No se publican artefactos públicos; los resultados quedan en el repositorio privado.
- No se activa el actualizador oficial para evitar que reemplace la compilación personalizada.
- Respeta los avisos y licencias aplicables al código de terceros.

## Archivos previstos
- `patches/patch_launcher.py`: aplica el cambio de nombre y oculta anuncios.
- `.github/workflows/build.yml`: construye Windows x64 y guarda el artefacto.
- `branding/icon.png`: logotipo personalizado (por incorporar).

## Precaución
La compilación es experimental; antes de instalarla haz copia de seguridad de tus instancias de Minecraft.