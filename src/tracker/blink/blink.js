(function(window, undefined) {

  var isString = tracking.isString,

    distance = tracking.math.distance;

  tracking.type.BLINK = {

    NAME: 'BLINK',

    defaults: {},

    getDiffFramePixelArray: function(frame1, frame2) {
      var newFrame = new Array(frame1.data.length / 4);
      for (var i = 0; i < newFrame.length; i++) {
        newFrame[i] = (Math.abs(frame1.data[i * 4] - frame2.data[i * 4]) +
          Math.abs(frame1.data[i * 4 + 1] - frame2.data[i * 4 + 1]) +
          Math.abs(frame1.data[i * 4 + 2] - frame2.data[i * 4 + 2])) / 3;
        // Threshold and invert
        if (newFrame[i] > 20) {
          newFrame[i] = 0;
        } else {
          newFrame[i] = 255;
        }
      }

      return newFrame;
    },

    putGreyFrame: function(context, frame, x, y, w, h) {
      // @todo w and h need to be passed in
      var img = context.createImageData(320, 240);

      for (var i = 0; i < 320 * 240; i++) {
        img.data[i * 4 + 3] = 255;
        img.data[i * 4 + 0] = frame[i];
        img.data[i * 4 + 1] = frame[i];
        img.data[i * 4 + 2] = frame[i];
      }
      context.putImageData(img, x, y);
    },

    search: function(frame, width, height) {
      var kNoBlobsError = -1;
      var kTooManyBlobsError = -2;
      var kWrongGeometryError = -3;
      var kMaxBlobsToFind = 30;
      var kBlobsSearchBorder = 20;
      var kMinBlobsFound = 2;
      var kMaxBlobsFound = 25;
      var kMinEyeXSep = 40;
      var kMaxEyeXSep = 60;
      var kMaxEyeYSep = 40;

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

        return {'xmin': xmin, 'ymin': ymin, 'xmax': xmax, 'ymax': ymax};
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
            if ((xmax - xmin) * (ymax - ymin) > 5) {
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
        canvas = video.canvas,
        height = canvas.get('height'),
        width = canvas.get('width'),
        integralImage = new Uint32Array(width * height),
        integralImageSquare = new Uint32Array(width * height),

        imageLen = 0,

        s,
        pixel,
        pixelSum = 0,
        pixelSumSquare = 0;

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
      this.diffCanvas = document.getElementById("diff");
      this.diffCtx = this.diffCanvas.getContext("2d");
      instance.putGreyFrame(this.diffCtx, diffFramePixelArray, 0, 0, width, height);

      // save current frame for comparison in next track
      instance.lastFrame = currentFrame;


      var res = instance.search(diffFramePixelArray, width, height);      

      if(res[0] !== -1 && res[0] !== -2) {
        //console.log(res); 
      }

      if(res[0] === 0) {
        console.log('BLINK!!!');
        console.log(res);
      }



      // canvas.forEach(imageData, function(r, g, b, a, w, i, j) {
      //     pixel = ~~(r*0.299 + b*0.587 + g*0.114);

      //     if (i === 0 & j === 0) {
      //         pixelSum = pixel;
      //         pixelSumSquare = pixel*pixel;
      //     }
      //     else if (i === 0) {
      //         pixelSum = pixel + integralImage[i*width + (j - 1)];
      //         pixelSumSquare = pixel*pixel + integralImageSquare[i*width + (j - 1)];
      //     }
      //     else if (j === 0) {
      //         pixelSum = pixel + integralImage[(i - 1)*width + j];
      //         pixelSumSquare = pixel*pixel + integralImageSquare[(i - 1)*width + j];
      //     }
      //     else {
      //         pixelSum = pixel + integralImage[i*width + (j - 1)] + integralImage[(i - 1)*width + j] - integralImage[(i - 1)*width + (j - 1)];
      //         pixelSumSquare = pixel*pixel + integralImageSquare[i*width + (j - 1)] + integralImageSquare[(i - 1)*width + j] - integralImageSquare[(i - 1)*width + (j - 1)];
      //     }

      //     integralImage[imageLen] = pixelSum;
      //     integralImageSquare[imageLen] = pixelSumSquare;
      //     imageLen++;
      // });

      var i,
        j,
        blockJump = defaults.blockJump,
        blockScale = defaults.blockScale,
        blockSize = defaults.blockSize,
        maxBlockSize = Math.min(width, height),
        rectIndex = 0,
        rects = [];

      // for (; blockSize <= maxBlockSize; blockSize = ~~(blockSize*blockScale)) {
      //     for (i = 0; i < (height - blockSize); i+=blockJump) {
      //         for (j = 0; j < (width - blockSize); j+=blockJump) {
      //             var pass = true;

      //             for (s = 0; s < stagesLen; s++) {
      //                 var stage = stages[s];

      //                 pass = instance.evalStage_(stage, integralImage, integralImageSquare, i, j, width, height, blockSize);

      //                 if (!pass) {
      //                     break;
      //                 }
      //             }

      //             if (pass) {
      //                 rects[rectIndex++] = {
      //                     size: blockSize,
      //                     x: j,
      //                     y: i
      //                 };

      //                 // canvas.context.strokeStyle = "rgb(255,0,0)";
      //                 // canvas.context.strokeRect(j, i, blockSize, blockSize);
      //             }
      //         }
      //     }
      // }

      if (config.onFound) {
        config.onFound.call(video, video);
      }
    }

  };

}(window));
