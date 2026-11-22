#!/usr/bin/env python3
"""Eternal UI features: hide paid hosting, welcome panel and Discord branding.

Apply after patch_launcher.py and brand_launcher.py to a fresh official
Modrinth App source checkout. Deliberately fail on changed upstream markers.
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT / "upstream"
FRONTEND = ROOT / "apps/app-frontend/src"


def replace_once(path: Path, before: str, after: str) -> None:
    source = path.read_text(encoding="utf-8")
    count = source.count(before)
    if count != 1:
        raise RuntimeError(
            f"Expected exactly one match in {path.relative_to(ROOT)} "
            f"but found {count}: {before[:85]!r}"
        )
    path.write_text(source.replace(before, after, 1), encoding="utf-8")


def remove_hosting_navigation() -> None:
    # Remove only the paid Hosting navigation entry, not underlying shared
    # instance/network APIs which the Minecraft launcher still uses.
    app = FRONTEND / "App.vue"
    replace_once(app, "\tServerStackIcon,\n", "")
    replace_once(
        app,
        "\tmodrinthHosting: {\n"
        "\t\tid: 'app.nav.modrinth-hosting',\n"
        "\t\tdefaultMessage: 'Modrinth Hosting',\n"
        "\t},\n",
        "",
    )
    source = app.read_text(encoding="utf-8")
    pattern = (
        r'\t\t\t<NavButton\n'
        r'\t\t\t\tv-tooltip\.right="formatMessage\(messages\.modrinthHosting\)"'
        r'[\s\S]*?\t\t\t</NavButton>\n'
    )
    matches = list(re.finditer(pattern, source))
    if len(matches) != 1 or 'to="/hosting/manage"' not in matches[0].group():
        raise RuntimeError("Cannot safely locate the dedicated Hosting navigation button")
    app.write_text(
        source[: matches[0].start()] + source[matches[0].end() :],
        encoding="utf-8",
    )
    # Avoid automatically querying paid Hosting data just after login.
    replace_once(
        app,
        "import { prefetchHostingData } from '@/features/hosting/prefetch'\n",
        "",
    )
    replace_once(
        app,
        "watch(\n"
        "\t() => stateInitialized.value && credentials.value?.session,\n"
        "\t(session) => {\n"
        "\t\tif (!session) return\n"
        "\n"
        "\t\tvoid prefetchHostingData(\n"
        "\t\t\tqueryClient,\n"
        "\t\t\ttauriApiClient,\n"
        "\t\t\ticonCache,\n"
        "\t\t\t() => credentials.value?.session === session,\n"
        "\t\t)\n"
        "\t},\n"
        ")\n\n",
        "",
    )


def install_welcome_panel() -> None:
    # All welcome copy is editable from branding/welcome.json in this repo.
    news_dir = FRONTEND / "features/news"
    shutil.copyfile(PROJECT / "branding/welcome.json", news_dir / "eternal-welcome.json")
    shutil.copyfile(
        PROJECT / "branding/welcome-sidebar.vue",
        news_dir / "eternal-welcome-sidebar.vue",
    )
    sidebar = FRONTEND / "app/shell/sidebar/index.vue"
    replace_once(
        sidebar,
        "import NewsSidebar from '@/features/news/news-sidebar.vue'",
        "import EternalWelcomeSidebar from '@/features/news/eternal-welcome-sidebar.vue'",
    )
    replace_once(
        sidebar,
        '<NewsSidebar :style="promotionPaddingStyle" />',
        '<EternalWelcomeSidebar :style="promotionPaddingStyle" />',
    )
    # The first-run screen also uses Eternal branding and our Sakura logo.
    first_run = FRONTEND / "components/ui/WelcomeScreen.vue"
    replace_once(
        first_run,
        "import modrinthSocialIcon from '../../assets/welcome/modrinth-social-icon.png'",
        "import eternalLogo from '@/assets/eternal-logo.png'",
    )
    replace_once(
        first_run,
        ':src="modrinthSocialIcon"',
        ':src="eternalLogo"',
    )
    replace_once(
        first_run,
        "id: 'app.welcome-screen.title',\n\t\tdefaultMessage: 'Welcome to Modrinth'",
        "id: 'eternal.welcome-screen.title',\n\t\tdefaultMessage: 'Bienvenido a Eternal'",
    )


def configure_discord_presence() -> None:
    # Discord displays the APPLICATION NAME from the developer portal, not the
    # executable name. A separate Discord app named EternalLauncher is required.
    # The App ID is supplied as a GitHub Actions variable (not a bot token).
    # When unset/invalid, never connect to Modrinth's official Discord app.
    discord = ROOT / "packages/app-lib/src/state/discord.rs"
    replace_once(
        discord,
        '        let dipc = DiscordIpcClient::new("1123683254248148992");',
        '        let app_id = option_env!("ETERNAL_DISCORD_CLIENT_ID").unwrap_or("");\n'
        '        let dipc = DiscordIpcClient::new(app_id);',
    )
    replace_once(
        discord,
        "    pub async fn retry_if_not_ready(&self) -> bool {\n",
        "    pub async fn retry_if_not_ready(&self) -> bool {\n"
        '        let valid_id = option_env!("ETERNAL_DISCORD_CLIENT_ID")\n'
        "            .is_some_and(|id| (17..=20).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_digit()));\n"
        "        if !valid_id {\n"
        "            return false; // No application configured; do not use Modrinth's RPC identity.\n"
        "        }\n",
    )
    replace_once(
        discord,
        '        let activity = Activity::new().state(msg).assets(',
        '        let activity = Activity::new().details("EternalLauncher").state(msg).assets(',
    )
    replace_once(discord, '.large_image("modrinth_simple")', '.large_image("eternal_logo")')
    replace_once(discord, '.large_text("Modrinth Logo")', '.large_text("EternalLauncher")')
    # The privacy switch should describe the actual customized activity.
    privacy = FRONTEND / "features/settings/account/privacy-settings.vue"
    replace_once(
        privacy,
        "id: 'app.settings.privacy.discord-rich-presence.description'",
        "id: 'eternal.settings.privacy.discord-rich-presence.description'",
    )
    replace_once(
        privacy,
        "'Show Modrinth App as your current activity on Discord. This does not affect Rich Presence added to instances by mods. Requires an app restart.',",
        "'Muestra EternalLauncher en Discord al configurar una aplicación propia. No afecta a las actividades añadidas por mods. Reinicia el launcher tras cambiar este ajuste.',",
    )


def main() -> None:
    remove_hosting_navigation()
    install_welcome_panel()
    configure_discord_presence()
    print("Eternal UI: Hosting nav hidden; editable welcome panel installed.")
    print("Discord RPC: EternalLauncher application ID required; no Modrinth identity fallback.")


if __name__ == "__main__":
    main()
