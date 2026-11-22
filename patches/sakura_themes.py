#!/usr/bin/env python3
"""Add Sakura as a frontend theme without changing Modrinth's Rust theme enum.

Run after wallpaper_news_launcher.py. Guard every edit against upstream drift.
The persisted native theme for Sakura is OLED, with local frontend choice kept
in eternal.theme.choice.v1; other system/Light/OLED settings remain native.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "upstream"
FRONTEND = ROOT / "apps/app-frontend/src"


def replace_once(path: Path, before: str, after: str) -> None:
    content = path.read_text(encoding="utf-8")
    matches = content.count(before)
    if matches != 1:
        raise RuntimeError(f"Sakura patch marker count {matches} in {path}: {before[:85]!r}")
    path.write_text(content.replace(before, after, 1), encoding="utf-8")


def main() -> None:
    theme = FRONTEND / "composables/use-theme.ts"
    replace_once(
        theme,
        "export const THEME_OPTIONS = ['dark', 'light', 'oled', 'retro', 'system'] as const",
        "export const THEME_OPTIONS = ['sakura', 'dark', 'light', 'oled', 'retro', 'system'] as const",
    )
    replace_once(
        theme,
        "export const DARK_THEMES = ['dark', 'oled', 'retro'] as const",
        "export const DARK_THEMES = ['sakura', 'dark', 'oled', 'retro'] as const",
    )
    replace_once(
        theme,
        "return stored === 'dark' ? 'oled' : (stored as ColorTheme)",
        "return stored === 'dark' ? 'sakura' : (stored as ColorTheme)",
    )
    replace_once(
        theme,
        "\treturn 'oled'\n}\n\nfunction loadPreferredDarkTheme()",
        "\treturn 'sakura'\n}\n\nfunction loadPreferredDarkTheme()",
    )
    replace_once(
        theme,
        "\t\t\treturn stored === 'dark' ? 'oled' : stored",
        "\t\t\treturn stored === 'dark' ? 'sakura' : stored",
    )
    replace_once(
        theme,
        "\treturn 'oled'\n}\n\nconst preferred = ref<ColorTheme>",
        "\treturn 'sakura'\n}\n\nconst preferred = ref<ColorTheme>",
    )
    replace_once(
        theme,
        "html.classList.add(`${theme}-mode`)",
        "html.classList.add(`${theme}-mode`)\n"
        "\t\t// Reuse Modrinth's dark color tokens for the Sakura interface.\n"
        "\t\tif (theme === 'sakura') html.classList.add('dark-mode')",
    )
    replace_once(
        theme,
        "\t\tpreferredDark.value = appearance.theme === 'dark' ? 'oled' : appearance.theme",
        "\t\tpreferredDark.value = appearance.theme === 'dark' ? 'sakura' : appearance.theme",
    )
    replace_once(
        theme,
        "\t\tpreferred.value = appearance.theme === 'dark' ? 'oled' : appearance.theme as ColorTheme",
        "\t\tpreferred.value = resolveEternalPreferredTheme(appearance.theme) as ColorTheme",
    )
    content = theme.read_text(encoding="utf-8")
    anchor = "const PREFERRED_THEME_KEY = 'modrinth-theme'"
    if content.count(anchor) != 1:
        raise RuntimeError("Unable to insert Sakura theme persistence")
    content = content.replace(anchor, """const ETERNAL_THEME_KEY = 'eternal.theme.choice.v1'

/** Persist the choice locally because Modrinth's native theme enum lacks Sakura. */
export function rememberEternalThemeChoice(theme: string): void {
  try { window.localStorage.setItem(ETERNAL_THEME_KEY, theme) } catch { /* optional */ }
}

/** Old experimental builds used OLED to represent the Sakura Glass theme.
 * Migrate once; intentional OLED choices in this build remain remembered.
 */
export function resolveEternalPreferredTheme(theme: string): ColorTheme {
  if (theme === 'light' || theme === 'system') return theme
  if (theme === 'sakura') return 'sakura'
  let saved: string | null = null
  try { saved = window.localStorage.getItem(ETERNAL_THEME_KEY) } catch { /* optional */ }
  if (saved === 'oled') return 'oled'
  if (saved === 'sakura') return 'sakura'
  return 'sakura'
}

""" + anchor, 1)
    theme.write_text(content, encoding="utf-8")

    # The upstream generic selector gracefully supports an added theme card.
    selector = ROOT / "packages/ui/src/layouts/shared/appearance-settings/components/appearance-settings-theme-selector.vue"
    replace_once(
        selector,
        "const themeLabels = defineMessages({",
        "const themeLabels = defineMessages({\n"
        "\tsakura: { id: 'eternal.settings.theme.sakura', defaultMessage: 'Sakura' },",
    )

    settings = FRONTEND / "features/settings/display/appearance-settings.vue"
    replace_once(
        settings,
        "option === 'oled' || option === 'light' || option === 'system'",
        "option === 'sakura' || option === 'oled' || option === 'light' || option === 'system'",
    )
    replace_once(
        settings,
        "import { type ColorTheme, isDarkTheme, useTheme } from '@/composables/use-theme.ts'",
        "import { type ColorTheme, isDarkTheme, rememberEternalThemeChoice, useTheme } "
        "from '@/composables/use-theme.ts'",
    )
    replace_once(
        settings,
        "appearance: value.theme === 'system' ? { auto: true } : { auto: false, theme: value.theme },",
        "appearance: value.theme === 'system' ? { auto: true } : "
        "{ auto: false, theme: value.theme === 'sakura' ? 'oled' : value.theme },",
    )
    replace_once(
        settings,
        "\t\t\ttheme: value.theme,",
        "\t\t\ttheme: value.theme === 'sakura' ? 'oled' : value.theme,",
    )
    replace_once(
        settings,
        "\t\tawait set(nextSettings)",
        "\t\tawait set(nextSettings)\n"
        "\t\trememberEternalThemeChoice(value.theme)",
    )

    app = FRONTEND / "App.vue"
    replace_once(
        app,
        "import { isDarkTheme, useTheme } from '@/composables/use-theme.ts'",
        "import { isDarkTheme, resolveEternalPreferredTheme, useTheme } from '@/composables/use-theme.ts'",
    )
    replace_once(
        app,
        "\tappTheme.preferred = theme",
        "\tappTheme.preferred = resolveEternalPreferredTheme(theme)",
    )
    replace_once(
        app,
        "\t\t\t\t\tappTheme.preferred = selectedTheme",
        "\t\t\t\t\tappTheme.preferred = resolveEternalPreferredTheme(selectedTheme)",
    )

    # The browse page gets a target class: its actual ProjectCard components
    # can be themed by CSS without affecting the library's own instance cards.
    browse = FRONTEND / "platform/adapters/browse/browse-page.vue"
    replace_once(
        browse,
        '<div class="flex flex-col gap-2 p-6">',
        '<div class="eternal-browse-page flex flex-col gap-2 p-6">',
    )

    print("Eternal: Sakura default and OLED-black menus are ready for CSS.")


if __name__ == "__main__":
    main()
