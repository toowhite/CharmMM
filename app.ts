#!/usr/bin/env node
/* eslint-disable require-jsdoc */
/* eslint-disable max-len */

import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { execSync } from "child_process";
import { createClient, Photo, PhotosWithTotalResults } from "pexels";
import { setGlobalDispatcher, ProxyAgent } from "undici";
import fs from "fs";
import { setWallpaper } from "wallpaper";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  rawDisplayLogsToDictionary,
  landscapeRatio,
  getWallpaperSize,
  dirSize,
  getFilesSortedByCreationTime,
  bytesToMegaBytes,
  readConfigItem,
  lowerKeys,
  parseTmpFilename,
  Display as UtilsDisplay,
} from "./utils.ts";
// @ts-ignore
import sharp from "sharp";
import yaml from "js-yaml";
import os from "os";

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
process.on("uncaughtException", function (err: Error) {
  console.error(err);
  process.exit(1);
});

const log = console.log;
const logCommand = (command: string) => {
  log(`Executing command: ${command}`);
};
// Fix for import.meta.url compatibility in CommonJS/TypeScript
const FILENAME =
  typeof __filename !== "undefined"
    ? __filename
    : fileURLToPath(import.meta.url);
const DIRNAME =
  typeof __dirname !== "undefined" ? __dirname : dirname(FILENAME);
const WALLPAPER_FOLDER = join(os.homedir(), "Pictures", "charm-mm-wallpapers");
const DEFINED_SHARP_FIT_MODE = [
  "cover",
  "contain",
  "fill",
  "inside",
  "outside",
];
const MAX_PER_PAGE = 80; // according to Pexels documentations

let pexelsClient: ReturnType<typeof createClient>;
let config: any;

type Display = UtilsDisplay & { scale: number };

type Size = { w: number; h: number };

function fixPositions(displays: Display[]): void {
  let minPosX = Infinity;
  let minPosY = Infinity;
  for (let i = 0; i < displays.length; i++) {
    const d = displays[i];
    const command = `"${join(DIRNAME, "bin", "SetDpi.exe")}" value ${i + 1}`;
    logCommand(command);
    const scale = execSync(command).toString();
    d.scale = parseInt(scale) / 100;
    if (d.positionX !== undefined && d.positionX < minPosX) {
      minPosX = d.positionX;
    }
    if (d.positionY !== undefined && d.positionY < minPosY) {
      minPosY = d.positionY;
    }
  }
  for (const d of displays) {
    if (d.positionX !== undefined) d.positionX -= minPosX;
    if (d.positionY !== undefined) d.positionY -= minPosY;
  }

  const positionScaler = displays[0].scale;
  for (let i = 0; i < displays.length; i++) {
    const d = displays[i];
    if (d.resolutionX !== undefined && d.scale !== undefined)
      d.resolutionX = Math.floor(d.resolutionX * d.scale);
    if (d.resolutionY !== undefined && d.scale !== undefined)
      d.resolutionY = Math.floor(d.resolutionY * d.scale);
    if (d.positionX !== undefined)
      d.positionX = Math.floor(positionScaler * d.positionX);
    if (d.positionY !== undefined)
      d.positionY = Math.floor(positionScaler * d.positionY);
  }
}

async function pickRandomPhoto(
  landscapeDisplay: boolean,
  keyword: string
): Promise<Photo> {
  const orientation = landscapeDisplay ? "landscape" : "portrait";

  let result = await pexelsClient.photos.search({
    per_page: MAX_PER_PAGE,
    size: "large",
    query: keyword,
    orientation: orientation,
    page: 1,
  });
  if ("error" in result) throw new Error(result.error);

  const photoIndex = Math.floor(Math.random() * result.total_results);
  const wantedPage = Math.floor(photoIndex / MAX_PER_PAGE) + 1;
  const wantedIndexInPage = photoIndex % MAX_PER_PAGE;

  log(
    `${result.total_results} photos found. Picked the ${photoIndex} th photo, therefore pick ${wantedIndexInPage} th in page ${wantedPage}`
  );

  if (wantedPage != 1) {
    const nextResult = await pexelsClient.photos.search({
      per_page: MAX_PER_PAGE,
      size: "large",
      query: keyword,
      orientation: orientation,
      page: wantedPage,
    });
    if ("error" in nextResult) throw new Error(nextResult.error);
    result = nextResult;
  }

  return result.photos[wantedIndexInPage];
}

