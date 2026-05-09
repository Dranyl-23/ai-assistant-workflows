const pdf = require("pdf-parse");
const fs = require("fs");

/**
 * Extract text from a file (PDF or TXT)
 * @param {string} filePath - Path to the local file
 * @param {string} mimeType - File MIME type
 * @returns {Promise<string>} Extracted text
 */
async function extractText(filePath, mimeType) {
  try {
    const dataBuffer = fs.readFileSync(filePath);

    if (mimeType === "application/pdf") {
      const data = await pdf(dataBuffer);
      return data.text;
    } 
    
    if (mimeType.startsWith("text/")) {
      return dataBuffer.toString("utf8");
    }

    // Default for other types
    return "";
  } catch (error) {
    console.error("[DocumentProcessing] Extraction Error:", error);
    return "";
  }
}

module.exports = { extractText };
