// p5 + ComfyCloud Demo
//-------------------------------------------------------
// These should be modified by you:

const proxyUrl = "http://localhost:3000"; // address of the local proxy server
let myCaption = "still life of large rhinoceros horned beetle insects on a table";
let myRandomSeed = 1234567890;
let myDenoiseAmount = 0.80;
let bVerbose = true;

//-------------------------------------------------------
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
// This is the main function you'll need to change.
function draw() {
  // Draw a scene to use for img2img generation
  background(119, 136, 153); //'LightSlateGray'
  noStroke();
  fill(250,235,215); //'AntiqueWhite'
  ellipse(250,400,1200,350);

  randomSeed(myRandomSeed);
  stroke(0,0,0);
  strokeWeight(2);
  for (let i=0; i<2; i++){
    let rr = random(70,90);
    let rg = random(30,55);
    let rb = random(10,15);
    let diam = random(90,160);
    fill(rr,rg,rb);
    let bx = IMG_DIM * ((i+1)/3) + random(-20,20);
    let by = IMG_DIM * random(0.65, 0.85);
    ellipse(bx,by, diam, diam*0.6);
  }

  // Copy the design into the image we transmit to ComfyCloud.
  inputImg.copy(mainCanvas, 0, 0, IMG_DIM, IMG_DIM, 0, 0, IMG_DIM, IMG_DIM);

  // If we have received an image, put it onto the canvas
  fill(255);
  noStroke();
  rect(IMG_DIM, 0, IMG_DIM, IMG_DIM);
  if (resultImg) {
    image(resultImg, IMG_DIM, 0, IMG_DIM, IMG_DIM);
  }
}


//-------------------------------------------------------
function setup() {
  mainCanvas = createCanvas(IMG_DIM*2, IMG_DIM);
  pixelDensity(1); // Setting this to 2 may double your image size.
  inputImg = createGraphics(IMG_DIM, IMG_DIM);

  comfy = new ComfyUiP5Helper(proxyUrl);
  if (bVerbose) {
    console.log("[sketch] ComfyCloud proxy helper ready, client ID:", comfy.clientId);
  }

  randomizeButton = createButton("Randomize");
  randomizeButton.mousePressed(randomizeSeed);
  requestImageButton = createButton("Generate img2img");
  requestImageButton.mousePressed(requestImage);
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
  }
}



//////////////////////////////////////////////////////////////
// You probably don't need to change anything below this line.
//-------------------------------------------------------
function randomizeSeed(){
  myRandomSeed = int(1234567890 + millis());
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

  // send the workflow to ComfyCloud
  comfy.run(workflow, gotImage);
}

//-------------------------------------------------------
function gotImage(data, err) {
  // This function is called when we receive data back from ComfyCloud.
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
