import { NextApiRequest, NextApiResponse } from "next";
import { promisify } from "util";
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";
import { toWav } from "audiobuffer-to-wav";
import multer from "multer";

const upload = multer();

const writeFileAsync = promisify(fs.writeFile);

export default async function handler(
  req: NextApiRequest & { file: Express.Multer.File },
  res: NextApiResponse
) {
  const formData = new FormData();
  formData.append("model", "whisper-1");

  // Convert audio blob to WAV file
  const audioBlob = req.file.buffer;

  const arrayBuffer = await Blob.prototype.arrayBuffer.call(audioBlob);
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const wav = toWav(audioBuffer);

  await writeFileAsync("audio.wav", Buffer.from(wav), { encoding: "binary" });
  const wavFile = fs.createReadStream("audio.wav");
  formData.append("file", wavFile);

  // Send request to OpenAI Whisper API
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (response.ok) {
    const data = await response.json();
    res.status(200).json({ text: data.text });
  } else {
    res.status(response.status).json({ error: "Failed to transcribe audio" });
  }

  // Delete temporary WAV file
  fs.unlinkSync("audio.wav");
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export const multerUpload = upload.single("audio");
