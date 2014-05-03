
/*
Adds blink detection to tracking.js. Utilizes methods found
here: http://gddbeijing.appspot.com/blink.html 
and here: https://github.com/rehabstudio/blink-detect

*/

(function(window, undefined) {

  var isString = tracking.isString,

    distance = tracking.math.distance;

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
      // @todo w and h need to be passed in
      var img = context.createImageData(w, h);

      for (var i = 0; i < w*h; i++) {
        img.data[i * 4 + 0] = frame[i];
        img.data[i * 4 + 1] = frame[i];
        img.data[i * 4 + 2] = frame[i];
        img.data[i * 4 + 3] = 255; // alpha
      }
      context.putImageData(img, 0,0);
    },

    search: function(frame, width, height) {
      var kNoBlobsError = -1;
      var kTooManyBlobsError = -2;
      var kWrongGeometryError = -3;
      var kMaxBlobsToFind = 30;
      //var kBlobsSearchBorder = 20;
      var kBlobsSearchBorder = 20;
      var kMinBlobsFound = 2;
      var kMaxBlobsFound = 25;
      // var kMinEyeXSep = 40;
      // var kMaxEyeXSep = 60;
      // var kMaxEyeYSep = 40;

      var kMinEyeXSep = 40;
      //var kMaxEyeXSep = 60;
      var kMaxEyeXSep = 100;
      //var kMaxEyeYSep = 40;
      var kMaxEyeYSep = 100;

      function pixel(x, y) {
        if (x < 0 || x >= width || y < 0 || y >= height) {
          return 255;
        }
        return frame[x + y * width];
      }

      // Heuristic to trace the perimeter of a blob of pixels

      function tracePerim(i, j) {
        x = i;
        y = j + 1;
        xmin = i
        xmax = i;
        ymin = j;
        ymax = j;
        dir = 1;

        for (count = 0; count < 300; count++) {
          found = false;
          if ((x == i) && (y == j)) break; // gone full circle

          //   /3\
          // 2<   >4
          //   \1/   

          if (!found && dir == 1) { // Downwards
            if (!found && pixel(x - 1, y) == 0) {
              x--;
              found = true;
              dir = 2;
            }
            if (!found && pixel(x, y + 1) == 0) {
              y++;
              found = true;
              dir = 1;
            }
            if (!found && pixel(x + 1, y) == 0) {
              x++;
              found = true;
              dir = 4;
            }
            if (!found && pixel(x, y - 1) == 0) {
              y--;
              found = true;
              dir = 3;
            }
          }

          if (!found && dir == 4) { // Rightwards
            if (!found && pixel(x, y + 1) == 0) {
              y++;
              found = true;
              dir = 1;
            }
            if (!found && pixel(x + 1, y) == 0) {
              x++;
              found = true;
              dir = 4;
            }
            if (!found && pixel(x, y - 1) == 0) {
              y--;
              found = true;
              dir = 3;
            }
            if (!found && pixel(x - 1, y) == 0) {
              x--;
              found = true;
              dir = 2;
            }
          }

          if (!found && dir == 3) { // Upwards
            if (!found && pixel(x + 1, y) == 0) {
              x++;
              found = true;
              dir = 4;
            }
            if (!found && pixel(x, y - 1) == 0) {
              y--;
              found = true;
              dir = 3;
            }
            if (!found && pixel(x - 1, y) == 0) {
              x--;
              found = true;
              dir = 2;
            }
            if (!found && pixel(x, y + 1) == 0) {
              y++;
              found = true;
              dir = 1;
            }
          }

          if (!found && dir == 2) { // Leftwards
            if (!found && pixel(x, y - 1) == 0) {
              y--;
              found = true;
              dir = 3;
            }
            if (!found && pixel(x - 1, y) == 0) {
              x--;
              found = true;
              dir = 2;
            }
            if (!found && pixel(x, y + 1) == 0) {
              y++;
              found = true;
              dir = 1;
            }
            if (!found && pixel(x + 1, y) == 0) {
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
      var blobs = new Array();
      for (h = kBlobsSearchBorder; h < height - kBlobsSearchBorder; h++) {
        if (blobs.length >= kMaxBlobsToFind) break;
        for (j = kBlobsSearchBorder; j < width - kBlobsSearchBorder; j++) {
          if (pixel(j, h) == 0 && pixel(j, h - 1) != 0) {
            var temp = tracePerim(j, h);
            xmin = temp.xmin;
            xmax = temp.xmax;
            ymin = temp.ymin;
            ymax = temp.ymax;
            if ((xmax - xmin) * (ymax - ymin) > 10) {
              blobs.push({
                xmin: xmin,
                ymin: ymin,
                xmax: xmax,
                ymax: ymax
              });
              if (blobs.length >= kMaxBlobsToFind) break;
            }
          }
        }
      }

      // Sort blobs
      if (blobs.length < kMinBlobsFound) {
        return [kNoBlobsError, "No blobs"];
      } else if (blobs.length > kMaxBlobsFound) {
        return [kTooManyBlobsError, "Too many blobs"];
      }
      blobs.sort(function(a, b) {
        (b.xmax - b.xmin) * (b.ymax - b.ymin) - (a.xmax - a.xmin) * (a.ymax - a.ymin)
      });

      // Check dimensions
      xSep = Math.abs((blobs[0].xmax + blobs[0].xmin) - (blobs[1].xmax + blobs[1].xmin)) / 2;
      ySep = Math.abs((blobs[0].ymax + blobs[0].ymin) - (blobs[1].ymax + blobs[1].ymin)) / 2;

  console.log("Geometry is, xSep:" + xSep + ", ySep:" + ySep);


      if (xSep < kMinEyeXSep || xSep > kMaxEyeXSep || ySep > kMaxEyeYSep) {
        return [kWrongGeometryError, "Geometry off, xSep:" + xSep + ", ySep:" + ySep];
      }

      // Find which eye is which
      if (blobs[0].xmax < blobs[1].xmax) {
        l = 0;
        r = 1;
      } else {
        l = 1;
        r = 0;
      }

      // Expand bounding boxes
      dx = 3;
      dy = 3;
      return [0, blobs[l].xmin - dx, blobs[l].ymin - dy, blobs[l].xmax + dx, blobs[l].ymax + dy, blobs[r].xmin - dx, blobs[r].ymin - dy, blobs[r].xmax + dx, blobs[r].ymax + dy];
    },

    track: function(trackerGroup, video) {
      var instance = this,
        // Human tracking finds multiple targets, doesn't need to support
        // multiple track listeners, force to use only the first configuration.
        config = trackerGroup[0],
        defaults = instance.defaults,
        imageData = video.getVideoCanvasImageData(),
        diffCanvas = document.getElementById("diff"),
        diffCtx = diffCanvas.getContext("2d"),
        canvas = video.canvas,
        height = canvas.get('height'),
        width = canvas.get('width');

      // get current frame
      var currentFrame = imageData;

      // store the last frame on first run of track
      // without this our diffImage fn will throw error
      // @todo(matt) optimize this
      if (instance.lastFrame == null) {
        instance.lastFrame = currentFrame;
        return;
      }

      // find diff between current and last
      // this is similar to openCV method
      var diffFramePixelArray = instance.getDiffFramePixelArray(currentFrame, instance.lastFrame);
      instance.putGreyFrame(diffCtx, diffFramePixelArray, width, height);

      // save current frame for comparison in next track
      instance.lastFrame = currentFrame;

      var res = instance.search(diffFramePixelArray, width, height);

      if (res[0] !== -1 && res[0] !== -2) {
        //console.log(res);
      }

      if (res[0] === 0) {
        console.log('BLINK!!!');
        
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
          }

          config.onFound.call(video, trackRes);
        }

      }
    }
  };

}(window));