async function downloadPhotoIfNeeded(
  photo: Photo,
  dest: string,
  useProxy: boolean,
  proxy: string
) {
  if (!fs.existsSync(dest)) {
    let wgetCommand = [
      "wget",
      photo.src.original,
      "-O",
      `"${dest}"`,
      '--header="Accept: text/html"',
      '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:21.0) Gecko/20100101 Firefox/21.0"',
      "--no-verbose",
    ];
    if (useProxy) {
      wgetCommand.push(`-e http_proxy=${proxy} -e https_proxy=${proxy}`);
    }
    const wgetCommandStr = wgetCommand.join(" ");
    logCommand(wgetCommandStr);
    execSync(wgetCommandStr);
  }
}

async function resizePhotoToBuffer(
  dest: string,
  width: number,
  height: number,
  fitMode: string
) {
  return sharp(dest)
    .resize(width, height, { fit: fitMode as any })
    .toBuffer();
}

async function generateWallpaper(
  size: Size,
  displays: Display[]
): Promise<string> {
  const image = sharp({
    create: {
      width: size.w,
      height: size.h,
      background: "#000000",
      channels: 4,
    },
  });

  // read config items
  const noRepeat = readConfigItem(config, "NoRepeat", true);
  const keyword = readConfigItem(config, "Keyword");
  const fitMode = readConfigItem(config, "FitMode", "cover");
  const useProxy = readConfigItem(config, "UseProxy", false);
  const proxy = readConfigItem(config, "Proxy", "placeholder");

  let pickedArray: number[] = [];
  let useRecoveredPhotoIds = false;
  if (readConfigItem(config, "UseLastPhotos", false)) {
    try {
      const lastUsedPhotoIds = fs
        .readdirSync(".")
        .reduce((result: number[], filename: string) => {
          const tmp = parseTmpFilename(filename);
          if (tmp) {
            result = tmp;
          }
          return result;
        }, []);
      if (lastUsedPhotoIds.length == displays.length) {
        useRecoveredPhotoIds = true;
        pickedArray = lastUsedPhotoIds;
      }
    } catch (Error) {
      log("Attempt to load last used photos ids fails. Pick photos again.");
    }
  }

  const compositeArray: any[] = [];
  for (let i = 0; i < displays.length; i++) {
    const display = displays[i];
    const ratio = (display.resolutionX ?? 1) / (display.resolutionY ?? 1);
    const landscapeDisplay = landscapeRatio(ratio);

    let picked: Photo;
    if (useRecoveredPhotoIds) {
      const showResult = await pexelsClient.photos.show({ id: pickedArray[i] });
      if ("error" in showResult) throw new Error(showResult.error);
      picked = showResult;
    } else {
      do {
        picked = await pickRandomPhoto(landscapeDisplay, keyword);
      } while (noRepeat && pickedArray.includes(picked.id));
      pickedArray.push(picked.id);
    }

    const deviceName = display.deviceName?.replace(/[\.\\]/g, "") ?? "unknown";
    log(`${deviceName} will use wallpaper ${picked.src.original}`);

    const dest = join(WALLPAPER_FOLDER, `${picked.id}.jpg`);
    await downloadPhotoIfNeeded(picked, dest, useProxy, proxy);

    if (DEFINED_SHARP_FIT_MODE.includes(fitMode)) {
      const picData = await resizePhotoToBuffer(
        dest,
        display.resolutionX ?? 1,
        display.resolutionY ?? 1,
        fitMode
      );
      compositeArray.push({
        input: picData,
        left: display.positionX,
        top: display.positionY,
      });
    } else {
      throw new Error("Unsupported fit mode");
    }
  }

  const tmpFilePath = join(DIRNAME, `_tmp_${pickedArray.join(",")}.jpg`);
  const info = await image.composite(compositeArray).toFile(tmpFilePath);
  log(info);
  return tmpFilePath;
}

