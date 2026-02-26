import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface NarrationEntry {
  text: string;
  offsetMs: number;
  durationMs: number;
}

const narrationLog: NarrationEntry[] = [];
let startTime = 0;

// Natural speech pace: ~150 words/min ≈ 400ms per word.
// This matches edge-tts "en-US-GuyNeural" at default rate.
const MS_PER_WORD = 400;

export function initNarration() {
  narrationLog.length = 0;
  startTime = Date.now();
}

/**
 * Logs the narration timestamp and waits for a realistic speech duration
 * so the video pacing matches the edge-tts audio generated later.
 * Browser TTS is skipped entirely — it's unreliable across platforms
 * and its pacing doesn't match the final audio.
 */
export async function narrate(page: Page, text: string): Promise<void> {
  const offsetMs = Date.now() - startTime;

  // Wait for realistic speech duration so video has proper pacing
  const wordCount = text.split(/\s+/).length;
  const durationMs = Math.max(wordCount * MS_PER_WORD, 800);

  await page.waitForTimeout(durationMs);

  narrationLog.push({ text, offsetMs, durationMs });
}

/**
 * Logs narration, waits for speech duration, then pauses extra.
 */
export async function narrateAndPause(
  page: Page,
  text: string,
  pauseMs: number
): Promise<void> {
  await narrate(page, text);
  await page.waitForTimeout(pauseMs);
}

/**
 * Saves the narration timestamps log to demo-output/narration.json.
 */
export function saveNarrationLog() {
  const outputDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'demo-output'
  );
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(outputDir, 'narration.json'),
    JSON.stringify(narrationLog, null, 2)
  );
}
