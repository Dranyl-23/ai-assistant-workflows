const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

/**
 * Convert text to speech using ElevenLabs API
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - ElevenLabs voice ID (optional, uses env default)
 * @returns {Buffer} Audio buffer (mp3)
 */
async function textToSpeech(text, voiceId = null) {
  const voice = voiceId || process.env.ELEVENLABS_VOICE_ID;

  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voice}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get available voices
 * @returns {Array} List of available voices
 */
async function getVoices() {
  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch voices");
  }

  const data = await response.json();
  return data.voices.map((v) => ({
    id: v.voice_id,
    name: v.name,
    category: v.category,
    preview_url: v.preview_url,
  }));
}

module.exports = { textToSpeech, getVoices };
