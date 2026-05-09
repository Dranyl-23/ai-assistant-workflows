const { pipeline } = require("@xenova/transformers");

// Use a singleton pattern to ensure the model is loaded only once
class EmbeddingPipeline {
  static task = "feature-extraction";
  static model = "Xenova/all-MiniLM-L6-v2";
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      console.log(`[Embeddings] Loading local model: ${this.model}...`);
      this.instance = await pipeline(this.task, this.model, { progress_callback });
      console.log(`[Embeddings] Model loaded successfully.`);
    }
    return this.instance;
  }
}

/**
 * Generate a 384-dimensional vector embedding for a given text.
 * @param {string} text - The input text to embed.
 * @returns {Promise<number[]>} Array of 384 floats.
 */
async function generateEmbedding(text) {
  try {
    const extractor = await EmbeddingPipeline.getInstance();
    // Generate output. Setting `pooling: 'mean'` and `normalize: true` is standard for MiniLM.
    const output = await extractor(text, { pooling: "mean", normalize: true });
    // Convert Tensor data into a standard JavaScript array
    return Array.from(output.data);
  } catch (err) {
    console.error("[Embeddings] Failed to generate embedding:", err);
    throw err;
  }
}

/**
 * Split text into overlapping chunks.
 * @param {string} text - The full text to split.
 * @param {number} chunkSize - Number of characters per chunk.
 * @param {number} overlap - Overlap size.
 * @returns {string[]} Array of text chunks.
 */
function chunkText(text, chunkSize = 1000, overlap = 200) {
  if (!text) return [];
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  const chunks = [];
  let i = 0;
  
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end));
    i += chunkSize - overlap;
  }
  
  return chunks;
}

module.exports = {
  generateEmbedding,
  chunkText,
};
