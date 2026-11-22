#!/usr/bin/env python3
"""Apply the EtlLauncher UI patch to a fresh checkout of modrinth/code.

Fail closed when upstream changes the required source snippets.
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "upstream"

def replace_once(path: Path, old: str, new: str) -> None:
    content = path.read_text(encoding="utf-8")
    if content.count(old) != 1:
        raise RuntimeError(f"Expected exactly one match in {path.relative_to(ROOT)}: {old[:65]!r}")
    path.write_text(content.replace(old, new, 1), encoding="utf-8")

def main() -> None:
    config = ROOT / "apps/app/tauri.conf.json"
    data = json.loads(config.read_text(encoding="utf-8"))
    assert data["productName"] == "Modrinth App"
    assert data["mainBinaryName"] == "Modrinth App"
    assert data["app"]["windows"][0]["title"] == "Modrinth App"
    data["productName"] = "EtlLauncher"
    data["mainBinaryName"] = "EtlLauncher"
    data["app"]["windows"][0]["title"] = "EtlLauncher"
    # Keep the upstream identifier and data directories for compatibility.
    config.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    app = ROOT / "apps/app-frontend/src/App.vue"
    replace_once(
        app,
        "const showAd = computed(\n\t() => sidebarVisible.value && !hasPlus.value && credentials.value !== undefined,\n)",
        "const showAd = computed(() => false)",
    )
    replace_once(
        app,
        "const adConsentAvailable = computed(() => credentials.value !== undefined && !hasPlus.value)",
        "const adConsentAvailable = computed(() => false)",
    )
    # Prevent the app from initiating the ads Tauri window at all.
    replace_once(
        app,
        "if (showAds) {\n\t\t\tawait init_ads_window(true)",
        "if (false && showAds) {\n\t\t\tawait init_ads_window(true)",
    )
    # Disable official update checks, which would replace this customized build.
    utils = ROOT / "apps/app-frontend/src/helpers/utils.js"
    replace_once(
        utils,
        "export async function areUpdatesEnabled() {\\n\\treturn await invoke('are_updates_enabled')\\n}",
        "export async function areUpdatesEnabled() {\\n\\treturn false\\n}",
    )
    print("EtlLauncher name, ad UI and updater patch applied.")
    print("Note: backend ad code remains; this is NOT a complete removal of ad infrastructure.")

if __name__ == "__main__":
    main()