function prepare(): void {
  if (!fs.existsSync(WALLPAPER_FOLDER)) {
    log("Wallpaper folder doesn't exist, creating one...");
    fs.mkdirSync(WALLPAPER_FOLDER);
  }

  const wallpaperSize = bytesToMegaBytes(dirSize(WALLPAPER_FOLDER));
  log(
    `Wallpaper folder path is ${WALLPAPER_FOLDER}, occupying ${wallpaperSize} MB`
  );

  const diskStorageLimit = readConfigItem(
    config,
    "DiskStorageLimit",
    "NO LIMIT"
  );
  if (diskStorageLimit != "NO LIMIT" && wallpaperSize > diskStorageLimit) {
    log(
      `wallpaper folder size (${wallpaperSize} MB) exceeds limit ${diskStorageLimit} MB, pruning...`
    );
    prune(wallpaperSize, diskStorageLimit);
  }
}

function prune(currSize: number, diskStorageLimit: number): void {
  const sortedFiles = getFilesSortedByCreationTime(WALLPAPER_FOLDER);
  do {
    const file = sortedFiles.shift();
    if (!file) break;
    const sizeInMB = bytesToMegaBytes(file.stats.size);
    fs.unlinkSync(file.path);
    log(`${file.path} deleted, saving ${sizeInMB} MB`);
    currSize -= sizeInMB;
  } while (currSize > diskStorageLimit);
}

function getDisplayByPowershell(): Display[] {
  const scriptPath = join(DIRNAME.replace(/ /g, "` "), "GetDisplays.ps1");
  const command = `powershell.exe "${scriptPath}"`;
  logCommand(command);
  const rawLogs = execSync(command);
  // Map to add scale: 1 to each display
  return rawDisplayLogsToDictionary(rawLogs.toString()).map((d) => ({
    ...d,
    scale: 1,
  }));
}

async function loadAndMergeConfig(argvRaw: any) {
  argvRaw.config = argvRaw.config ? argvRaw.config : "config.yml";
  log(`Using config file: ${argvRaw.config}`);
  let loadedConfig = yaml.load(fs.readFileSync(argvRaw.config, "utf-8"));
  loadedConfig = lowerKeys(loadedConfig);
  // Fix: assert type for loadedConfig
  const configObj = loadedConfig as Record<string, any>;
  // Merge CLI args into config
  for (const key in argvRaw) {
    const realKey = key.toLowerCase().replace(/-/g, "");
    const v = argvRaw[key];
    if (realKey in configObj) {
      try {
        configObj[realKey] = JSON.parse(v);
      } catch (SyntaxError) {
        configObj[realKey] = v;
      }
    }
  }
  return configObj;
}

async function main() {
  // Parse CLI arguments
  const argv = yargs(hideBin(process.argv))
    .usage("Usage: $0 --config <configFile>")
    .strict(false)
    .option("config", {
      alias: "c",
      demandOption: false,
      describe: "Specify the configuration file",
      type: "string",
    }).argv;
  const argvRaw = (await Promise.resolve(argv)) as any;

  // Load and merge config
  config = await loadAndMergeConfig(argvRaw);
  log(config);

  // Proxy setup if needed
  const useProxy = readConfigItem(config, "UseProxy", false);
  if (useProxy) {
    setGlobalDispatcher(new ProxyAgent(readConfigItem(config, "Proxy")));
  }

  // Pexels client
  pexelsClient = createClient(readConfigItem(config, "PEXELS_API_KEY"));

  // Prepare wallpaper folder and prune if needed
  prepare();

  // Get display info
  const displays = getDisplayByPowershell();
  if (readConfigItem(config, "DebugDisplay")) {
    log("Before fixing positions:");
    log(displays);
  }
  fixPositions(displays);
  log("After fixing positions:");
  log(displays);

  // Calculate wallpaper size
  const size = getWallpaperSize(displays);
  log(size);

  // If not in debug mode, generate and set wallpaper
  if (!readConfigItem(config, "DebugDisplay")) {
    const tmpFilepath = await generateWallpaper(size, displays);
    await setWallpaper(tmpFilepath);
  }
}

// Main async entrypoint
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
