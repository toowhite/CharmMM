'use strict';

import {graphics as _graphics} from 'systeminformation';
import Jimp, {read} from 'jimp';
import {readdirSync} from 'fs';
import sizeOf from 'image-size';
import {join} from 'path';
import {set} from 'wallpaper';
import {BackgroundColor, PictureFolder, FitMode} from './config.json';

function getWallpaperSizeAndFixPositions(displays) {
  let height = 0;
  let width = 0;
  let minPosX = Infinity;
  let minPosY = Infinity;
  for (const display of displays) {
    if (display.positionX < minPosX) {
      minPosX = display.positionX;
    }
    if (display.positionY < minPosY) {
      minPosY = display.positionY;
    }
    if (display.currentResY > height) {
      height = display.currentResY;
    }
    width += display.currentResX;
  }

  for (const display of displays) {
    display.positionX -= minPosX;
    display.positionY -= minPosY;
  }

  return {h: height, w: width};
}

function shuffle(array) {
  array.sort(() => Math.random() - 0.5);
}

function getAdjustmentParameters(picWidth, picHeight, displayWidth, displayHeight, mode) {
  const params = {};
  if (mode == 'center') {
    let scale = Math.max(displayWidth / picWidth, displayHeight / picHeight);
    if (scale >= 0.9) scale = 1;
    params.x = (picWidth * scale - displayWidth) / 2;
    params.y = (picHeight * scale - displayHeight) / 2;
    params.w = displayWidth;
    params.h = displayHeight;
    params.scale = scale;
  }

  return params;
}

async function generateWallpaper(size, displays) {
  const image = new Jimp(size.w, size.h, BackgroundColor);

  const picks = [];
  for (const display of displays) {
    let picked;
    do {
      const ratio = display.currentResX / display.currentResY;
      const landscapeDisplay = landscapeRatio(ratio);
      picked = randomPick(landscapeDisplay, display.currentResX, display.currentResY);
    } while (picks.includes(picked));
    picks.push(picked);
    const picData = await read(join(PictureFolder, picked.file));
    if (FitMode == 'center') {
      const cp = getAdjustmentParameters(picked.correctedWidth, picked.correctedHeight, display.currentResX, display.currentResY, FitMode);
      if (cp.scale != 1) {
        picData.scale(cp.scale);
      }
      image.blit(picData, display.positionX, display.positionY, cp.x, cp.y, cp.w, cp.h);
    } else {
      throw new Error('Unsupported fit mode');
    }
  }
  // console.log(pics);

  const fullpath = join(__dirname, '_tmp.jpg');
  image.write(fullpath);
  return fullpath;
}

function isLandscapePic(size) {
  const ratio = size.width / size.height;
  if (size.hasOwnProperty('orientation')) {
    return landscapeRatio(ratio) && [1, 2, 3, 4].includes(size.orientation);
  } else {
    return landscapeRatio(ratio);
  }
}

function landscapeRatio(ratio) {
  return 1.2 < ratio && ratio < 2;
}

function randomPick(pickLandscape, minWidth, minHeight) {
  const files = readdirSync(PictureFolder);
  shuffle(files);
  // console.log(files);
  for (const file of files) {
    const size = sizeOf(join(PictureFolder, file));

    const landscapePic = isLandscapePic(size);
    if (pickLandscape && landscapePic) {
      const w = Math.max(size.width, size.height);
      const h = Math.min(size.width, size.height);
      if (w >= minWidth * 0.9 && h >= minHeight * 0.9) {
        return {file: file, correctedWidth: w, correctedHeight: h};
      }
    } else if (!pickLandscape && !landscapePic) {
      const w = Math.min(size.width, size.height);
      const h = Math.max(size.width, size.height);
      if (w >= minWidth * 0.9 && h >= minHeight * 0.9) {
        return {file: file, correctedWidth: w, correctedHeight: h};
      }
    }
  }
  throw new Error('No available image');
}

process.on('uncaughtException', function(err) {
  console.error(err);
  process.exit(1);
});


(async () => {
  const graphics = await _graphics();
  const displays = graphics.displays;
  const size = getWallpaperSizeAndFixPositions(displays);
  const tmpFilepath = await generateWallpaper(size, displays);

  console.log(displays);
  set(tmpFilepath);
})();


