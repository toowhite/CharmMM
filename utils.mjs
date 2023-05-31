

function rawDisplayLogsToDictionary(inputText)   {
    // const inputText = `
    // BitsPerPixel : 32
    // Bounds       : {X=2560,Y=516,Width=1280,Height=720}
    // DeviceName   : \\\\.\\DISPLAY1
    // Primary      : False
    // WorkingArea  : {X=2560,Y=516,Width=1280,Height=720}
    
    // BitsPerPixel : 32
    // Bounds       : {X=0,Y=0,Width=1920,Height=1080}
    // DeviceName   : \\\\.\\DISPLAY2
    // Primary      : True
    // WorkingArea  : {X=0,Y=0,Width=1920,Height=1040}
    
    // BitsPerPixel : 32
    // Bounds       : {X=-1440,Y=-764,Width=1080,Height=1920}
    // DeviceName   : \\\\.\\DISPLAY3
    // Primary      : False
    // WorkingArea  : {X=-1440,Y=-764,Width=1080,Height=1920}
    // `;
    
    // Splitting the input text into individual lines
    const lines = inputText.trim().split('\n');
    
    // Helper function to extract values from the lines
    const extractValue = (line) => line.split(':')[1].trim();
    
    // Helper function to extract values from the bounds line
    const extractBounds = (line) => {
      const boundsRegex = /{X=(.*?),Y=(.*?),Width=(.*?),Height=(.*?)}/;
      const [, X, Y, Width, Height] = line.match(boundsRegex);
      return { X: parseInt(X), Y: parseInt(Y), Width: parseInt(Width), Height: parseInt(Height) };
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
  let newObj = {}
  newObj.resolutionX = display.Bounds.Width;
  newObj.resolutionY = display.Bounds.Height;
  newObj.positionX = display.Bounds.X;
  newObj.positionY = display.Bounds.Y;
  newObj.deviceName = display.DeviceName;
  return newObj;
}

export default {
  rawDisplayLogsToDictionary
};