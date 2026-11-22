#!/usr/bin/env python3
"""Apply the optional Eternal news and wallpaper UI to upstream Modrinth.

Kept separate from all other patches; uses existing Vue settings and CSS.
No new Rust modules, native plugins or file system privileges.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path
from urllib.parse import urlsplit

BASE = Path(__file__).resolve().parents[1]
ROOT = BASE / "upstream"
FRONTEND = ROOT / "apps/app-frontend/src"


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"Expected exactly one marker in {path.relative_to(ROOT)} "
            f"({count} matches): {old[:75]!r}"
        )
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def install_wallpaper() -> None:
    display = FRONTEND / "features/settings/display"
    shutil.copyfile(BASE / "branding/wallpaper.ts", display / "eternal-wallpaper.ts")
    shutil.copyfile(BASE / "branding/wallpaper-settings.vue", display / "eternal-wallpaper-settings.vue")
    shutil.copyfile(BASE / "branding/appearance-remote.ts", display / "eternal-appearance.ts")
    shutil.copyfile(BASE / "branding/image-validation.ts", display / "eternal-image-validation.ts")
    shutil.copyfile(BASE / "branding/particles.vue", display / "eternal-particles.vue")

    settings = display / "appearance-settings.vue"
    replace_once(
        settings,
        "import { useAppSettings } from '@/composables/use-app-settings.ts'",
        "import EternalWallpaperSettings from './eternal-wallpaper-settings.vue'\n"
        "import { useAppSettings } from '@/composables/use-app-settings.ts'",
    )
    replace_once(
        settings,
        "\t<AppearanceSettingsLayout />",
        "\t<AppearanceSettingsLayout />\n\t<EternalWallpaperSettings />",
    )

    # Show the existing supported system/light/OLED modes only. Keep the
    # upstream theme engine intact so accounts and OS synchronization work.
    replace_once(
        settings,
        """const themeOptions = computed(() =>
	theme.options.filter(
		(option) => option !== 'retro' || appSettings.devMode || current.value.theme === 'retro',
	),
)""",
        """const themeOptions = computed(() =>
	theme.options.filter((option) => option === 'oled' || option === 'light' || option === 'system'),
)""",
    )

    # A previous install may already have stored Modrinth's ordinary Dark theme.
    # Map that choice to OLED and use OLED as the preferred system-dark theme.
    theme = FRONTEND / "composables/use-theme.ts"
    replace_once(
        theme,
        "return stored as ColorTheme",
        "return stored === 'dark' ? 'oled' : (stored as ColorTheme)",
    )
    replace_once(
        theme,
        "\treturn 'dark'\n}\n\nfunction loadPreferredDarkTheme()",
        "\treturn 'oled'\n}\n\nfunction loadPreferredDarkTheme()",
    )
    replace_once(
        theme,
        "\t\t\treturn stored\n\t\t}\n\t} catch {\n\t\t// storage blocked or full\n\t}\n\n\treturn 'dark'\n}",
        "\t\t\treturn stored === 'dark' ? 'oled' : stored\n\t\t}\n\t} catch {\n\t\t// storage blocked or full\n\t}\n\n\treturn 'oled'\n}",
    )
    replace_once(
        theme,
        "\t\tpreferredDark.value = appearance.theme",
        "\t\tpreferredDark.value = appearance.theme === 'dark' ? 'oled' : appearance.theme",
    )
    replace_once(
        theme,
        "\t\tpreferred.value = appearance.theme as ColorTheme",
        "\t\tpreferred.value = appearance.theme === 'dark' ? 'oled' : appearance.theme as ColorTheme",
    )

    # Name only the settings modal, so the Eternal Glass CSS does not touch
    # unrelated installer confirmations, warning dialogs or other popups.
    modal = FRONTEND / "features/settings/app-settings-modal/index.vue"
    replace_once(
        modal,
        '\t\tref="modal"\n\t\t:tabs="availableTabs"',
        '\t\tref="modal"\n\t\tclass="eternal-settings-modal"\n\t\t:tabs="availableTabs"',
    )


    # Apply the image (if any) before Vue paints the main launcher shell.
    main = FRONTEND / "main.js"
    replace_once(
        main,
        "import App from '@/App.vue'",
        "import { applyEternalWallpaper } from '@/features/settings/display/eternal-wallpaper'\n"
        "import { initializeEternalAppearance } from '@/features/settings/display/eternal-appearance'\n"
        "import App from '@/App.vue'",
    )
    replace_once(
        main,
        "const app = createApp(App)",
        "applyEternalWallpaper()\nvoid initializeEternalAppearance()\nconst app = createApp(App)",
    )



    # Mount seasonal particles in Vue itself, not with a short-lived DOM
    # observer started before Modrinth finishes asynchronous initialization.
    app = FRONTEND / "App.vue"
    replace_once(
        app,
        "import AppSidebar from '@/app/shell/sidebar/index.vue'",
        "import EternalParticles from '@/features/settings/display/eternal-particles.vue'\n"
        "import AppSidebar from '@/app/shell/sidebar/index.vue'",
    )
    replace_once(
        app,
        '<div class="app-viewport flex-grow router-view">',
        '<div class="app-viewport flex-grow router-view">\n\t\t\t<EternalParticles />',
    )


def install_news_config() -> None:
    cfg = json.loads((BASE / "branding/news-config.json").read_text(encoding="utf-8"))
    url = cfg.get("url", "")
    if not isinstance(url, str):
        raise RuntimeError("branding/news-config.json: url must be a string")
    if url:
        parsed = urlsplit(url)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.fragment
            or not parsed.path
        ):
            raise RuntimeError("News URL must be a public HTTPS endpoint with no login or fragment")
        if parsed.port is not None and parsed.port != 443:
            raise RuntimeError("News URL must use the standard HTTPS port (443)")
        origin = f"https://{parsed.hostname}"
        # A configured remote domain also needs an explicit CSP allowlist entry.
        tauri = ROOT / "apps/app/tauri.conf.json"
        data = json.loads(tauri.read_text(encoding="utf-8"))
        connect = data["app"]["security"]["csp"]["connect-src"]
        if origin not in connect.split():
            data["app"]["security"]["csp"]["connect-src"] = connect + " " + origin
            tauri.write_text(
                json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
        print(f"Eternal news fetch allowed in CSP: {origin}")
    else:
        print("Eternal news URL not configured; bundled welcome remains visible")

    destination = FRONTEND / "features/news/eternal-news-config.json"
    shutil.copyfile(BASE / "branding/news-config.json", destination)


def main() -> None:
    install_wallpaper()
    install_news_config()
    print("Eternal: Appearance wallpaper picker and remote news config installed.")


if __name__ == "__main__":
    main()
