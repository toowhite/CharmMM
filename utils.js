/* eslint-disable require-jsdoc */
/* eslint-disable max-len */
import {readdir, stat} from 'fs/promises';
import {join} from 'path';

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

async function dirSize(dir) {
  const files = await readdir( dir, {withFileTypes: true} );
  const paths = files.map( async (file) => {
    const path = join( dir, file.name );
    if ( file.isDirectory() ) return await dirSize( path );
    if ( file.isFile() ) {
      const {size} = await stat( path );
      // eslint-disable-next-line no-trailing-spaces
      
      return size;
    }

    return 0;
  } );
  return ( await Promise.all( paths ) ).flat( Infinity ).reduce( ( i, size ) => i + size, 0 );
}

export default {
  landscapeRatio,
  rawDisplayLogsToDictionary,
  getWallpaperSize,
  dirSize,
};
