'use strict';

const si = require('systeminformation');
const Jimp = require('jimp');
const fs = require('fs');
const sizeOf = require('image-size');
const path = require('path');
const wp = require('wallpaper');
const config = require('./config.json');

function getWallpaperSizeAndFixPositions(displays) {
    
    let height = 0;
    let width = 0;
    let minPosX = Infinity;
    let minPosY = Infinity;
    for (let display of displays) {
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

    for (let display of displays) {
        display.positionX -= minPosX;
        display.positionY -= minPosY;
    }

    return { h: height, w: width };
}

function shuffle(array) {
    array.sort(() => Math.random() - 0.5);
}

function getAdjustmentParameters(picWidth, picHeight, displayWidth, displayHeight, mode) {
    let params = {}
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
    
    let image = new Jimp(size.w, size.h, config.BackgroundColor);

    let picks = [];
    for (let display of displays) {
        let picked;
        do {
            let ratio = display.currentResX / display.currentResY;
            let landscapeDisplay = landscapeRatio(ratio);
            picked = randomPick(landscapeDisplay, display.currentResX, display.currentResY);
        } while (picks.includes(picked));
        picks.push(picked);
        let picData = await Jimp.read(path.join(config.PictureFolder, picked.file));
        if (config.FitMode == "center") {
            let cp = getAdjustmentParameters(picked.correctedWidth, picked.correctedHeight, display.currentResX, display.currentResY, config.FitMode);
            if (cp.scale != 1) {
                picData.scale(cp.scale);
            }
            image.blit(picData, display.positionX, display.positionY, cp.x, cp.y, cp.w, cp.h);
        }
        else {
            throw new Error("Unsupported fit mode");
        }
        
    }
    //console.log(pics);

    let fullpath = path.join(__dirname, "_tmp.jpg");
    image.write(fullpath);
    return fullpath;
}

function isLandscapePic(size) {
    let ratio = size.width / size.height;
    if (size.hasOwnProperty("orientation")) {
        return landscapeRatio(ratio) && [1, 2, 3, 4].includes(size.orientation);
    }
    else {
        return landscapeRatio(ratio);
    }
}

function landscapeRatio(ratio) {
    return 1.2 < ratio && ratio < 2;
}

function randomPick(pickLandscape, minWidth, minHeight) {
    let files = fs.readdirSync(config.PictureFolder);
    shuffle(files);
    //console.log(files);
    for (let file of files) {
        let size = sizeOf(path.join(config.PictureFolder, file));

        let landscapePic = isLandscapePic(size);
        if (pickLandscape && landscapePic) {
            let w = Math.max(size.width, size.height);
            let h = Math.min(size.width, size.height);
            if (w >= minWidth && h >= minHeight) {
                return { file: file, correctedWidth: w, correctedHeight: h };
            }
        }
        else if (!pickLandscape && !landscapePic) {
            let w = Math.min(size.width, size.height);
            let h = Math.max(size.width, size.height);
            if (w >= minWidth && h >= minHeight) {
                return { file: file, correctedWidth: w, correctedHeight: h };
            }
        }
    }
    throw new Error('No available image');
}

process.on('uncaughtException', function (err) {
    console.error(err);
    process.exit(1);
});


(async () => {
    let graphics = await si.graphics();
    let displays = graphics.displays;
    let size = getWallpaperSizeAndFixPositions(displays);
    let tmpFilepath = await generateWallpaper(size, displays);

    console.log(displays);
    wp.set(tmpFilepath);
})();




