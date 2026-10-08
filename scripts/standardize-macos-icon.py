#!/usr/bin/env python3
"""Match ProfitPulse's macOS framing for both the app bundle and running Dock.

The source artwork stays separate so repeated builds never add more padding.
Requires Pillow, also used by the desktop icon generators.
"""
from pathlib import Path
from io import BytesIO
import sys
from PIL import Image, ImageDraw

BOUNDS = (69, 58, 955, 966)
REPRESENTATIONS = {"icp4":16,"icp5":32,"icp6":64,"ic07":128,"ic08":256,
                   "ic09":512,"ic10":1024,"ic11":32,"ic12":64,"ic13":256,"ic14":512}

def write_changed(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_bytes() != data:
        path.write_bytes(data)

def generate(source, png, icns):
    image = Image.open(source).convert("RGBA")
    bounds = image.getchannel("A").point(lambda alpha: 255 if alpha > 128 else 0).getbbox()
    if not bounds:
        raise ValueError("App icon artwork is empty")
    if image.size == (1024, 1024) and bounds == BOUNDS:
        canvas = image
    else:
        art = image.crop(bounds)
        # Keep the artwork's proportions inside a tile with the reference bounds.
        width, height = BOUNDS[2]-BOUNDS[0], BOUNDS[3]-BOUNDS[1]
        if max(art.width/art.height, art.height/art.width) > 1.15:
            tile = Image.new("RGBA", (width,height), (245,245,245,255))
            art.thumbnail((width,height),Image.Resampling.LANCZOS)
            tile.alpha_composite(art, ((width-art.width)//2,(height-art.height)//2))
        else:
            tile = art.resize((width,height),Image.Resampling.LANCZOS)
        if bounds == (0,0,image.width,image.height) or max(image.width/image.height,image.height/image.width)>1.15 or max(art.width/art.height,art.height/art.width)>1.15:
            mask = Image.new("L", tile.size)
            ImageDraw.Draw(mask).rounded_rectangle((0,0,width-1,height-1),radius=180,fill=255)
            tile.putalpha(mask)
        canvas = Image.new("RGBA", (1024,1024))
        canvas.alpha_composite(tile, BOUNDS[:2])
    buffer=BytesIO();canvas.save(buffer,format="PNG",optimize=True)
    write_changed(Path(png),buffer.getvalue())
    entries=[]
    for tag,size in REPRESENTATIONS.items():
        buffer=BytesIO();canvas.resize((size,size),Image.Resampling.LANCZOS).save(buffer,format="PNG")
        data=buffer.getvalue();entries.append(tag.encode()+ (len(data)+8).to_bytes(4,"big") + data)
    data=b"".join(entries)
    write_changed(Path(icns),b"icns"+(len(data)+8).to_bytes(4,"big")+data)

if __name__ == "__main__":
    generate(*sys.argv[1:])
