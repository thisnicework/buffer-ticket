#!/usr/bin/env python3
"""포스터 A(assets/design/POSTER/BUFFER Poster_A.png)에서 떨어지는 상자 스프라이트를 만든다 → public/fall/sq-*.png
사용: python3 scripts/build-fall.py . 0.05   (Pillow, numpy, scipy 필요)"""
import sys
from PIL import Image
import numpy as np
from scipy import ndimage
Image.MAX_IMAGE_PIXELS=None
root=sys.argv[1]; th=float(sys.argv[2])
src=Image.open(root+"/assets/design/POSTER/BUFFER Poster_A.png").convert("L"); g=np.array(src)
def sprite(gray, mask, name, fill=True, size=360):
    gray=gray.copy()
    if fill:  # 상자 안의 큰 흰 면(다른 상자와의 틈)은 검정으로 메워 점선만 남김
        white=mask&(gray>=128); lab,n=ndimage.label(white); sz=np.bincount(lab.ravel())
        big=np.isin(lab,np.nonzero(sz>mask.sum()*th)[0]); big&=white; gray[big]=0
    inv=255-gray
    im=Image.fromarray(np.dstack([inv,inv,inv,(mask*255).astype(np.uint8)]),"RGBA")
    im=im.crop(im.getchannel("A").getbbox()); im.thumbnail((size,size),Image.LANCZOS)
    im.save(root+"/public/fall/"+name,optimize=True)
crop=g[5100:6420,480:1760]
m=ndimage.binary_fill_holes(ndimage.binary_closing(crop<128,iterations=24))
lab,n=ndimage.label(m); m=lab==(np.argmax(np.bincount(lab.ravel())[1:])+1)
sprite(crop,m,"sq-0.png",fill=False)
cuts=[(1900,1900,1100,8),(3350,1050,1000,-12),(1200,3050,1000,20),(2600,3800,1150,-6),(4300,3500,900,14),(3000,5100,950,-18),(700,1500,900,4),(4100,5500,800,-24)]
for i,(cx,cy,sz,ang) in enumerate(cuts,1):
    h=int(sz*0.75); r=sz//2
    a=np.array(src.crop((cx-h,cy-h,cx+h,cy+h)).rotate(ang,resample=Image.BICUBIC,fillcolor=255)); c=a.shape[0]//2; a=a[c-r:c+r,c-r:c+r]
    sq=np.array(Image.fromarray(a).rotate(-ang*1.6,resample=Image.BICUBIC,expand=True,fillcolor=255))
    mk=np.array(Image.fromarray(np.full(a.shape,255,np.uint8)).rotate(-ang*1.6,resample=Image.BICUBIC,expand=True,fillcolor=0))>127
    sprite(sq,mk,f"sq-{i}.png")
