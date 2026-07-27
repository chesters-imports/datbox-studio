"""Mat / ROM profile — what makes each DATBOX island different."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MatProfile:
    """
    rom_slug: used for shelf paper _{rom_slug}.datshelf (e.g. lorebox).
    bag_ext / legacy_ext: bag files only — never .datshelf.
    mat: written into empty boxes (lore | shot | …).
    """

    rom_slug: str
    bag_ext: str
    legacy_ext: str
    mat: str
    house: str = "DATBOX"

    def __post_init__(self) -> None:
        if not self.rom_slug or not self.rom_slug.replace("-", "").isalnum():
            raise ValueError("rom_slug must be simple alnum/hyphen")
        if not self.bag_ext.startswith("."):
            raise ValueError("bag_ext must start with .")
