/* eslint-disable require-jsdoc */
/* eslint-disable max-len */
import fs from 'fs';
import path from 'path';

function rawDisplayLogsToDictionary(inputText) {
  // Splitting the input text into individual lines
  const lines = inputText.trim().split('\n');

  // Helper function to extract values from the lines
  const extractValue = (line) => line.split(':')[1].trim();

  // Helper function to extract values from the bounds line
  const extractBounds = (line) => {
    const boundsRegex = /{X=(.*?),Y=(.*?),Width=(.*?),Height=(.*?)}/;
    const [, X, Y, Width, Height] = line.match(boundsRegex);
    return {X: parseInt(X), Y: parseInt(Y), Width: parseInt(Width), Height: parseInt(Height)};
  };

  // Array to store the parsed dictionaries
  const displayArray = [];

  let currentDisplay = {};

  lines.forEach((line) => {
    if (line.startsWith('BitsPerPixel')) {
      currentDisplay.BitsPerPixel = parseInt(extractValue(line));
    } else if (line.startsWith('Bounds')) {
      currentDisplay.Bounds = extractBounds(extractValue(line));
    } else if (line.startsWith('DeviceName')) {
      currentDisplay.DeviceName = extractValue(line);
    } else if (line.startsWith('Primary')) {
      currentDisplay.Primary = extractValue(line) === 'True';
    } else if (line.startsWith('WorkingArea')) {
      currentDisplay.WorkingArea = extractBounds(extractValue(line));
      displayArray.push(asSystemInformationStyle(currentDisplay));
      currentDisplay = {};
    }
  });

  // Printing the parsed array
  return displayArray;
}

function asSystemInformationStyle(display) {
  const newObj = {};
  newObj.resolutionX = display.Bounds.Width;
  newObj.resolutionY = display.Bounds.Height;
  newObj.positionX = display.Bounds.X;
  newObj.positionY = display.Bounds.Y;
  newObj.deviceName = display.DeviceName;
  return newObj;
}

function landscapeRatio(ratio) {
  return 1.2 < ratio && ratio < 2;
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

function dirSize(dir) {
  const files = fs.readdirSync(dir, {withFileTypes: true});
  let totalSize = 0;

  files.forEach((file) => {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      totalSize += dirSize(filePath);
    } else if (file.isFile()) {
      const {size} = fs.statSync(filePath);
      totalSize += size;
    }
  });

  return totalSize;
}

function getFilesSortedByCreationTime(folderPath) {
  // Read folder contents synchronously
  const files = fs.readdirSync(folderPath);
  // Map file names to file paths
  const filePaths = files.map((file) => path.join(folderPath, file));
  // Get file stats for each file
  const fileStats = filePaths.map((filePath) => {
    try {
      return {
        path: filePath,
        stats: fs.statSync(filePath),
      };
    } catch (err) {
      console.error('Error getting file stats:', err);
      return null;
    }
  });
  // Filter out any files that couldn't be read
  const validFileStats = fileStats.filter((fileStat) => fileStat !== null);
  // Sort files by creation time in ascending order
  const sortedFiles = validFileStats.sort((a, b) => a.stats.ctimeMs - b.stats.ctimeMs);
  return sortedFiles;
}

function bytesToMegaBytes(bytes) {
  return Math.round(bytes / (1024 * 1024));
}

function readConfigItem(config, key, defaultValue = null) {
  try {
    if (key in config) {
      return config[key];
    } else {
      throw new Error();
    }
  } catch (err) {
    if (defaultValue != null) {
      return defaultValue;
    } else {
      throw new Error('Config key not found: ' + key);
    }
  }
}

export default {
  landscapeRatio,
  rawDisplayLogsToDictionary,
  getWallpaperSize,
  dirSize,
  getFilesSortedByCreationTime,
  bytesToMegaBytes,
  readConfigItem,
};
