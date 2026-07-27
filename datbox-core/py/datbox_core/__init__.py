"""datbox-core — shared DATBOX shelf + bag plumbing (not a runnable ROM)."""

from .prefs_schema import (
    DEFAULT_DESK_PREFS,
    coerce_desk_prefs,
    normalize_theme,
    normalize_window_mode,
)
from .profile import MatProfile
from .static_mount import try_serve_core_static
from .stem import stem_type_a
from .vault import SafeVault

__all__ = [
    "MatProfile",
    "SafeVault",
    "stem_type_a",
    "DEFAULT_DESK_PREFS",
    "coerce_desk_prefs",
    "normalize_theme",
    "normalize_window_mode",
    "try_serve_core_static",
]
