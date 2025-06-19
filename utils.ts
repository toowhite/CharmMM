/* eslint-disable require-jsdoc */
/* eslint-disable max-len */
import fs from "fs";
import path from "path";

export type Display = {
  BitsPerPixel?: number;
  Bounds?: { X: number; Y: number; Width: number; Height: number };
  DeviceName?: string;
  Primary?: boolean;
  WorkingArea?: { X: number; Y: number; Width: number; Height: number };
  resolutionX?: number;
  resolutionY?: number;
  positionX?: number;
  positionY?: number;
  deviceName?: string;
};

export function rawDisplayLogsToDictionary(inputText: string): Display[] {
  const lines = inputText.trim().split("\n");
  const extractValue = (line: string) => line.split(":")[1].trim();
  const extractBounds = (line: string) => {
    const boundsRegex = /{X=(.*?),Y=(.*?),Width=(.*?),Height=(.*?)}/;
    const [, X, Y, Width, Height] = line.match(boundsRegex)!;
    return {
      X: parseInt(X),
      Y: parseInt(Y),
      Width: parseInt(Width),
      Height: parseInt(Height),
    };
  };
  const displayArray: Display[] = [];
  let currentDisplay: any = {};
  lines.forEach((line) => {
    if (line.startsWith("BitsPerPixel")) {
      currentDisplay.BitsPerPixel = parseInt(extractValue(line));
    } else if (line.startsWith("Bounds")) {
      currentDisplay.Bounds = extractBounds(extractValue(line));
    } else if (line.startsWith("DeviceName")) {
      currentDisplay.DeviceName = extractValue(line);
    } else if (line.startsWith("Primary")) {
      currentDisplay.Primary = extractValue(line) === "True";
    } else if (line.startsWith("WorkingArea")) {
      currentDisplay.WorkingArea = extractBounds(extractValue(line));
      displayArray.push(asSystemInformationStyle(currentDisplay));
      currentDisplay = {};
    }
  });
  return displayArray;
}

function asSystemInformationStyle(display: any) {
  const newObj: any = {};
  newObj.resolutionX = display.Bounds.Width;
  newObj.resolutionY = display.Bounds.Height;
  newObj.positionX = display.Bounds.X;
  newObj.positionY = display.Bounds.Y;
  newObj.deviceName = display.DeviceName;
  return newObj;
}

export function landscapeRatio(ratio: number): boolean {
  return 1.2 < ratio && ratio < 2;
}

export function getWallpaperSize(displays: any[]): { w: number; h: number } {
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
  return { w: width, h: height };
}

export function dirSize(dir: string): number {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  let totalSize = 0;
  files.forEach((file) => {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      totalSize += dirSize(filePath);
    } else if (file.isFile()) {
      const { size } = fs.statSync(filePath);
      totalSize += size;
    }
  });
  return totalSize;
}

export function getFilesSortedByCreationTime(folderPath: string) {
  const files = fs.readdirSync(folderPath);
  const filePaths = files.map((file) => path.join(folderPath, file));
  const fileStats = filePaths.map((filePath) => {
    try {
      return {
        path: filePath,
        stats: fs.statSync(filePath),
      };
    } catch (err) {
      console.error("Error getting file stats:", err);
      return null;
    }
  });
  const validFileStats = fileStats.filter((fileStat) => fileStat !== null);
  const sortedFiles = validFileStats.sort(
    (a: any, b: any) => a.stats.ctimeMs - b.stats.ctimeMs
  );
  return sortedFiles;
}

export function bytesToMegaBytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

export function readConfigItem(
  config: any,
  key: string,
  defaultValue: any = null
): any {
  config = lowerKeys(config);
  try {
    if (key.toLowerCase() in config) {
      return config[key.toLowerCase()];
    } else {
      throw new Error();
    }
  } catch (err) {
    if (defaultValue != null) {
      return defaultValue;
    } else {
      throw new Error("Config key not found: " + key);
    }
  }
}

export function lowerKeys(obj: any): any {
  return Object.keys(obj).reduce((acc: any, k: string) => {
    acc[k.toLowerCase()] = obj[k];
    return acc;
  }, {});
}

export function parseTmpFilename(filename: string): number[] | null {
  if (!filename.match(/_tmp_(\d+,?)+\.jpg/g)) {
    return null;
  }
  return filename.match(/\d+/g)!.map((x) => parseInt(x));
}
