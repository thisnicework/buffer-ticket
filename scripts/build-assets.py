#!/usr/bin/env python3
"""assets/ 원본(수 MB~26MB)을 웹용으로 줄여 public/img 에 만든다. 원본이 바뀔 때만 실행: python3 scripts/build-assets.py"""
import glob, os
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, "public", "img"); os.makedirs(out, exist_ok=True)

def save(src, name, width, fmt="JPEG"):
    im = Image.open(src); im = im.convert("RGBA" if fmt == "PNG" else "RGB")
    if fmt == "PNG":  # 로고: 투명 여백 제거
        box = im.getchannel("A").getbbox()
        if box: im = im.crop(box)
    im.thumbnail((width, 99999), Image.LANCZOS)
    path = os.path.join(out, name)
    im.save(path, fmt, **({"optimize": True} if fmt == "PNG" else {"quality": 82, "optimize": True, "progressive": True}))
    print(name, im.size, os.path.getsize(path) // 1024, "KB")

for i in range(1, 11):
    save(f"{root}/assets/profile/Buffer_Profile_v1027-{i}.jpg", f"profile-{i}.jpg", 1600 if i == 10 else 900)
for k in "AB":
    save(f"{root}/assets/design/POSTER/(업로드용) BUFFER Poster_{k}.jpg", f"poster-{k.lower()}.jpg", 1000)
for color in ("Black", "White"):
    for f in glob.glob(f"{root}/assets/design/LOGO/{color}/*.png"):
        slug = os.path.basename(f)[:-4].replace("BUFFER Logo", "logo").replace("_White", "").strip("_").lower().replace(" ", "")
        save(f, f"{slug if slug != 'logo' else 'logo'}-{color.lower()}.png".replace("logo_", "logo-"), 800, "PNG")
