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
