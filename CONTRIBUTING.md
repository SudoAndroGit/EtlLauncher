# Contribuir a EternalLauncher

Gracias por ayudar a mejorar EternalLauncher. Los [issues](https://github.com/WildMCs/EtlLauncher/issues/new/choose) son el lugar para reportar errores y proponer mejoras. Para una vulnerabilidad, consulta la [política de seguridad](SECURITY.md).

## Preparar un cambio

1. Crea una rama desde `main` en tu fork.
2. Haz el cambio en `patches/` si modifica Modrinth App o en `branding/` si afecta a los recursos y componentes de EternalLauncher. La configuración pública de noticias y apariencia está en `public-news/`.
3. Abre un pull request hacia `main` y describe el cambio, cómo lo probaste y qué falta por verificar. Para cambios visuales, adjunta capturas si las tienes.

El workflow descarga Modrinth App y aplica los parches. Si cambias un parche, comprueba que funcione con la versión de Modrinth que estás usando y anótala en el pull request. El [README](README.md#construir) explica cómo se genera el instalador de Windows.

## Pruebas

Para cambios en la validación de imágenes, ejecuta desde la raíz con Node.js 24:

```sh
node --test tests/image-validation.test.mjs
```

Para cambios en la interfaz, indica si los probaste en Windows y con qué tema o configuración. Si solo hiciste una revisión del código, indícalo en el pull request.

Las contribuciones se rigen por el [código de conducta](CODE_OF_CONDUCT.md) y la [licencia del proyecto](LICENSE). También puedes leer cómo se ha usado [IA en el desarrollo](AI-USAGE.md).
