#!/usr/bin/env node
'use strict';

import Jimp from 'jimp';
import {join} from 'path';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import child_process from 'child_process';
import { createClient } from 'pexels';
import { promisify } from 'util';
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import fs from 'fs';
import { setWallpaper } from 'wallpaper';
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import utils from './utils.mjs';

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const exec = promisify(child_process.exec);
const print = console.log;
const FILENAME = fileURLToPath(import.meta.url);
const DIRNAME = dirname(FILENAME);
const WALLPAPER_SUBFOLDER = "wallpapers";
let pexelsClient;
let config;

//Workaround for Error: maxMemoryUsageInMB limit exceeded by at least 109MB
const cachedJpegDecoder = Jimp.decoders['image/jpeg'];
Jimp.decoders['image/jpeg'] = (data) => {
  const userOpts = { maxMemoryUsageInMB: 2048 };
  return cachedJpegDecoder(data, userOpts);
}

function fixPositions(displays) {
  let scales;
  if ("Scaling" in config && displays.length == config.Scaling.length) {
    scales = config.Scaling;
  }

  let minPosX = Infinity;
  let minPosY = Infinity;
  for (let i =0; i < displays.length; i++) {
    let display = displays[i];
    display.resolutionX *= scales[i];
    display.resolutionY *= scales[i];
    display.positionX *= scales[0];
    display.positionY *= scales[0];

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
  const image = new Jimp(size.w, size.h, config.BackgroundColor);
  
  for (const display of displays) {
    const ratio = display.resolutionX / display.resolutionY;
    const landscapeDisplay = landscapeRatio(ratio);

    let picked = await pickRandomPhoto(landscapeDisplay, config.Keyword, config.PoolSize);
    print(picked);
    let deviceName = display.deviceName.replace(/[\.\\]/g, '')
    let dest = join(DIRNAME, WALLPAPER_SUBFOLDER, `${picked.id}_${deviceName}.jpg`);

    if (!fs.existsSync(dest)) {
      await exec(`wget --header="Accept: text/html" --user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:21.0) Gecko/20100101 Firefox/21.0" ${picked.src.original} -O ${dest}`);
    }
    const picData = await Jimp.read(dest);
    // print(picData);
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

  const fullpath = join(DIRNAME, '_tmp.jpg');
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

async function getDisplayByPowershell() {
  const rawLogs = await exec("powershell.exe GetDisplays.ps1");
  let tmp = utils.rawDisplayLogsToDictionary(rawLogs.stdout);
  
  return tmp;
}

process.on('uncaughtException', function(err) {
  console.error(err);
  process.exit(1);
});


(async () => {
  const argv = yargs(hideBin(process.argv)).argv;
  if (argv.config)  {
    print(`Using config file: ${argv.config}`);
    config = JSON.parse(
      await readFile(
        new URL(argv.config, import.meta.url)
      )
    );
  }
  else {
    throw new Error("Config file path not specified!");
  }
  if ("Proxy" in config && config.Proxy)  {
    setGlobalDispatcher(new ProxyAgent(config.Proxy));
  }
  
  pexelsClient = createClient(config.PEXELS_API_KEY);

  prepareWallpaperFolder();
  const displays = await getDisplayByPowershell();
  fixPositions(displays);
  print(displays);
  const size = getWallpaperSize(displays);
  print(size);
  const tmpFilepath = await generateWallpaper(size, displays);
  await setWallpaper(tmpFilepath);
})();


