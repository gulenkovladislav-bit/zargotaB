#!/usr/bin/env python3
"""Build lightweight shop-card thumbnails and crop the market crest atlas."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHOP = ROOT / "images" / "shop"
THUMBS = SHOP / "thumbs"
CRESTS = SHOP / "market-crests"
ATLAS = CRESTS / "market-crests-atlas.png"

CREST_NAMES = (
    "glupishche-last-rest",
    "glupishche-hypnoks-eye",
    "glupishche-tuk-da-bryak",
    "glupishche-three-ruts",
    "glupishche-root-post",
    "glupishche-three-strikes",
    "lesorubka-artel-yard",
    "morelesie-lighthouse-market",
    "dorogograd-golden-measure",
    "kazad-drom-thundering-mountain",
    "ztuz-licensed-counter",
    "fishhook-import-row",
    "strannograd-bog-guild",
    "shakhtogorye-black-anvil",
    "sandy-acorn-salvage",
    "levoshlak-tower-vault",
)


def crop_crests() -> None:
    if not ATLAS.exists():
        return
    CRESTS.mkdir(parents=True, exist_ok=True)
    with Image.open(ATLAS) as atlas:
        width, height = atlas.size
        for index, name in enumerate(CREST_NAMES):
            row, column = divmod(index, 4)
            left = round(column * width / 4) + 2
            top = round(row * height / 4) + 2
            right = round((column + 1) * width / 4) - 2
            bottom = round((row + 1) * height / 4) - 2
            crest = atlas.crop((left, top, right, bottom)).resize((192, 192), Image.Resampling.LANCZOS)
            crest.save(CRESTS / f"{name}.png", optimize=True)


def build_item_thumbnails() -> None:
    THUMBS.mkdir(parents=True, exist_ok=True)
    for source in sorted(SHOP.iterdir()):
        if not source.is_file() or source.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            continue
        target = THUMBS / f"{source.stem}.jpg"
        with Image.open(source) as image:
            image = image.convert("RGB")
            image.thumbnail((256, 256), Image.Resampling.LANCZOS)
            image.save(target, "JPEG", quality=76, optimize=True, progressive=True)


if __name__ == "__main__":
    crop_crests()
    build_item_thumbnails()
