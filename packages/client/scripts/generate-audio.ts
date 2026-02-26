import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync, execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface NarrationEntry {
  text: string;
  offsetMs: number;
  durationMs: number;
}

const OUTPUT_DIR = path.resolve(__dirname, '..', '..', '..', 'demo-output');
const NARRATION_FILE = path.join(OUTPUT_DIR, 'narration.json');
const VIDEO_FILE = path.join(OUTPUT_DIR, 'personalkanban-demo.webm');
const AUDIO_DIR = path.join(OUTPUT_DIR, 'audio-segments');
const FINAL_OUTPUT = path.join(OUTPUT_DIR, 'personalkanban-demo.mp4');

const VOICE = 'en-US-GuyNeural';

function getAudioDuration(filePath: string): number {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: 'utf-8' }
    );
    return parseFloat(result.trim()) || 0;
  } catch {
    return 0;
  }
}

async function main() {
  if (!fs.existsSync(NARRATION_FILE)) {
    console.error('narration.json not found. Run `npm run demo` first.');
    process.exit(1);
  }
  if (!fs.existsSync(VIDEO_FILE)) {
    console.error('personalkanban-demo.webm not found. Run `npm run demo` first.');
    process.exit(1);
  }

  try { execSync('ffmpeg -version', { stdio: 'ignore' }); } catch {
    console.error('ffmpeg not found on PATH. Install: winget install ffmpeg');
    process.exit(1);
  }
  try { execSync('edge-tts --version', { stdio: 'ignore' }); } catch {
    console.error('edge-tts not found. Install: pip install edge-tts');
    process.exit(1);
  }

  const narrations: NarrationEntry[] = JSON.parse(
    fs.readFileSync(NARRATION_FILE, 'utf-8')
  );

  if (narrations.length === 0) {
    console.error('No narration entries found.');
    process.exit(1);
  }

  if (fs.existsSync(AUDIO_DIR)) fs.rmSync(AUDIO_DIR, { recursive: true });
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  // Get video duration
  let videoDurationSec = 300;
  try {
    const probeResult = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${VIDEO_FILE}"`,
      { encoding: 'utf-8' }
    );
    videoDurationSec = parseFloat(probeResult.trim()) || 300;
  } catch { /* use fallback */ }

  console.log(`Video duration: ${videoDurationSec.toFixed(1)}s`);
  console.log(`Generating ${narrations.length} audio segments with edge-tts...\n`);

  // Step 1: Generate TTS audio for each segment
  for (let i = 0; i < narrations.length; i++) {
    const entry = narrations[i];
    const segmentFile = path.join(AUDIO_DIR, `segment-${String(i).padStart(3, '0')}.mp3`);
    const preview = entry.text.length > 55 ? entry.text.substring(0, 55) + '...' : entry.text;
    console.log(`  [${i + 1}/${narrations.length}] "${preview}"`);

    execFileSync('edge-tts', [
      '--voice', VOICE,
      '--text', entry.text,
      '--write-media', segmentFile,
    ], { stdio: 'pipe' });
  }

  // Step 2: Build a sequential audio track by concatenating
  //   [silence gap] [segment] [silence gap] [segment] ...
  // Each segment is placed at its offsetMs timestamp.
  // If a segment is longer than the gap to the next one, it gets trimmed.

  console.log('\nBuilding audio timeline...');

  const concatParts: string[] = [];
  let cursor = 0; // current position in ms

  for (let i = 0; i < narrations.length; i++) {
    const entry = narrations[i];
    const segmentFile = path.join(AUDIO_DIR, `segment-${String(i).padStart(3, '0')}.mp3`);
    const segDuration = getAudioDuration(segmentFile) * 1000; // ms

    // Calculate max allowed duration: gap to next segment (or end of video)
    const nextOffsetMs = i < narrations.length - 1
      ? narrations[i + 1].offsetMs
      : videoDurationSec * 1000;
    const maxDurationMs = nextOffsetMs - entry.offsetMs;

    // Trim segment if it exceeds its time window (leave 150ms buffer for breathing room)
    const trimmedDuration = Math.min(segDuration, Math.max(maxDurationMs - 150, 500));
    const trimmedFile = path.join(AUDIO_DIR, `trimmed-${String(i).padStart(3, '0')}.wav`);

    execFileSync('ffmpeg', [
      '-y', '-i', segmentFile,
      '-t', (trimmedDuration / 1000).toFixed(3),
      '-ar', '44100', '-ac', '2',
      trimmedFile,
    ], { stdio: 'pipe' });

    // Insert silence from cursor to this segment's offset
    const silenceMs = entry.offsetMs - cursor;
    if (silenceMs > 0) {
      const silenceFile = path.join(AUDIO_DIR, `silence-${String(i).padStart(3, '0')}.wav`);
      execFileSync('ffmpeg', [
        '-y', '-f', 'lavfi',
        '-i', `anullsrc=r=44100:cl=stereo`,
        '-t', (silenceMs / 1000).toFixed(3),
        silenceFile,
      ], { stdio: 'pipe' });
      concatParts.push(silenceFile);
    }

    concatParts.push(trimmedFile);
    cursor = entry.offsetMs + trimmedDuration;
  }

  // Pad silence to match video duration
  const remainingMs = (videoDurationSec * 1000) - cursor;
  if (remainingMs > 100) {
    const tailSilence = path.join(AUDIO_DIR, 'silence-tail.wav');
    execFileSync('ffmpeg', [
      '-y', '-f', 'lavfi',
      '-i', 'anullsrc=r=44100:cl=stereo',
      '-t', (remainingMs / 1000).toFixed(3),
      tailSilence,
    ], { stdio: 'pipe' });
    concatParts.push(tailSilence);
  }

  // Step 3: Concatenate all parts into one audio file
  const concatList = path.join(AUDIO_DIR, 'concat.txt');
  const concatContent = concatParts.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(concatList, concatContent);

  const mixedAudio = path.join(AUDIO_DIR, 'mixed-audio.wav');

  console.log('Concatenating audio segments...');
  execFileSync('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0',
    '-i', concatList,
    '-c', 'copy',
    mixedAudio,
  ], { stdio: 'pipe' });

  // Step 4: Merge video + audio into final MP4
  console.log('Merging video and audio (re-encoding VP8 → H.264)...');
  execFileSync('ffmpeg', [
    '-y',
    '-i', VIDEO_FILE,
    '-i', mixedAudio,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    FINAL_OUTPUT,
  ], { stdio: 'pipe', timeout: 300_000 });

  // Clean up
  fs.rmSync(AUDIO_DIR, { recursive: true });

  const sizeMB = (fs.statSync(FINAL_OUTPUT).size / (1024 * 1024)).toFixed(1);
  console.log(`\nDone! Output: ${FINAL_OUTPUT} (${sizeMB} MB)`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
