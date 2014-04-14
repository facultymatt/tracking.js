(function (window, undefined) {

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

            for (var i = 0; i < 320*240; i++) {
              img.data[i * 4 + 3] = 255;
              img.data[i * 4 + 0] = frame[i];
              img.data[i * 4 + 1] = frame[i];
              img.data[i * 4 + 2] = frame[i];
            }
            context.putImageData(img, x, y);
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
                integralImage = new Uint32Array(width*height),
                integralImageSquare = new Uint32Array(width*height),

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

}( window ));