// Import the required libraries for the Gemini API
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Set up the handler for the Vercel API endpoint
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow requests from any origin
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'); // Allowed methods
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Allowed headers
  
  if (req.method === 'OPTIONS') {
    // Respond to preflight request
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { audioFileBase64, mimeType } = req.body;

      if (!audioFileBase64 || !mimeType) {
        return res.status(400).json({ error: 'Invalid request. Please provide the audio file and MIME type.' });
      }

      const fileManager = new GoogleAIFileManager(process.env.API_KEY);

      // Upload the audio file to the Gemini File API
      const uploadResult = await fileManager.uploadFile(
        Buffer.from(audioFileBase64, 'base64'),
        {
          mimeType: mimeType,
          displayName: "Uploaded Audio",
        }
      );

      let file = await fileManager.getFile(uploadResult.file.name);
      while (file.state === FileState.PROCESSING) {
        await new Promise(resolve => setTimeout(resolve, 10_000)); // Wait for 10 seconds before checking again
        file = await fileManager.getFile(uploadResult.file.name);
      }

      if (file.state === FileState.FAILED) {
        throw new Error("Audio processing failed.");
      }

      const genAI = new GoogleGenerativeAI(process.env.API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Generate content from the uploaded file
      const result = await model.generateContent([
        "Tell me about this audio clip.",
        {
          fileData: {
            fileUri: uploadResult.file.uri,
            mimeType: uploadResult.file.mimeType,
          },
        },
      ]);

      // Send the result back to the frontend
      return res.status(200).json({ response: result.response.text() });

    } catch (error) {
      console.error("Error processing request:", error);
      return res.status(500).json({ error: 'An error occurred while processing the audio.' });
    }
  } else {
    // Return a 405 Method Not Allowed for unsupported HTTP methods
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
