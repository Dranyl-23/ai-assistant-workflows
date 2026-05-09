const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../middleware/auth");
const { supabaseAdmin } = require("../config/supabase");
const whisperService = require("../services/whisper");
const elevenlabsService = require("../services/elevenlabs");
const documentProcessing = require("../services/documentProcessing");
const { generateEmbedding, chunkText } = require("../services/embeddings");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, "../uploads/"),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

router.use(requireAuth);

// GET /documents - list all docs
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("id, name, type, size, storage_path, created_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ documents: data || [] });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// POST /documents/upload
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const file = req.file;
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    const storagePath = `${req.user.id}/${fileId}${ext}`;
    const fileBuffer = fs.readFileSync(file.path);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("Document")
      .upload(storagePath, fileBuffer, { contentType: file.mimetype });
    if (uploadError) throw uploadError;

    // Extract text content
    const content = await documentProcessing.extractText(file.path, file.mimetype);

    const { data, error: dbError } = await supabaseAdmin
      .from("documents")
      .insert({
        id: fileId, user_id: req.user.id, name: file.originalname,
        type: file.mimetype, size: file.size, storage_path: storagePath,
        content: content, // Save extracted text
        created_at: new Date().toISOString(),
      })
      .select();

    if (dbError) throw dbError;

    // --- NEW: Generate Vector Embeddings for Smart RAG ---
    if (content && content.trim().length > 0) {
      console.log(`[Upload] Generating vector embeddings for ${file.originalname}...`);
      const chunks = chunkText(content, 1000, 200);
      
      const chunkInserts = [];
      for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        const embedding = await generateEmbedding(chunk);
        chunkInserts.push({
          document_id: fileId,
          user_id: req.user.id,
          chunk_text: chunk,
          embedding: `[${embedding.join(",")}]`
        });
      }

      if (chunkInserts.length > 0) {
        const { error: chunkError } = await supabaseAdmin
          .from("document_chunks")
          .insert(chunkInserts);
        if (chunkError) {
          console.error("[Upload] Error saving chunks to DB:", chunkError);
        } else {
          console.log(`[Upload] Successfully saved ${chunkInserts.length} vector chunks.`);
        }
      }
    }

    fs.unlinkSync(file.path);
    res.status(201).json({ document: data[0] });
  } catch (err) {
    console.error("[Document-Upload-Error]:", err);
    res.status(500).json({ error: err.message || "Failed to upload document" });
  }
});

// GET /documents/:id/download
router.get("/:id/download", async (req, res) => {
  try {
    const { data: doc } = await supabaseAdmin.from("documents")
      .select("storage_path, name").eq("id", req.params.id).eq("user_id", req.user.id).single();
    
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const { data, error } = await supabaseAdmin.storage
      .from("Document")
      .createSignedUrl(doc.storage_path, 60); // 60 seconds link

    if (error) throw error;
    res.json({ downloadUrl: data.signedUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to get download link" });
  }
});

// DELETE /documents/:id
router.delete("/:id", async (req, res) => {
  try {
    const { data: doc } = await supabaseAdmin.from("documents")
      .select("storage_path").eq("id", req.params.id).eq("user_id", req.user.id).single();
    if (!doc) return res.status(404).json({ error: "Document not found" });
    await supabaseAdmin.storage.from("Document").remove([doc.storage_path]);
    await supabaseAdmin.from("documents").delete().eq("id", req.params.id);
    res.json({ message: "Document deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// POST /documents/transcribe - Whisper STT
router.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio file" });
    const result = await whisperService.transcribeAudio(req.file.path, req.body.language || "en");
    fs.unlinkSync(req.file.path);
    res.json({ transcription: result.text, duration: result.duration });
  } catch (err) {
    res.status(500).json({ error: "Failed to transcribe audio" });
  }
});

// POST /documents/tts - ElevenLabs TTS
router.post("/tts", async (req, res) => {
  try {
    const { text, voice_id } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    const audioBuffer = await elevenlabsService.textToSpeech(text, voice_id);
    res.set({ "Content-Type": "audio/mpeg", "Content-Length": audioBuffer.length });
    res.send(audioBuffer);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate speech" });
  }
});

// GET /documents/voices - ElevenLabs voices
router.get("/voices", async (req, res) => {
  try {
    const voices = await elevenlabsService.getVoices();
    res.json({ voices });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch voices" });
  }
});

module.exports = router;
