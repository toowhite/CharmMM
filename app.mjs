#!/usr/bin/env node
/* eslint-disable require-jsdoc */
/* eslint-disable max-len */

import {join} from 'path';
import {fileURLToPath} from 'url';
import {dirname} from 'path';
import {execSync} from 'child_process';
import {createClient} from 'pexels';
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

const print = console.log;
const FILENAME = fileURLToPath(import.meta.url);
const DIRNAME = dirname(FILENAME).replace(/ /g, '` ');
const WALLPAPER_FOLDER = join(os.homedir(), 'Pictures', 'charm-mm-wallpapers');
const DEFINED_SHARP_FIT_MODE = ['cover', 'contain', 'fill', 'inside', 'outside'];
const MAX_PER_PAGE = 80; // according to Pexels documentations

let pexelsClient;
let config;

function fixPositions(displays) {
  let minPosX = Infinity;
  let minPosY = Infinity;
  for (let i = 0; i < displays.length; i++) {
    const d = displays[i];
    const command = `${join(DIRNAME, 'bin', 'SetDpi.exe')} value ${i+1}`;
    print('Executing command: ' + command);
    const scale = execSync(command).toString();
    d.scale = parseInt(scale)/100;
    if (d.positionX < minPosX) {
      minPosX = d.positionX;
    }
    if (d.positionY < minPosY) {
      minPosY = d.positionY;
    }
  }
  for (const d of displays) {
    d.positionX -= minPosX;
    d.positionY -= minPosY;
  }

  const positionScaler = displays[0].scale;
  for (let i = 0; i < displays.length; i++) {
    const d = displays[i];

    d.resolutionX = Math.floor(d.resolutionX * d.scale);
    d.resolutionY = Math.floor(d.resolutionY * d.scale);

    d.positionX = Math.floor(positionScaler * d.positionX);
    d.positionY = Math.floor(positionScaler * d.positionY);
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

  // read config items
  const noRepeat = utils.readConfigItem(config, 'NoRepeat', true);
  const keyword = utils.readConfigItem(config, 'Keyword');
  const fitMode = utils.readConfigItem(config, 'FitMode', 'cover');
  const useProxy = utils.readConfigItem(config, 'UseProxy', false);
  const proxy = utils.readConfigItem(config, 'Proxy', 'placeholder');

  const pickedSet = new Set();
  const compositeArray = [];
  for (const display of displays) {
    const ratio = display.resolutionX / display.resolutionY;
    const landscapeDisplay = utils.landscapeRatio(ratio);

    let picked;
    do {
      picked = await pickRandomPhoto(landscapeDisplay, keyword);
    } while (noRepeat && pickedSet.has(picked.id));
    pickedSet.add(picked.id);

    const deviceName = display.deviceName.replace(/[\.\\]/g, '');
    print(`${deviceName} will use wallpaper ${picked.src.original}`);

    const dest = join(WALLPAPER_FOLDER, `${picked.id}.jpg`);
    if (!fs.existsSync(dest)) {
      let wgetCommand = [
        'wget', picked.src.original, '-O', `"${dest}"`,
        '--header="Accept: text/html"',
        '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:21.0) Gecko/20100101 Firefox/21.0"',
        '--no-verbose',
      ];
      if (useProxy) {
        wgetCommand.push(`-e http_proxy=${proxy} -e https_proxy=${proxy}`);
      }
      wgetCommand = wgetCommand.join(' ');
      print(`Executing command: ${wgetCommand}`);
      execSync(wgetCommand);
    }
    if (DEFINED_SHARP_FIT_MODE.includes(fitMode)) {
      const picData = await sharp(dest).resize(display.resolutionX, display.resolutionY, {
        fit: fitMode,
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

function prepare() {
  if (!fs.existsSync(WALLPAPER_FOLDER)) {
    print('Wallpaper folder doesn\'t exist, creating one...');
    fs.mkdirSync(WALLPAPER_FOLDER);
  }

  const wallpaperSize = utils.bytesToMegaBytes(utils.dirSize(WALLPAPER_FOLDER));
  print(`Wallpaper folder path is ${WALLPAPER_FOLDER}, occupying ${wallpaperSize} MB`);

  const diskStorageLimit = utils.readConfigItem(config, 'DiskStorageLimit', 'NO LIMIT');
  if (diskStorageLimit != 'NO LIMIT' && wallpaperSize > diskStorageLimit) {
    print(`wallpaper folder size (${wallpaperSize} MB) exceeds limit ${diskStorageLimit} MB, pruning...`);
    prune(wallpaperSize, diskStorageLimit);
  }
}

function prune(currSize, diskStorageLimit) {
  const sortedFiles = utils.getFilesSortedByCreationTime(WALLPAPER_FOLDER);
  do {
    const file = sortedFiles.shift();
    const sizeInMB = utils.bytesToMegaBytes(file.stats.size);
    fs.unlinkSync(file.path);
    print(`${file.path} deleted, saving ${sizeInMB} MB`);
    currSize -= sizeInMB;
  } while (currSize > diskStorageLimit);
}

function getDisplayByPowershell() {
  const scriptPath = join(DIRNAME, 'GetDisplays.ps1');
  const command = `powershell.exe "${scriptPath}"`;
  print('Executing command: ' + command);
  const rawLogs = execSync(command);
  return utils.rawDisplayLogsToDictionary(rawLogs.toString());
}


(async () => {
  const argv = yargs(hideBin(process.argv))
      .usage('Usage: $0 --config <configFile>')
      .strict(false) // Allow unknown options
      .option('config', {
        alias: 'c',
        demandOption: false,
        describe: 'Specify the configuration file',
        type: 'string',
      })
      .argv;
  argv.config = argv.config ? argv.config : 'config.yml';
  print(`Using config file: ${argv.config}`);
  config = yaml.load(fs.readFileSync(argv.config, 'utf-8'));

  config = utils.lowerize(config);

  // eslint-disable-next-line guard-for-in
  for (const key in argv) {
    const realKey = key.toLowerCase().replace(/-/g, '');
    const v = argv[key];
    if (realKey in config) {
      try {
        config[realKey] = JSON.parse(v);
      } catch (SyntaxError) {
        config[realKey] = v;
      }
    }
  }

  print(config);

  const useProxy = utils.readConfigItem(config, 'UseProxy', false);
  if (useProxy) {
    setGlobalDispatcher(new ProxyAgent(utils.readConfigItem(config, 'Proxy')));
  }

  pexelsClient = createClient(utils.readConfigItem(config, 'PEXELS_API_KEY'));

  prepare();
  const displays = getDisplayByPowershell();
  if (utils.readConfigItem(config, 'DebugDisplay')) {
    print('Before fixing positions:');
    print(displays);
  }
  fixPositions(displays);
  print('After fixing positions:');
  print(displays);

  const size = utils.getWallpaperSize(displays);
  print(size);
  if (!utils.readConfigItem(config, 'DebugDisplay')) {
    const tmpFilepath = await generateWallpaper(size, displays);
    await setWallpaper(tmpFilepath);
  }
})();


