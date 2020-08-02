'use strict';

const si = require('systeminformation');
const Jimp = require('jimp');
const fs = require('fs');
const sizeOf = require('image-size');
const path = require('path');
const wp = require('wallpaper');
const config = require('./config.json');

function getWallpaperSize(displays) {
    
    let height = 0;
    let width = 0;
    for (let display of displays) {
        if (display.currentResY > height) {
            height = display.currentResY;
        }
        width += display.currentResX;
    }

    return { h: height, w: width };
}

function shuffle(array) {
    array.sort(() => Math.random() - 0.5);
}

async function generateWallpaper(size, displays) {
    
    let image = new Jimp(size.w, size.h, config.BackgroundColor);

    let pics = [];
    let w = 0;
    let h = 0;
    for (let display of displays) {
        let pic;
        do
            pic = randomPick(display.currentResX == 1920 && display.currentResY == 1080);
        while (pics.includes(pic));
        pics.push(pic);
        let picData = await Jimp.read(path.join(config.PictureFolder, pic));
        image.composite(picData, w, h);
        w += Math.abs(display.positionX);
        h += Math.abs(display.positionY);
    }
    //console.log(pics);

    let fullpath = path.join(__dirname, "_tmp.jpg");
    image.write(fullpath);
    return fullpath;
}

function isHorizontal(size) {
    let ratio = size.width / size.height;
    if (size.hasOwnProperty("orientation")) {
        return 1.6 < ratio && ratio < 1.8 && size.orientation == 1;
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

        if (pickHorizonal && isHorizontal(size)) {
            return file;
        }
        else if (!pickHorizonal && !isHorizontal(size)) {
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
    let size = getWallpaperSize(displays);

    let tmpFilepath = await generateWallpaper(size, displays);
    console.log(displays);
    wp.set(tmpFilepath);
})();




