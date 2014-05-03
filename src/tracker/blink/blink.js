'use strict';

/*
 * Adds blink detection to tracking.js 
 *
 * Utilizes methods found
 * here: http://gddbeijing.appspot.com/blink.html
 * and here: https://github.com/rehabstudio/blink-detect
 *
 */

(function(window, undefined) {

  tracking.type.BLINK = {

    NAME: 'BLINK',

    defaults: {
      kNoBlobsError: -1,
      kTooManyBlobsError: -2,
      kWrongGeometryError: -3,

      kMaxBlobsToFind: 30,
      kBlobsSearchBorder: 20,
      kMinBlobsFound: 2,
      kMaxBlobsFound: 25,

      kMinEyeXSep: 40, // default 40
      kMaxEyeXSep: 100, // default 60
      kMaxEyeYSep: 100 // default 40
    },

    // thresholds 
    getDiffFramePixelArray: function(frame1, frame2) {
      var newFrame = new Array(frame1.data.length / 4);
      for (var i = 0; i < newFrame.length; i++) {
        var red = Math.abs(frame1.data[i * 4] - frame2.data[i * 4]);
        var green = Math.abs(frame1.data[i * 4 + 1] - frame2.data[i * 4 + 1]);
        var blue = Math.abs(frame1.data[i * 4 + 2] - frame2.data[i * 4 + 2]);

        newFrame[i] = (red + green + blue) / 3;

        // Threshold and invert
        newFrame[i] = newFrame[i] > 20 ? 0 : 255;
      }
      return newFrame;
    },

    putGreyFrame: function(context, frame, w, h) {
      var img = context.createImageData(w, h);
      for (var i = 0; i < w * h; i++) {
        img.data[i * 4 + 0] = frame[i];
        img.data[i * 4 + 1] = frame[i];
        img.data[i * 4 + 2] = frame[i];
        img.data[i * 4 + 3] = 255; // alpha
      }
      context.putImageData(img, 0, 0);
    },

    search: function(frame, width, height) {

      // store local instance of settings
      // @todo(matt) this should be re-factored so that
      // its done one time on track (which is out init) 
      var settings = this.settings;

      // given x and y of a pixel, find it's position within a char array

      function pixel(x, y) {
        if (x < 0 || x >= width || y < 0 || y >= height) {
          return 255;
        }
        return frame[x + y * width];
      }

      // Heuristic to trace the perimeter of a blob of pixels
      // its close enough for our needs
      // and fast performing 

      function tracePerim(i, j) {
        var x = i;
        var y = j + 1;
        var xmin = i;
        var xmax = i;
        var ymin = j;
        var ymax = j;
        var dir = 1;

        for (var count = 0; count < 300; count++) {
          var found = false;
          if ((x == i) && (y == j)) break; // gone full circle

          //   /3\
          // 2<   >4
          //   \1/   

          if (!found && dir == 1) { // Downwards
            if (!found && pixel(x - 1, y) === 0) {
              x--;
              found = true;
              dir = 2;
            }
            if (!found && pixel(x, y + 1) === 0) {
              y++;
              found = true;
              dir = 1;
            }
            if (!found && pixel(x + 1, y) === 0) {
              x++;
              found = true;
              dir = 4;
            }
            if (!found && pixel(x, y - 1) === 0) {
              y--;
              found = true;
              dir = 3;
            }
          }

          if (!found && dir === 4) { // Rightwards
            if (!found && pixel(x, y + 1) === 0) {
              y++;
              found = true;
              dir = 1;
            }
            if (!found && pixel(x + 1, y) === 0) {
              x++;
              found = true;
              dir = 4;
            }
            if (!found && pixel(x, y - 1) === 0) {
              y--;
              found = true;
              dir = 3;
            }
            if (!found && pixel(x - 1, y) === 0) {
              x--;
              found = true;
              dir = 2;
            }
          }

          if (!found && dir === 3) { // Upwards
            if (!found && pixel(x + 1, y) === 0) {
              x++;
              found = true;
              dir = 4;
            }
            if (!found && pixel(x, y - 1) === 0) {
              y--;
              found = true;
              dir = 3;
            }
            if (!found && pixel(x - 1, y) === 0) {
              x--;
              found = true;
              dir = 2;
            }
            if (!found && pixel(x, y + 1) === 0) {
              y++;
              found = true;
              dir = 1;
            }
          }

          if (!found && dir === 2) { // Leftwards
            if (!found && pixel(x, y - 1) === 0) {
              y--;
              found = true;
              dir = 3;
            }
            if (!found && pixel(x - 1, y) === 0) {
              x--;
              found = true;
              dir = 2;
            }
            if (!found && pixel(x, y + 1) === 0) {
              y++;
              found = true;
              dir = 1;
            }
            if (!found && pixel(x + 1, y) === 0) {
              x++;
              found = true;
              dir = 4;
            }
          }
          xmin = Math.min(x, xmin);
          ymin = Math.min(y, ymin);
          xmax = Math.max(x, xmax);
          ymax = Math.max(y, ymax);
        }

        return {
          'xmin': xmin,
          'ymin': ymin,
          'xmax': xmax,
          'ymax': ymax
        };
      }

      // Find blobs
      // settings.kBlobsSearchBorder is the area within the camera
      // that we search within? Smaller numbers should be better performance 
      var blobs = [];
      for (var h = settings.kBlobsSearchBorder; h < height - settings.kBlobsSearchBorder; h++) {
        if (blobs.length >= settings.kMaxBlobsToFind) break;
        for (var j = settings.kBlobsSearchBorder; j < width - settings.kBlobsSearchBorder; j++) {
          if (pixel(j, h) === 0 && pixel(j, h - 1) !== 0) {
            var temp = tracePerim(j, h);
            var xmin = temp.xmin;
            var xmax = temp.xmax;
            var ymin = temp.ymin;
            var ymax = temp.ymax;
            if ((xmax - xmin) * (ymax - ymin) > 10) {
              blobs.push({
                xmin: xmin,
                ymin: ymin,
                xmax: xmax,
                ymax: ymax
              });
              if (blobs.length >= settings.kMaxBlobsToFind) break;
            }
          }
        }
      }

      // check for too many or not enough blobs
      // if this is the case then return with the proper
      // res code right away. No need to run further maths.
      if (blobs.length < settings.kMinBlobsFound) {
        return [settings.kNoBlobsError, 'No Blobs'];
      } else if (blobs.length > settings.kMaxBlobsFound) {
        return [settings.kTooManyBlobsError, 'Too many blobs'];
      }

      // sorting by something! 
      blobs.sort(function(a, b) {
        return (b.xmax - b.xmin) * (b.ymax - b.ymin) - (a.xmax - a.xmin) * (a.ymax - a.ymin);
      });

      // Check dimensions
      var xNum = Math.abs((blobs[0].xmax + blobs[0].xmin) - (blobs[1].xmax + blobs[1].xmin));
      var yNum = Math.abs((blobs[0].ymax + blobs[0].ymin) - (blobs[1].ymax + blobs[1].ymin));
      var xSep = xNum / 2;
      var ySep = yNum / 2;
      console.log(xNum, yNum);

      // we check geometry because eyes are generally a certain 
      // distance apart and are generally level. 
      if (xSep < settings.kMinEyeXSep || xSep > settings.kMaxEyeXSep || ySep > settings.kMaxEyeYSep) {
        return [settings.kWrongGeometryError, 'Geometry off, xSep:' + xSep + ', ySep:' + ySep];
      }

      var l, r;

      // Find which eye is which
      if (blobs[0].xmax < blobs[1].xmax) {
        l = 0;
        r = 1;
      } else {
        l = 1;
        r = 0;
      }

      // Expand bounding boxes
      var dx = 3;
      var dy = 3;

      // return array with eye positions and maths
      return [0, blobs[l].xmin - dx, blobs[l].ymin - dy, blobs[l].xmax + dx, blobs[l].ymax + dy, blobs[r].xmin - dx, blobs[r].ymin - dy, blobs[r].xmax + dx, blobs[r].ymax + dy];
    },

    track: function(trackerGroup, video) {
      var instance = this,
        config = trackerGroup[0],
        imageData = video.getVideoCanvasImageData(),
        diffCanvas = document.getElementById('diff'),
        diffCtx = diffCanvas.getContext('2d'),
        canvas = video.canvas,
        height = canvas.get('height'),
        width = canvas.get('width');

      // update instance settings with optional
      // settings hash from user
      instance.settings = tracking.merge(instance.defaults, config.settings);
      var settings = instance.settings;

      // get current frame
      var currentFrame = imageData;

      // store the last frame on first run of track
      // without this our diffImage fn will throw error
      // @todo(matt) optimize this

      if (instance.lastFrame === undefined) {
        console.log(instance.lastFrame);
        instance.lastFrame = currentFrame;
        return;
      }

      // find diff between current and last
      // this is similar to openCV method
      var diffFramePixelArray = instance.getDiffFramePixelArray(currentFrame, instance.lastFrame);
      instance.putGreyFrame(diffCtx, diffFramePixelArray, width, height);

      // save current frame for comparison in next track
      instance.lastFrame = currentFrame;

      // search for eyes!
      // res will be array where fist item indicates
      // status ad defined in out settings. 
      var res = instance.search(diffFramePixelArray, width, height);

      // not a blink!
      // no blobs or too many blobs! 
      if (res[0] === settings.kNoBlobsError) {
        //console.log("no blobs");
      }

      else if(res[0] === settings.kTooManyBlobsError) {
        //console.log("too many!");
      }

      // wrong eye geometry
      // there is movement but the blobs are not in the proper
      // places so they are most likely not eyes. 
      else if (res[0] === settings.kWrongGeometryError) {
        console.log("wrong geometry", res[1]);
      }

      // a blink!
      // apply our onFound function if set in config
      else if (res[0] === 0) {
        if (config.onFound) {
          var trackRes = {
            rightEye: {
              x: res[1],
              y: res[2],
              width: res[3] - res[1],
              height: res[4] - res[2]
            },
            leftEye: {
              x: res[5],
              y: res[6],
              width: res[7] - res[5],
              height: res[8] - res[6]
            }
          };

          config.onFound.call(video, trackRes);
        }

      }
    }
  };

}(window));
