#!/usr/bin/env python3

import cv2 # pip3 install opencv-python
import argparse, datetime, os
from PIL import Image, ImageOps

parser = argparse.ArgumentParser()
parser.add_argument("input", metavar='INPUT', help="input file")
parser.add_argument("-q","--quality", default=80, type=int, help="image quality (default=80)")
parser.add_argument("-s","--size", default=1920, type=int, help="max height or width (default=1920)")
# parser.add_argument("-o","--output", default="", help="full output filename")
args = parser.parse_args()

cam = cv2.imread(args.input)
cam = cv2.cvtColor(cam, cv2.COLOR_BGR2RGB)
cam = Image.fromarray(cam)
# cam = Image.open(args.input)
# cam = ImageOps.exif_transpose(cam)

ratio=max(cam.size[0:2])/args.size
print(f"{cam.size[0]}x{cam.size[1]} -> {int(cam.size[0]/ratio)}x{int(cam.size[1]/ratio)}")
cam = cam.resize((int(cam.size[0]/ratio), int(cam.size[1]/ratio)), Image.ANTIALIAS)

current_date = datetime.date.today()
current_date = current_date.strftime("%Y-%m-%d")
cnt=1
while True:
    path=f"./images/{current_date}_img{cnt}.jpg"
    if os.path.exists(path):
        cnt+=1
    else: break

print("========Markdown:========")
print(f"![...]({path})")
cam.save(path, quality=args.quality)