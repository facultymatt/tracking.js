// Processor to detect blinks based on an approach by Burke et al,
// Medical and Biological Engineering and Computing, Volume 39, Number 3 / May, 2001
// HTML 5 implementation inspired by Paul Rouget's motion tracker work

var processor = {
  worker: null,
  video: null,
  audio: null,
  outCanvas: null,
  outCtx: null,
  diffCanvas: null,
  diffCtx: null,
  lastFrame: null,
  videoWidth: null,
  videoHeight: null,
  widthScale: 2,
  heightScale: 2,
  leftEye: null,
  rightEye: null,
  label: null,
  kEyeBoxDisarmTime: 1200,

  timerCallback: function() {
    if (this.video.paused) {
      return;
    }
  
    this.processFrame();

    let self = this;
    setTimeout(function () {
      self.timerCallback();
    }, 0);
  },

  onLoad: function() {
    this.video = document.getElementById("video");
    this.outCanvas = document.getElementById("out");
    this.outCtx = this.outCanvas.getContext("2d");
    this.diffCanvas = document.getElementById("diff");
    this.diffCtx = this.diffCanvas.getContext("2d");
    this.videoWidth = this.video.videoWidth / this.widthScale;
    this.videoHeight = this.video.videoHeight / this.heightScale;
    this.label = document.getElementById("label");
    this.audio = document.getElementById("audio");
    this.worker = new Worker("findeyes.js");

    let self = this;
    this.worker.onmessage = function(event) {
      if (event.data[0] == 0) {
        self.foundEyes(event.data.slice(1));
      }
    };

    this.video.addEventListener("play", function() {
      self.count = 0;
        self.timerCallback();
    }, false);
    
    // Workaround to make looping work
    this.video.addEventListener("ended", function() {
      self.video.play();
    }, false);
  },

  getVideoFrame: function() {
    this.outCtx.drawImage(this.video, 0, 0, this.videoWidth, this.videoHeight);
    return this.outCtx.getImageData(0, 0, this.videoWidth, this.videoHeight);
  },

  putGreyFrame: function(frame, x, y) {
    let img = this.diffCtx.createImageData(this.videoWidth, this.videoHeight);
    for (let i = 0; i < frame.length; i++) {
      img.data[i * 4 + 3] = 255;
      img.data[i * 4 + 0] = frame[i];
      img.data[i * 4 + 1] = frame[i];
      img.data[i * 4 + 2] = frame[i];
    }
    this.diffCtx.putImageData(img, x, y);
  },

  diffFrame: function(frame1, frame2) {
    let newFrame = new Array(frame1.data.length / 4);
    for (let i = 0; i < newFrame.length; i++) {
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

  processFrame: function() {
    let currentFrame = this.getVideoFrame();

    if (this.lastFrame == null) {
      this.lastFrame = currentFrame;
      return;
    }
  
    // Get the difference frame
    let diffFrame = this.diffFrame(currentFrame, this.lastFrame);
    this.putGreyFrame(diffFrame, 0, 0);
    this.lastFrame = currentFrame;
  
    // Draw eye boxes if eyes recently detected
    this.maybeDrawEyeBoxes();

    // Locate eyes in worker thread
    var args = {
      frame: diffFrame,
      height: this.videoHeight,
      width: this.videoWidth,
    }

    this.worker.postMessage(args);
  },

  foundEyes: function(result) {
    if (this.leftEye != null) return;

    // Store found eye geometry
    this.leftEye = {};
    this.rightEye = {};
    [this.leftEye.x1, this.leftEye.y1, this.leftEye.x2, this.leftEye.y2, this.rightEye.x1, this.rightEye.y1, this.rightEye.x2, this.rightEye.y2] = result;

    // Update text and play audio 
    this.label.innerHTML = "&nbsp;&nbsp;<font color=\"green\"><b>Blink detected!</b></font>";
    //this.audio.play();  // causes Firefox to slow down

    // Disarm
    let self = this;
    setTimeout(function () {
      self.leftEye = null;
      self.rightEye = null;
      self.label.innerHTML = "";
    }, self.kEyeBoxDisarmTime);
  },

  maybeDrawEyeBoxes: function() {
    if (this.leftEye != null && this.rightEye != null) {
      this.drawBox(this.outCtx, '#00ff00', this.leftEye.x1, this.leftEye.y1, this.leftEye.x2, this.leftEye.y2);
      this.drawBox(this.outCtx, '#00ff00', this.rightEye.x1, this.rightEye.y1, this.rightEye.x2, this.rightEye.y2);
      this.drawBox(this.diffCtx, '#ff0000', this.leftEye.x1, this.leftEye.y1, this.leftEye.x2, this.leftEye.y2);
      this.drawBox(this.diffCtx, '#ff0000', this.rightEye.x1, this.rightEye.y1, this.rightEye.x2, this.rightEye.y2);
    }
  },

  drawBox: function(ctx, style, x1, y1, x2, y2) {
    ctx.strokeStyle = style;
    ctx.lineWidth = 1;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }
};