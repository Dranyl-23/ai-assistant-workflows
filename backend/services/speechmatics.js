const fs = require("fs");
const SPEECHMATICS_TTS_URL = "https://preview.tts.speechmatics.com/generate";
const SPEECHMATICS_STT_URL = "https://api.speechmatics.com/v2/jobs";
const SPEECHMATICS_API_KEY = process.env.SPEECHMATICS_API_KEY;

/**
 * Convert text to speech using Speechmatics API (Preview)
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - Speechmatics voice ID (e.g., 'sarah', 'theo', 'jack', 'megan')
 * @returns {Buffer} Audio buffer (wav)
 */
async function textToSpeech(text, voiceId = null) {
  const voice = voiceId || process.env.SPEECHMATICS_VOICE_ID || "sarah";
  const url = `${SPEECHMATICS_TTS_URL}/${voice}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SPEECHMATICS_API_KEY}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Speechmatics TTS error: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("[Speechmatics] TTS error:", error.message);
    throw error;
  }
}

/**
 * Get available voices for Speechmatics TTS
 * @returns {Array} List of available voices
 */
async function getVoices() {
  return [
    { id: "sarah", name: "Sarah", description: "Friendly support voice" },
    { id: "theo", name: "Theo", description: "Trusted presenter voice" },
    { id: "jack", name: "Jack", description: "Support specialist voice" },
    { id: "megan", name: "Megan", description: "Clear companion voice" },
  ];
}

/**
 * Transcribe audio using Speechmatics API
 * @param {string} filePath - Path to audio file
 * @param {string} language - Language code (e.g. 'en')
 * @returns {Object} { text }
 */
async function transcribeAudio(filePath, language = "en") {
  try {
    const formData = new FormData();
    const config = {
      type: "transcription",
      transcription_config: {
        language: language,
      },
    };
    
    formData.append("config", JSON.stringify(config));
    formData.append("data_file", fs.createReadStream(filePath));

    const response = await fetch(SPEECHMATICS_STT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SPEECHMATICS_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Speechmatics STT Job error: ${response.status} - ${errorText}`);
    }

    const { id } = await response.json();

    // Poll for results
    let status = "running";
    let result = null;
    while (status !== "done") {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await fetch(`${SPEECHMATICS_STT_URL}/${id}`, {
        headers: { "Authorization": `Bearer ${SPEECHMATICS_API_KEY}` }
      });
      const statusData = await statusRes.json();
      status = statusData.job.status;
      
      if (status === "rejected") throw new Error("Speechmatics STT job rejected");
      
      if (status === "done") {
        const transcriptRes = await fetch(`${SPEECHMATICS_STT_URL}/${id}/transcript`, {
          headers: { "Authorization": `Bearer ${SPEECHMATICS_API_KEY}` }
        });
        result = await transcriptRes.json();
      }
    }

    return {
      text: result.results.map(r => r.alternatives[0].content).join(""),
    };
  } catch (error) {
    console.error("[Speechmatics] STT error:", error.message);
    throw error;
  }
}

module.exports = { textToSpeech, getVoices, transcribeAudio };
