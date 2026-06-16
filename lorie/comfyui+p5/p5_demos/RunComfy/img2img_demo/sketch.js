// p5+RunComfy Demo
//-------------------------------------------------------
// These should be modified by you:

const RunComfyURL = "https://www.runcomfy.com/comfyui/89e60215-b0a1-4795-8437-e2743cddc806/servers/b35bf43a-0c86-4865-9be5-1619687f62f6";
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

  // Copy the design into the image we transmit to RunComfy. 
  inputImg.copy(mainCanvas, 0, 0, 512, 512, 0, 0, 512, 512);
  
  //if we have received an image, put it onto the canvas
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
    resultImg = loadImage(data[0].src);
  }
}