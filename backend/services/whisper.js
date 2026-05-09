const fs = require("fs");
const path = require("path");
const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Transcribe audio file using Groq Whisper API
 * @param {string} filePath - Path to the audio file
 * @param {string} language - Language code (e.g., 'en')
 * @returns {Object} { text, duration }
 */
async function transcribeAudio(filePath, language = "en") {
  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-large-v3-turbo",
      response_format: "verbose_json",
      language: language,
    });

    return {
      text: transcription.text,
      duration: transcription.duration,
      language: transcription.language,
    };
  } catch (error) {
    console.error("Groq Whisper error:", error);
    throw new Error(`Whisper API error: ${error.message}`);
  }
}

module.exports = { transcribeAudio };
