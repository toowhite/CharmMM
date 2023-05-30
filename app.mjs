'use strict';

import {graphics as _graphics} from 'systeminformation';
import Jimp from 'jimp';
import {join} from 'path';
import config from './config.json' assert {
  type: 'json'
};
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import child_process from 'child_process';
import { createClient } from 'pexels';
import { promisify } from 'util';
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import fs from 'fs';
import { setWallpaper } from 'wallpaper';

const exec = promisify(child_process.exec);

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

let WALLPAPER_SUBFOLDER = "wallpapers";

if ("Proxy" in config && config.Proxy)  {
  const proxyAgent = new ProxyAgent(config.Proxy);
  setGlobalDispatcher(proxyAgent);
}

let pexelsClient = createClient(config.PEXELS_API_KEY);

const cachedJpegDecoder = Jimp.decoders['image/jpeg'];
Jimp.decoders['image/jpeg'] = (data) => {
  const userOpts = { maxMemoryUsageInMB: 1024 };
  return cachedJpegDecoder(data, userOpts);
}

function fixPositions(displays) {
  let minPosX = Infinity;
  let minPosY = Infinity;
  for (const display of displays) {
    if (display.positionX < minPosX) {
      minPosX = display.positionX;
    }
    if (display.positionY < minPosY) {
      minPosY = display.positionY;
    }
  }

  for (const display of displays) {
    display.positionX -= minPosX;
    display.positionY -= minPosY;
  }
}

function getWallpaperSize(displays) {
  let height = 0;
  let width = 0;
  for (const display of displays) {
    if (display.positionX + display.resolutionX > width) {
      width = display.positionX + display.resolutionX;
    }

    if (display.positionY + display.resolutionY > height) {
      height = display.positionY + display.resolutionY;
    }
  }

  return {"w": width, "h": height}
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

async function pickRandomPhoto(landscapeDisplay, keyword, poolSize) {
  let result = await pexelsClient.photos.search({ 
    per_page: poolSize, 
    size: "large",
    query: keyword,
    orientation: landscapeDisplay ? "landscape" : "portrait"
  });
  
  return result.photos[Math.floor(Math.random() * result.photos.length)];
}

async function generateWallpaper(size, displays) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const image = new Jimp(size.w, size.h, config.BackgroundColor);
  
  for (const display of displays) {
    const ratio = display.resolutionX / display.resolutionY;
    const landscapeDisplay = landscapeRatio(ratio);

    let picked = await pickRandomPhoto(landscapeDisplay, config.Keyword, config.PoolSize);
    console.log(picked);
    let deviceName = display.deviceName.replace(/[\.\\]/g, '')
    let dest = join(__dirname, WALLPAPER_SUBFOLDER, `${picked.id}_${deviceName}.jpg`);

    if (!fs.existsSync(dest)) {
      await exec(`wget --header="Accept: text/html" --user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:21.0) Gecko/20100101 Firefox/21.0" ${picked.src.original} -O ${dest}`);
    }
    const picData = await Jimp.read(dest);
    // console.log(picData);
    if (config.FitMode == 'center') {
      const cp = getAdjustmentParameters(picked.width, picked.height, display.resolutionX, display.resolutionY, config.FitMode);
      if (cp.scale != 1) {
        picData.scale(cp.scale);
      }
      image.blit(picData, display.positionX, display.positionY, cp.x, cp.y, cp.w, cp.h);
    } else {
      throw new Error('Unsupported fit mode');
    }
  }

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


function prepareWallpaperFolder() {
  if (!fs.existsSync(WALLPAPER_SUBFOLDER)) {
    fs.mkdirSync(WALLPAPER_SUBFOLDER);
  }
}

process.on('uncaughtException', function(err) {
  console.error(err);
  process.exit(1);
});


(async () => {
  prepareWallpaperFolder();

  const graphics = await _graphics();
  const displays = graphics.displays;
  fixPositions(displays);
  const size = getWallpaperSize(displays);
  console.log(displays);
  console.log(size)
  const tmpFilepath = await generateWallpaper(size, displays);
  await setWallpaper(tmpFilepath);
})();


