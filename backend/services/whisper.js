const speechmaticsService = require("./speechmatics");

/**
 * Transcribe audio file using Speechmatics API
 * @param {string} filePath - Path to the audio file
 * @param {string} language - Language code (e.g., 'en')
 * @returns {Object} { text }
 */
async function transcribeAudio(filePath, language = "en") {
  try {
    const result = await speechmaticsService.transcribeAudio(filePath, language);
    return {
      text: result.text,
      // Speechmatics job results can include duration, but for now we return the text
    };
  } catch (error) {
    console.error("Speechmatics STT error:", error);
    throw new Error(`Speechmatics API error: ${error.message}`);
  }
}

module.exports = { transcribeAudio };
