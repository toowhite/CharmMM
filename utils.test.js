/* eslint-disable max-len */
import utils from './utils.js';

test('get wallpaper size', () => {
  const displays = [
    {
      resolutionX: 1920,
      resolutionY: 1080,
      positionX: 0,
      positionY: 0,
    },
    {
      resolutionX: 1920,
      resolutionY: 1080,
      positionX: 1920,
      positionY: 0,
    },
    {
      resolutionX: 1920,
      resolutionY: 1080,
      positionX: 3840,
      positionY: 0,
    },
  ];

  const size = utils.getWallpaperSize(displays);
  expect(size).toEqual({w: 5760, h: 1080});
});

test('convert raw display logs to dictionary', () => {
  const psOutputs = `
BitsPerPixel : 32
Bounds       : {X=2560,Y=516,Width=1280,Height=720}
DeviceName   : \\.\DISPLAY1
Primary      : False
WorkingArea  : {X=2560,Y=516,Width=1280,Height=720}

BitsPerPixel : 32
Bounds       : {X=0,Y=0,Width=1920,Height=1080}
DeviceName   : \\.\DISPLAY2
Primary      : True
WorkingArea  : {X=0,Y=0,Width=1920,Height=1040}

BitsPerPixel : 32
Bounds       : {X=-1440,Y=-764,Width=1080,Height=1920}
DeviceName   : \\.\DISPLAY3
Primary      : False
WorkingArea  : {X=-1440,Y=-764,Width=1080,Height=1920}`;

  const result = utils.rawDisplayLogsToDictionary(psOutputs);
  expect(result).toEqual([
    {
      'deviceName': '\\.DISPLAY1',
      'positionX': 2560,
      'positionY': 516,
      'resolutionX': 1280,
      'resolutionY': 720,
    },
    {
      'deviceName': '\\.DISPLAY2',
      'positionX': 0,
      'positionY': 0,
      'resolutionX': 1920,
      'resolutionY': 1080,
    },
    {
      'deviceName': '\\.DISPLAY3',
      'positionX': -1440,
      'positionY': -764,
      'resolutionX': 1080,
      'resolutionY': 1920,
    },
  ]);
});


describe('read config item', () => {
  let config;

  beforeEach(() => {
    config = {
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    };
  });

  test('should return correct value if key is present', () => {
    const result = utils.readConfigItem(config, 'key1');
    expect(result).toEqual('value1');
  });

  test('should return default value if key is not present and default value is provided', () => {
    const result = utils.readConfigItem(config, 'key4', 'defaultValue');
    expect(result).toEqual('defaultValue');
  });

  test('should throw error if key is not present and no default value is provided', () => {
    expect(() => utils.readConfigItem(config, 'key4')).toThrow('Config key not found: key4');
  });
});
