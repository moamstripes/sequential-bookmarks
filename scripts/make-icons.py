#!/usr/bin/env python3
"""Draws chrome/icons/icon-<size>.png from the same shapes as firefox/icons/icon.svg.

Chrome needs PNG icons and no image library is assumed, so this uses the standard library only.
Run it after changing the shapes in icon.svg: python3 scripts/make-icons.py
"""
import struct
import zlib
from pathlib import Path

SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 4  # sub-pixels per side, for smooth edges
BLUE = (0x4A, 0x7F, 0xD4)
WHITE = (255, 255, 255)
DOTS = ((48, 30, 1.0), (48, 43, 0.6), (48, 56, 0.3))  # x, y, opacity in the 96 x 96 drawing


def inside_background(x, y):
    """Rounded square, 4 to 92, corner radius 18."""
    if not (4 <= x <= 92 and 4 <= y <= 92):
        return False
    cx = min(max(x, 22), 74)
    cy = min(max(y, 22), 74)
    return (x - cx) ** 2 + (y - cy) ** 2 <= 18**2


def inside_ribbon(x, y):
    """Bookmark ribbon with a notch in the bottom edge and rounded top corners."""
    if not (24 <= x <= 72 and 14 <= y <= 84):
        return False
    if y > 66 + 0.75 * abs(x - 48):
        return False
    cx = min(max(x, 28), 68)
    cy = max(y, 18)
    return (x - cx) ** 2 + (y - cy) ** 2 <= 4**2 if y < 18 else True


def sample(x, y):
    """Colour and alpha of the drawing at one point (premultiplied RGB plus alpha)."""
    if not inside_background(x, y):
        return (0.0, 0.0, 0.0, 0.0)
    colour = BLUE
    if inside_ribbon(x, y):
        colour = WHITE
        for dx, dy, opacity in DOTS:
            if (x - dx) ** 2 + (y - dy) ** 2 <= 5**2:
                colour = tuple(b * opacity + w * (1 - opacity) for b, w in zip(BLUE, colour))
    return (*colour, 1.0)


def render(size):
    rows = []
    scale = 96 / (size * SUPERSAMPLE)
    for py in range(size):
        row = bytearray([0])  # PNG filter type: none
        for px in range(size):
            r = g = b = a = 0.0
            for sy in range(SUPERSAMPLE):
                for sx in range(SUPERSAMPLE):
                    cr, cg, cb, ca = sample((px * SUPERSAMPLE + sx + 0.5) * scale, (py * SUPERSAMPLE + sy + 0.5) * scale)
                    r, g, b, a = r + cr * ca, g + cg * ca, b + cb * ca, a + ca
            if a:
                row += bytes((round(r / a), round(g / a), round(b / a), round(255 * a / SUPERSAMPLE**2)))
            else:
                row += bytes(4)
        rows.append(bytes(row))
    return b"".join(rows)


def png(size):
    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(render(size), 9)) + chunk(b"IEND", b"")


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "chrome" / "icons"
    for size in SIZES:
        (out / f"icon-{size}.png").write_bytes(png(size))
        print(f"wrote {out / f'icon-{size}.png'}")
