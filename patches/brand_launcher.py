#!/usr/bin/env python3
"""Apply EtlLauncher Sakura branding to the upstream desktop app.

Runs after patches/patch_launcher.py. Fails closed when upstream UI layout changes.
"""
from __future__ import annotations

import base64
import re
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
UPSTREAM = PROJECT / "upstream"
FRONTEND = UPSTREAM / "apps/app-frontend/src"


def replace_once(path: Path, original: str, updated: str) -> None:
    contents = path.read_text(encoding="utf-8")
    count = contents.count(original)
    if count != 1:
        raise RuntimeError(f"Expected one occurrence in {path}: {original[:70]!r}; found {count}")
    path.write_text(contents.replace(original, updated, 1), encoding="utf-8")


def main() -> None:
    # Store the user-supplied (compressed) transparent Sakura logo as a base64
    # text asset in Git; decode it to a regular PNG before Vite and Tauri run.
    logo_b64 = (PROJECT / "branding/logo.png.b64").read_text(encoding="ascii").strip()
    icon = base64.b64decode(logo_b64, validate=True)
    if not icon.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError("branding/logo.png.b64 does not contain a PNG image")
    (PROJECT / "branding/logo.png").write_bytes(icon)
    (FRONTEND / "assets/etllauncher-logo.png").write_bytes(icon)

    theme = (PROJECT / "branding/theme.css").read_text(encoding="utf-8")
    (FRONTEND / "etllauncher-theme.css").write_text(theme, encoding="utf-8")
    index = UPSTREAM / "apps/app-frontend/index.html"
    replace_once(
        index,
        "<title>Modrinth App</title>",
        '<title>EtlLauncher</title>',
    )
    replace_once(
        index,
        '<link rel="icon" type="image/svg+xml" href="/vite.svg" />',
        '<link rel="icon" type="image/png" href="/src/assets/etllauncher-logo.png" />',
    )
    replace_once(
        index,
        '<link rel="stylesheet" href="/src/assets/stylesheets/global.scss" />',
        '<link rel="stylesheet" href="/src/assets/stylesheets/global.scss" />'
        '\n\t\t<link rel="stylesheet" href="/src/etllauncher-theme.css" />',
    )

    title = FRONTEND / "app/shell/title-bar/index.vue"
    replace_once(title, "IconButton, TextLogo, useVIntl", "IconButton, useVIntl")
    replace_once(
        title,
        "import AppActionBar from './action-bar.vue'",
        "import etlLogo from '@/assets/etllauncher-logo.png'\n\nimport AppActionBar from './action-bar.vue'",
    )
    replace_once(
        title,
        '<TextLogo class="h-7 w-auto shrink-0 text-contrast pointer-events-none" />',
        '<img :src="etlLogo" alt="" class="h-7 w-7 shrink-0 object-contain pointer-events-none" />\n'
        '\t\t\t<span class="ml-1 text-base font-semibold tracking-wide text-brand pointer-events-none">'
        'EtlLauncher</span>',
    )

    splash = FRONTEND / "components/ui/SplashScreen.vue"
    old = splash.read_text(encoding="utf-8")
    new, count = re.subn(
        r'<svg\s+class="app-logo".*?</svg>',
        '<div class="etl-splash-brand">'
        '<img :src="etlLogo" alt="" class="etl-splash-icon" />'
        '<strong class="etl-splash-name">EtlLauncher</strong>'
        '</div>',
        old,
        count=1,
        flags=re.DOTALL,
    )
    if count != 1:
        raise RuntimeError("Cannot locate exactly one Modrinth splash SVG")
    if "<script setup>" not in new:
        raise RuntimeError("Cannot locate splash script setup")
    new = new.replace(
        "<script setup>",
        "<script setup>\nimport etlLogo from '@/assets/etllauncher-logo.png'",
        1,
    )
    css = """
.etl-splash-brand {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}
.etl-splash-icon {
  width: 3.2rem;
  height: 3.2rem;
  object-fit: contain;
}
.etl-splash-name {
  font-size: 1.7rem;
  letter-spacing: 0.01em;
  color: var(--color-brand);
  font-weight: 750;
}
"""
    if "<style scoped lang=\"scss\">" not in new:
        raise RuntimeError("Cannot locate splash scoped stylesheet")
    new = new.replace("<style scoped lang=\"scss\">", "<style scoped lang=\"scss\">\n" + css, 1)
    splash.write_text(new, encoding="utf-8")

    settings = FRONTEND / "features/settings/app-settings-modal/index.vue"
    replace_once(settings, "defaultMessage: 'Modrinth App {version}'", "defaultMessage: 'EtlLauncher {version}'")

    print("Sakura branding applied to the desktop titlebar, splash, settings and CSS.")
    print("Icon conversion for Tauri is handled separately by the workflow.")


if __name__ == "__main__":
    main()
