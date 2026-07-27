"""TYPE A stem: first character of each whitespace-separated word."""

from __future__ import annotations


def stem_type_a(name: str) -> str:
    parts: list[str] = []
    for word in (name or "").split():
        if not word:
            continue
        ch = word[0]
        if ch.isalpha():
            parts.append(ch.upper())
        elif ch.isdigit():
            parts.append(ch)
        else:
            for c in word:
                if c.isalpha():
                    parts.append(c.upper())
                    break
                if c.isdigit():
                    parts.append(c)
                    break
    return "".join(parts) or "X"
