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
import utils from './utils.js';
import sharp from 'sharp';
import yaml from 'js-yaml';
import os from 'os';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
process.on('uncaughtException', function(err) {
  console.error(err);
  process.exit(1);
});

const exec = promisify(childProcess.exec);
const print = console.log;
const FILENAME = fileURLToPath(import.meta.url);
const DIRNAME = dirname(FILENAME);
const WALLPAPER_FOLDER = join(os.homedir(), 'Pictures', 'charm-mm-wallpapers');
const DEFINED_SHARP_FIT_MODE = ['cover', 'contain', 'fill', 'inside', 'outside'];
const MAX_PER_PAGE = 80; // according to Pexels documentations

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

async function pickRandomPhoto(landscapeDisplay, keyword) {
  const orientation = landscapeDisplay ? 'landscape' : 'portrait';

  let result = await pexelsClient.photos.search({
    per_page: MAX_PER_PAGE,
    size: 'large',
    query: keyword,
    orientation: orientation,
    page: 1,
  });

  const photoIndex = Math.floor(Math.random() * result.total_results);
  const wantedPage = Math.floor(photoIndex / MAX_PER_PAGE) + 1;
  const wantedIndexInPage = photoIndex % MAX_PER_PAGE;

  print(`${result.total_results} photos found. Picked the ${photoIndex} th photo, therefore pick ${wantedIndexInPage} th in page ${wantedPage}`);

  if (wantedPage != 1) {
    result = await pexelsClient.photos.search({
      per_page: MAX_PER_PAGE,
      size: 'large',
      query: keyword,
      orientation: orientation,
      page: wantedPage,
    });
  }

  return result.photos[wantedIndexInPage];
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
      picked = await pickRandomPhoto(landscapeDisplay, config.Keyword);
    } while (config.NoRepeat && pickedSet.has(picked.id));
    pickedSet.add(picked.id);

    const deviceName = display.deviceName.replace(/[\.\\]/g, '');
    print(`${deviceName} will use wallpaper ${picked.src.original}`);

    const dest = join(WALLPAPER_FOLDER, `${picked.id}_${deviceName}.jpg`);
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
  if (!fs.existsSync(WALLPAPER_FOLDER)) {
    print('Wallpaper folder doesn\'t exist, creating one...');
    fs.mkdirSync(WALLPAPER_FOLDER);
  }
}

async function getDisplayByPowershell() {
  const scriptPath = join(DIRNAME, 'GetDisplays.ps1').replace(/ /g, '` ');
  const command = `powershell.exe "${scriptPath}"`;
  print('Executing command: ' + command);
  const rawLogs = await exec(command);
  return utils.rawDisplayLogsToDictionary(rawLogs.stdout);
}


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
  const size = utils.getWallpaperSize(displays);
  print(size);
  const tmpFilepath = await generateWallpaper(size, displays);
  await setWallpaper(tmpFilepath);
})();


