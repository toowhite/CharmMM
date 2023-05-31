#!/usr/bin/env node
/* eslint-disable require-jsdoc */
/* eslint-disable max-len */

import {join} from 'path';
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import childProcess from 'child_process';
import {createClient} from 'pexels';
import {promisify} from 'util';
import {setGlobalDispatcher, ProxyAgent} from 'undici';
import fs from 'fs';
import {setWallpaper} from 'wallpaper';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import utils from './utils.mjs';
import sharp from 'sharp';
import yaml from 'js-yaml';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const exec = promisify(childProcess.exec);
const print = console.log;
const FILENAME = fileURLToPath(import.meta.url);
const DIRNAME = dirname(FILENAME);
const WALLPAPER_SUBFOLDER = 'wallpapers';
const DEFINED_SHARP_FIT_MODE = ['cover', 'contain', 'fill', 'inside', 'outside'];

let pexelsClient;
let config;

function fixPositions(displays) {
  let scales;
  if ('Scaling' in config && displays.length == config.Scaling.length) {
    scales = config.Scaling;
  }

  let minPosX = Infinity;
  let minPosY = Infinity;
  for (let i =0; i < displays.length; i++) {
    const display = displays[i];

    if (scales) {
      display.resolutionX = Math.ceil(display.resolutionX * scales[i]);
      display.resolutionY = Math.ceil(display.resolutionY * scales[i]);
      display.positionX = Math.ceil(display.positionX * scales[0]);
      display.positionY = Math.ceil(display.positionY * scales[0]);
    }

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
      width = Math.ceil(display.positionX + display.resolutionX);
    }

    if (display.positionY + display.resolutionY > height) {
      height = Math.ceil(display.positionY + display.resolutionY);
    }
  }

  return {'w': width, 'h': height};
}


async function pickRandomPhoto(landscapeDisplay, keyword, poolSize) {
  const result = await pexelsClient.photos.search({
    per_page: poolSize,
    size: 'large',
    query: keyword,
    orientation: landscapeDisplay ? 'landscape' : 'portrait',
  });

  return result.photos[Math.floor(Math.random() * result.photos.length)];
}

async function generateWallpaper(size, displays) {
  const image = sharp({
    create: {
      width: size.w,
      height: size.h,
      background: '#000000',
      channels: 4,
    },
  });

  const pickedSet = new Set();
  const compositeArray = [];
  for (const display of displays) {
    const ratio = display.resolutionX / display.resolutionY;
    const landscapeDisplay = utils.landscapeRatio(ratio);

    let picked;
    do {
      picked = await pickRandomPhoto(landscapeDisplay, config.Keyword, config.PoolSize);
    } while (config.NoRepeat && picked.id in pickedSet);
    pickedSet.add(picked.id);

    const deviceName = display.deviceName.replace(/[\.\\]/g, '');
    print(`${deviceName} will use wallpaper ${picked.src.original}`);

    const dest = join(DIRNAME, WALLPAPER_SUBFOLDER, `${picked.id}_${deviceName}.jpg`);
    if (!fs.existsSync(dest)) {
      await exec(`wget --header="Accept: text/html" --user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:21.0) Gecko/20100101 Firefox/21.0" ${picked.src.original} -O ${dest}`);
    }
    if (DEFINED_SHARP_FIT_MODE.includes(config.FitMode)) {
      const picData = await sharp(dest).resize(display.resolutionX, display.resolutionY, {
        fit: config.FitMode,
      }).toBuffer();
      compositeArray.push({
        input: picData,
        left: display.positionX,
        top: display.positionY,
      });
    } else {
      throw new Error('Unsupported fit mode');
    }
  }

  const tmpFilePath = join(DIRNAME, '_tmp.jpg');
  const info = await image.composite(compositeArray).toFile(tmpFilePath);
  print(info);
  return tmpFilePath;
}

function prepareWallpaperFolder() {
  if (!fs.existsSync(WALLPAPER_SUBFOLDER)) {
    fs.mkdirSync(WALLPAPER_SUBFOLDER);
  }
}

async function getDisplayByPowershell() {
  const scriptPath = join(DIRNAME, 'GetDisplays.ps1');
  const rawLogs = await exec(`powershell.exe ${scriptPath}`);
  return utils.rawDisplayLogsToDictionary(rawLogs.stdout);
}

process.on('uncaughtException', function(err) {
  console.error(err);
  process.exit(1);
});


(async () => {
  const argv = yargs(hideBin(process.argv)).argv;
  if (argv.config) {
    print(`Using config file: ${argv.config}`);
    config = yaml.load(fs.readFileSync(argv.config, 'utf-8'));
  } else {
    throw new Error('Config file path not specified!');
  }
  if ('Proxy' in config && config.Proxy) {
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


