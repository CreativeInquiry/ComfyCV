// p5+RunComfy Demo
// limit colors : "fluorescentpink", "teal"
//-------------------------------------------------------
// These should be modified by you:

const RunComfyURL = "https://www.runcomfy.com/comfyui/89e60215-b0a1-4795-8437-e2743cddc806/servers/b35bf43a-0c86-4865-9be5-1619687f62f6";
let myCaption = "rothko stylization of a pattern of ink blots and stars, same colors";
let myRandomSeed = 1234567890;
let myDenoiseAmount = 0.80;
let bVerbose = true;

//-------------------------------------------------------
let margin = 12;
let noiseScale = 0.02;
let r = 25;
let blobColor;
let starColor;
let lineColor;

let workflow;
let comfy;
let inputImg;
let resultImg;
const IMG_DIM = 512;
let mainCanvas;
let requestImageButton;
let randomizeButton;

function preload() {
  workflow = loadJSON("workflow_img2img_api.json");
}


//-------------------------------------------------------
function setup() {
  mainCanvas = createCanvas(IMG_DIM*2, IMG_DIM);
  pixelDensity(1);
  inputImg = createGraphics(IMG_DIM, IMG_DIM);

  angleMode(DEGREES);
  colorMode(HSB, 360, 100, 100, 100);

  r = (IMG_DIM - margin/2) / 25;

  let baseHue = random(360);
  blobColor = color(baseHue, 70, 75);
  starColor = color((baseHue + 180) % 360, 85, 95);
  lineColor = color((baseHue + 30) % 360, 30, 95, 40);

  server_id = getServerIdFromRuncomfyURL(RunComfyURL);
  server_url = "https://" + server_id + "-comfyui.runcomfy.com";
  comfy = new ComfyUiP5Helper(server_url);
  if (bVerbose) {
    console.log("comfy url is: " + server_url);
    print(comfy);
  }

  randomizeButton = createButton("Randomize");
  randomizeButton.mousePressed(randomizeSeed);
  requestImageButton = createButton("Generate img2img");
  requestImageButton.mousePressed(requestImage);
}


//-------------------------------------------------------
// This is the main function you'll need to change.
function draw() {
  background(250);

  // lines in back
  push();
  stroke(lineColor);
  strokeWeight(0.3);
  lineMany(IMG_DIM, IMG_DIM, 1.5);
  pop();

  push();
  for (let x = margin + r; x < IMG_DIM - (margin*2); x += (2*r)) {
    for (let y = margin + r; y < IMG_DIM - margin*2; y += (2*r)) {
      let a = noise(noiseScale*x, noiseScale*y);

      fill(
        hue(blobColor),
        saturation(blobColor),
        brightness(blobColor),
        a * 100
      );
      noStroke();
      push();
      translate(x, y);
      drawSplot();
      fill(
        hue(starColor),
        saturation(starColor),
        brightness(starColor),
        min(a * 100, 100)
      );
      if ((x < IMG_DIM - (margin*2) - (2*r)) && (y < IMG_DIM - (margin*2) - (2*r))) {
        star(-r * 15/5, -r * 15/5);
      }
      pop();
    }
  }
  pop();

  // Copy the design into the image we transmit to RunComfy.
  inputImg.copy(mainCanvas, 0, 0, IMG_DIM, IMG_DIM, 0, 0, IMG_DIM, IMG_DIM);

  // If we have received an image, put it onto the canvas
  fill(255);
  noStroke();
  rect(IMG_DIM, 0, IMG_DIM, IMG_DIM);
  if (resultImg) {
    image(resultImg, IMG_DIM, 0, IMG_DIM, IMG_DIM);
  }

  push();
  fill(0, 0, 30);
  noStroke();
  textAlign(LEFT);
  textSize(11);
  text("space to generate image, c for new random color, s to save image, r to randomize seed", width/2, height - 8);
  pop();
}


//-------------------------------------------------------
function drawSplot() {
  angleMode(DEGREES);
  noStroke();
  push();
  beginShape();
  for (let i = 0; i < 360; i += 5) {
    let vari = randomGaussian(-r/88, r/88);
    let x = (r + vari)*cos(i);
    let y = (r + vari)*sin(i);
    curveVertex(x, y);
  }
  endShape();
  pop();
}

function star(x, y) {
  push();
  beginShape();
  vertex(55 + x, 80 + y);
  vertex(55 + x, 80 + y);
  curveVertex(70 + x, 75 + y);
  vertex(80 + x, 55 + y);
  vertex(80 + x, 55 + y);
  curveVertex(90 + x, 75 + y);
  vertex(105 + x, 80 + y);
  vertex(105 + x, 80 + y);
  curveVertex(90 + x, 85 + y);
  vertex(80 + x, 105 + y);
  vertex(80 + x, 105 + y);
  curveVertex(70 + x, 85 + y);
  vertex(55 + x, 80 + y);
  vertex(55 + x, 80 + y);
  endShape();
  pop();
}

function lineMany(w, h, d) {
  for (let i = margin; i < w - margin; i += d) {
    line(i, margin, i, h - margin);
  }
}




//-------------------------------------------------------
function keyPressed(){
  if (key == ' '){
    requestImage();
  } else if (key == 'r'){
    randomizeSeed();
  } else if (key == 's'){
    // Press 's' to save the generated image.
    resultImg.save("seed" + myRandomSeed + "_result.png");
    inputImg.save("seed" + myRandomSeed + "_input.png");
  } else if (key == 'c'){
    let baseHue = random(360);
    blobColor = color(baseHue, 70, 75);
    starColor = color((baseHue + 180) % 360, 85, 95);
    lineColor = color((baseHue + 30) % 360, 30, 95, 40);
  }
}



//////////////////////////////////////////////////////////////
// You probably don't need to change anything below this line.
//-------------------------------------------------------
function randomizeSeed(){
  myRandomSeed = int(1234567890 + millis());

  let baseHue = random(360);
  blobColor = color(baseHue, 70, 75);
  starColor = color((baseHue + 180) % 360, 85, 95);
  lineColor = color((baseHue + 30) % 360, 30, 95, 40);

  loop();
}

//-------------------------------------------------------
function getServerIdFromRuncomfyURL(url){
  const parsedUrl = new URL(url);
  const parts = parsedUrl.pathname.split("/");
  const server_id = parts.pop(); // get part after last slash
  return server_id;
}

//-------------------------------------------------------
async function requestImage() {
  // Node 10 in this workflow is LoadImage
  const uploaded = await comfy.image(inputImg);
  if (!workflow["10"]) {
    console.error("Node 10 not found in workflow!");
    return;
  }
  workflow["10"].inputs.image = uploaded;

  // update the prompt
  workflow[6].inputs.text = myCaption;

  // randomize the seed, adjust the denoising
  workflow[3].inputs.seed = myRandomSeed;
  workflow[3].inputs.denoise = myDenoiseAmount;

  // send the data to RunComfy
  comfy.run(workflow, gotImage);
}

//-------------------------------------------------------
function gotImage(data, err) {
  // This function is called when we receive data back from RunComfy.
  // `data` is an array of outputs from running the workflow.
  if (bVerbose){
    console.log("gotImage", data);
  }
  if (data.length > 0) {
    loadImage(data[0].src, img => {
      resultImg = img;
      redraw();
    });
  }
}
