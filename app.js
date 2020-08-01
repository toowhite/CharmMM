'use strict';

const si = require('systeminformation');
const Jimp = require('jimp');
const fs = require('fs');
const sizeOf = require('image-size');
const path = require('path');
const wp = require('wallpaper');

const PATH = "C:/Users/lzw21/OneDrive/Pictures/Feet";

async function getWallpaperSize(displays) {
    
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

async function generateWallpaper(displays) {
    let size = await getWallpaperSize(displays);
    let image = new Jimp(size.w, size.h, '#000000');

    let pics = [];
    let w = 0;
    let h = 0;
    for (let display of displays) {
        let pic;
        do
            pic = randomPick(display.currentResX == 1920 && display.currentResY == 1080);
        while (pics.includes(pic));
        pics.push(pic);
        let picData = await Jimp.read(path.join(PATH, pic));
        image.composite(picData, w, h);
        w += Math.abs(display.positionX);
        h += Math.abs(display.positionY);
    }
    //console.log(pics);

    let fullpath = path.join(__dirname, "tmp.jpg");
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
    let files = fs.readdirSync(PATH);
    shuffle(files);
    //console.log(files);
    for (let file of files) {
        let size = sizeOf(path.join(PATH, file));

        if (pickHorizonal && isHorizontal(size)) {
            return file;
        }
        else if (!pickHorizonal && !isHorizontal(size)) {
            return file;
        }
    }
    throw Error('No available image');
}



(async () => {
    let graphics = await si.graphics();
    let displays = graphics.displays;
    console.log(displays);
    let tmpFilepath = await generateWallpaper(displays);
    wp.set(tmpFilepath);

    console.log("Program ends.");
})();




