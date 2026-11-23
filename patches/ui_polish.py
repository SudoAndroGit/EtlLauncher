#!/usr/bin/env python3
"""Small, guarded UI fixes for EternalLauncher on Modrinth App v0.23.5.

No changes to game launching, skin selection, user data, or Rust.
Patch only well-known Vue markers; fail the build if upstream changes.
"""
from __future__ import annotations

from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
FRONTEND = BASE / "upstream/apps/app-frontend/src"


def replace_once(path: Path, before: str, after: str) -> None:
    source = path.read_text(encoding="utf-8")
    found = source.count(before)
    if found != 1:
        raise RuntimeError(
            f"Eternal UI polish: expected one occurrence in {path.name}, "
            f"found {found}: {before[:72]!r}"
        )
    path.write_text(source.replace(before, after, 1), encoding="utf-8")


def main() -> None:
    # Mark the real running-instance action, so its red border does not
    # inherit the global Sakura button outline. Keep its native click intact.
    current_cards = FRONTEND / "components/ui/library/instance-group/instance-card.vue"
    replace_once(
        current_cards,
        'v-if="playing"\n\t\t\t\t\t\tv-tooltip="formatMessage(messages.stop)"',
        'v-if="playing"\n\t\t\t\t\t\tclass="eternal-stop-action"\n'
        '\t\t\t\t\t\tv-tooltip="formatMessage(messages.stop)"',
    )

    # Also style both legacy layouts, without changing stop handlers.
    old_cards = FRONTEND / "components/ui/Instance.vue"
    for indent in ("\t\t\t\t\t", "\t\t\t\t\t\t"):
        replace_once(
            old_cards,
            f'{indent}v-if="playing"\n{indent}v-tooltip="formatMessage(messages.stop)"',
            f'{indent}v-if="playing"\n{indent}class="eternal-stop-action"\n'
            f'{indent}v-tooltip="formatMessage(messages.stop)"',
        )

    # The add-skin tile's focus outline protrudes outside the virtual grid.
    # A named class lets CSS render the highlight INSIDE the tile instead.
    skin_list = FRONTEND / "components/ui/skin/VirtualSkinSectionList.vue"
    replace_once(
        skin_list,
        'ref="addSkinButton"\n'
        '\t\t\t\t\t\t\tclass="aspect-[31/40] w-full min-w-0 box-border rounded-[20px]"',
        'ref="addSkinButton"\n'
        '\t\t\t\t\t\t\tclass="eternal-skin-add-card aspect-[31/40] w-full min-w-0 box-border rounded-[20px]"',
    )

    # Profile pages teleport badges to the right sidebar. They hide the
    # standard account/friends/news blocks even when that content is empty.
    # Add a route-specific marker; CSS will show BOTH sets of content.
    profile = FRONTEND / "pages/User.vue"
    replace_once(
        profile,
        '<div class="w-full p-2">',
        '<div class="eternal-user-profile-page w-full p-2">',
    )
    print("Eternal: stop border, skin focus and profile sidebar markers installed.")


if __name__ == "__main__":
    main()
