/**
 * This p5.js sketch integrates with the Google Gemini API to generate text responses
 * based on your prompt and the current canvas content.
 * See notes inside geminiAPI.js for how to obtain your own API key
 * Have fun and remix! @pitaru 2024 
 */

function setup() {
  createCanvas(500, 500);
}
function touchEnded() {
  askGeminiWithCanvas(`In 1 word and one emoji, tell me what you see. Be silly and fun and creative. ...And do it in French :)`);
}
function touchStarted() {
  background(255);
}
function touchMoved() {
  line(pmouseX, pmouseY,
       mouseX, mouseY);
}
function onGeminiResponse(r) {
  textAlign(CENTER);
  textSize(50);
  text(r, 250, 470);
}