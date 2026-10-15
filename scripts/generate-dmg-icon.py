#!/usr/bin/env python3
"""Generate a Finder-sized mounted-volume icon without changing the app icon.

Usage: python3 scripts/generate-dmg-icon.py app.icns volume.png volume.icns
Requires Pillow and macOS iconutil. Non-macOS builds use the committed assets.
"""
from pathlib import Path
import hashlib
import subprocess
import sys
import tempfile
from PIL import Image

# Visible bounds measured against NSWorkspace's standard macOS app icons.
VISIBLE_PIXELS = {16: 14, 32: 26, 64: 52, 128: 104, 256: 206, 512: 412, 1024: 824}


def write_changed(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_bytes() != data:
        path.write_bytes(data)


def generate(source, png, icns):
    if sys.platform != 'darwin':
        print('Using committed DMG icon; generation requires macOS.')
        return
    source, png, icns = map(Path, (source, png, icns))
    stamp = icns.with_suffix(icns.suffix + '.source.sha256')
    fingerprint = hashlib.sha256(source.read_bytes() + Path(__file__).read_bytes()).hexdigest()
    if png.exists() and icns.exists() and stamp.exists() and stamp.read_text().strip() == fingerprint:
        print(f'DMG icon unchanged: {icns}')
        return
    image = Image.open(source).convert('RGBA')
    bounds = image.getchannel('A').point(lambda alpha: 255 if alpha > 128 else 0).getbbox()
    if not bounds:
        raise ValueError('Source icon artwork is empty')
    # Remove legacy transparent margins before fitting the visible tile to the
    # standard square bounds. Always start from the app asset, never our output.
    artwork = image.crop(bounds)
    with tempfile.TemporaryDirectory(prefix='mcr-dmg-icon-') as temporary:
        directory = Path(temporary) / 'volume.iconset'
        directory.mkdir()
        for size in [16, 32, 128, 256, 512]:
            for scale in [1, 2]:
                pixels = size * scale
                inner = VISIBLE_PIXELS[pixels]
                tile = artwork.resize((inner, inner), Image.Resampling.LANCZOS)
                canvas = Image.new('RGBA', (pixels, pixels))
                inset = (pixels - inner) // 2
                canvas.alpha_composite(tile, (inset, inset))
                suffix = '@2x' if scale == 2 else ''
                canvas.save(directory / f'icon_{size}x{size}{suffix}.png')
        pending = Path(temporary) / 'volume.icns'
        subprocess.run(['iconutil', '-c', 'icns', '-o', str(pending), str(directory)], check=True)
        write_changed(png, (directory / 'icon_512x512@2x.png').read_bytes())
        write_changed(icns, pending.read_bytes())
        write_changed(stamp, (fingerprint + '\n').encode())
    print(f'Generated Finder-sized DMG icon: {icns}')


if __name__ == '__main__':
    generate(*sys.argv[1:])
