#!/usr/bin/env python3
"""Disable optional EtlLauncher telemetry without breaking local diagnostics.

Applies to a fresh upstream modrinth/code checkout. Fail closed if an
upstream change invalidates any guarded replacement.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "upstream"
FRONTEND = ROOT / "apps/app-frontend/src"


def replace_once(path: Path, before: str, after: str) -> None:
    source = path.read_text(encoding="utf-8")
    count = source.count(before)
    if count != 1:
        raise RuntimeError(
            f"Expected exactly one telemetry match in {path.relative_to(ROOT)} "
            f"but found {count}: {before[:70]!r}"
        )
    path.write_text(source.replace(before, after, 1), encoding="utf-8")


def main() -> None:
    # Do not initialize the production Sentry SDK (error reporting and 10%
    # sampled browser traces) when starting the desktop UI. Vue still logs
    # uncaught errors to the normal local browser/devtools console.
    entrypoint = FRONTEND / "main.js"
    replace_once(entrypoint, "import { setupErrorReporting } from '@/helpers/error-reporting'\n", "")
    replace_once(entrypoint, "setupErrorReporting(app, router)\n", "")

    # The upstream analytics helper currently implements no-op functions.
    # Explicitly turn off the persisted preference in the Rust settings layer:
    # old profile databases may have telemetry enabled even on new installs.
    rust_settings = ROOT / "packages/app-lib/src/state/settings.rs"
    replace_once(
        rust_settings,
        "            telemetry: res.telemetry == 1,\n",
        "            telemetry: false, // EtlLauncher: no optional usage analytics\n",
    )
    replace_once(
        rust_settings,
        "            self.telemetry,\n",
        "            false, // EtlLauncher: persist telemetry disabled\n",
    )

    # Reflect the enforced setting in the UI while preserving other controls
    # (such as Discord Rich Presence) and their existing behavior.
    privacy_page = FRONTEND / "features/settings/account/privacy-settings.vue"
    replace_once(
        privacy_page,
        '<Toggle id="opt-out-analytics" v-model="settings.telemetry" />',
        '<Toggle id="opt-out-analytics" :model-value="false" disabled />',
    )
    replace_once(
        privacy_page,
        "defaultMessage:\n"
        "\t\t\t'Modrinth collects anonymized analytics and usage data to improve our user experience and customize your experience. By disabling this option, you opt out and your data will no longer be collected.',",
        "defaultMessage:\n"
        "\t\t\t'Optional usage analytics and remote error reporting are disabled in EtlLauncher. Local logs and necessary online features still work.',",
    )
    replace_once(
        privacy_page,
        "id: 'app.settings.privacy.telemetry.description'",
        "id: 'etllauncher.settings.privacy.telemetry.description'",
    )

    print("EtlLauncher: optional telemetry disabled; Sentry not initialized.")
    print("Local logs, download/network APIs and Discord Rich Presence remain unchanged.")


if __name__ == "__main__":
    main()
