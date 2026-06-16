
# Gemini and p5

As a CMU student, you have access to Gemini through your university Google account. According to the CMU Computing Services [website](https://www.cmu.edu/computing/software/titles/google-gemini/index.html):

> "gemini.google.com protects your data when you log in with your Andrew userID. Google will not retain your prompts or responses to train its AI models."

## Getting Your Gemini API Key

1. Go to the [Google Cloud Resource Manager](https://console.cloud.google.com/cloud-resource-manager?walkthrough_id=resource-manager--create-project&start_index=1#step_index=1).

2. Create a project under **Students**. (You're given $300 in free credits, so this should be well within limits.)

   ![Step 2 — before](/lorie/gemini+p5/imgs/step_2.png)
   ![Step 2 — after](/lorie/gemini+p5/imgs/result_of_step_2.png)

3. Go to [Gemini AI Studio](https://aistudio.google.com/u/1/), navigate to your Dashboard, and click **Projects**.

4. Click **Import Projects** in the top right and follow the on-screen instructions to import your new project.

   ![Step 4](/lorie/gemini+p5/imgs/step_4.png)

5. Once the project is imported, go to the **API Keys** section under Dashboard and click **Create API Key** in the top right. Select your project, and your new key will appear on the dashboard — copy it to use for the assignment.

   ![Step 5](/lorie/gemini+p5/imgs/step_5.png)

## Notes

There is a simple demo in this folder (also available [here](https://editor.p5js.org/loriechen333/sketches/P1ziPoKf7)): you draw a sketch, send it to Gemini, and Gemini comments on your drawing. Usage is self-explanatory.

You may see warnings like:

> "[GeminiAPI.js] Ignored request because a previous one is still pending. Use throttleGeminiRequests(false) to allow concurrency."

This is a known Gemini API behavior and not something you need to worry about.