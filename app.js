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

async function generateWallpaper(size, displays) {
    
    let image = new Jimp(size.w, size.h, config.BackgroundColor);

    let pics = [];
    for (let display of displays) {
        let pic;
        do {
            let ratio = display.currentResX / display.currentResY;
            let horizontalDisplay = ratio > 1.6 && ratio < 1.8;
            pic = randomPick(horizontalDisplay);
        } while (pics.includes(pic));
        pics.push(pic);
        let picData = await Jimp.read(path.join(config.PictureFolder, pic));
        image.blit(picData, display.positionX, display.positionY, 0, 0, display.currentResX, display.currentResY);
    }
    //console.log(pics);

    let fullpath = path.join(__dirname, "_tmp.jpg");
    image.write(fullpath);
    return fullpath;
}

function isHorizontal(size) {
    let ratio = size.width / size.height;
    if (size.hasOwnProperty("orientation")) {
        return 1.6 < ratio && ratio < 1.8 && [1, 2, 3, 4].includes(size.orientation);
    }
    else {
        return 1.6 < ratio && ratio < 1.8;
    }
}

function randomPick(pickHorizonal = true) {
    let files = fs.readdirSync(config.PictureFolder);
    shuffle(files);
    //console.log(files);
    for (let file of files) {
        let size = sizeOf(path.join(config.PictureFolder, file));

        let horizontal = isHorizontal(size);
        if (pickHorizonal && horizontal) {
            return file;
        }
        else if (!pickHorizonal && !horizontal) {
            return file;
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




