import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { resetTestData } from './helpers/auth';
import {
  initNarration,
  narrate,
  narrateAndPause,
  saveNarrationLog,
} from './helpers/narrate';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function injectTranscript(page: import('@playwright/test').Page, transcript: string) {
  await page.evaluate((t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__testInjectTranscript(t);
  }, transcript);
}

// ── Main Demo ────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.resolve(__dirname, '..', '..', '..', 'demo-output');
const SAMPLE_CSV = path.join(OUTPUT_DIR, 'sample-import.csv');

test('PersonalKanban demo — voice, import/export, summary', async ({ page }) => {
  initNarration();
  await resetTestData(page);

  // ══════════════════════════════════════════════════════════════════════════
  // INTRO: Welcome & Registration
  // ══════════════════════════════════════════════════════════════════════════

  await page.goto('/login');
  await page.waitForTimeout(600);

  await narrateAndPause(
    page,
    'Welcome to Personal Kanban — a task board you can control with your voice. In this demo we\'ll walk through voice dictation, CSV import and export, and a spoken board summary.',
    800
  );

  // Navigate to registration
  await narrate(
    page,
    'Let\'s start by creating an account.'
  );
  await page.goto('/register');
  await page.waitForTimeout(500);

  // Fill registration form with visible typing
  await page.fill('input[type="text"]', 'Sarah Mitchell');
  await page.waitForTimeout(400);
  await page.fill('input[type="email"]', `sarah-${Date.now()}@acmecorp.com`);
  await page.waitForTimeout(400);
  await page.fill('input[type="password"]', 'password123');
  await page.waitForTimeout(400);

  await narrate(
    page,
    'Enter a name, email, and password — then click Create Account.'
  );

  await page.click('.auth-card__submit');
  await page.waitForURL('/');
  await page.waitForTimeout(800);

  await narrateAndPause(
    page,
    'We\'re in. Personal Kanban creates a default board. Now let\'s put it to work.',
    1000
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ACT 1: VOICE DICTATION
  // ══════════════════════════════════════════════════════════════════════════

  await narrateAndPause(
    page,
    'First — voice dictation. Click Dictate and speak your task.',
    600
  );

  // Card 1 — narrate the dictation, then inject it
  await narrate(
    page,
    'Send quarterly invoice to Acme Corp. Description: include updated rate sheet and net-30 terms. Priority urgent. Due Friday. Tags: billing, clients.'
  );

  await injectTranscript(
    page,
    'Send quarterly invoice to Acme Corp description include updated rate sheet and net 30 terms priority urgent due Friday tags billing, clients'
  );
  await page.waitForSelector('.modal');
  await page.waitForTimeout(1200);

  await narrate(
    page,
    'Every field parsed and pre-filled from that one sentence. Click Add Card.'
  );

  await page.click('.modal__btn--save');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForTimeout(600);

  // Card 2 — narrate the dictation, then inject it
  await narrate(
    page,
    'Reorder packaging supplies. Description: running low on branded boxes and shipping labels. Priority high. Due tomorrow. Tags: inventory, operations.'
  );

  await injectTranscript(
    page,
    'Reorder packaging supplies description running low on branded boxes and shipping labels priority high due tomorrow tags inventory, operations'
  );
  await page.waitForSelector('.modal');
  await page.waitForTimeout(800);
  await page.click('.modal__btn--save');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForTimeout(500);

  // Card 3 — narrate the dictation, then inject it
  await narrate(
    page,
    'Update social media posts for spring promotion. Priority medium. Due next Monday. Tags: marketing, social.'
  );

  await injectTranscript(
    page,
    'Update social media posts for spring promotion priority medium due next Monday tags marketing, social'
  );
  await page.waitForSelector('.modal');
  await page.waitForTimeout(800);
  await page.click('.modal__btn--save');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForTimeout(600);

  await narrateAndPause(
    page,
    'Three tasks from voice. You can also move cards by speaking.',
    600
  );

  // Move card — narrate the command, then inject it
  await narrate(
    page,
    'Move Send quarterly invoice to In Progress.'
  );

  await injectTranscript(page, 'move send quarterly invoice to in progress');
  await page.waitForTimeout(1500);

  const inProgressCol = page.locator('.column').nth(2);
  await expect(
    inProgressCol.locator('.kanban-card__title', { hasText: 'Send quarterly invoice' })
  ).toBeVisible({ timeout: 5000 });

  await narrateAndPause(
    page,
    'Moved instantly. Fuzzy matching means you don\'t need the exact title — just speak naturally.',
    1200
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ACT 2: IMPORT / EXPORT
  // ══════════════════════════════════════════════════════════════════════════

  await narrateAndPause(
    page,
    'Next — import and export. Let\'s export this board to CSV.',
    600
  );

  // Export — click the button
  const downloadPromise = page.waitForEvent('download');
  await page.click('button:has-text("Export")');
  const download = await downloadPromise;
  const csvPath = path.join(OUTPUT_DIR, 'exported-board.csv');
  await download.saveAs(csvPath);
  await page.waitForTimeout(400);

  // Read the CSV and display it as a styled table in the browser
  const csvContent = fs.readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '');
  const csvLines = csvContent.trim().split(/\r?\n/);
  const headers = csvLines[0].split(',');
  const dataRows = csvLines.slice(1).map((line) => {
    // Simple CSV parse (our export uses quoted fields)
    const fields: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let val = '';
        i++;
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
          else if (line[i] === '"') { i++; break; }
          else { val += line[i]; i++; }
        }
        if (line[i] === ',') i++;
        fields.push(val);
      } else {
        const next = line.indexOf(',', i);
        if (next === -1) { fields.push(line.slice(i)); break; }
        fields.push(line.slice(i, next));
        i = next + 1;
      }
    }
    return fields;
  });

  const tableHtml = `
    <html>
    <head><style>
      body { background: #1a1a2e; color: #e0e0f0; font-family: 'Segoe UI', sans-serif; padding: 40px; }
      h2 { color: #78b4ff; margin-bottom: 20px; }
      table { border-collapse: collapse; width: 100%; font-size: 14px; }
      th { background: #2a2a3e; color: #64dca0; padding: 10px 14px; text-align: left; border-bottom: 2px solid #3a3a5e; }
      td { padding: 8px 14px; border-bottom: 1px solid #2a2a3e; }
      tr:hover { background: #22223a; }
    </style></head>
    <body>
      <h2>kanban-board-export.csv</h2>
      <table>
        <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
        ${dataRows.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n')}
      </table>
    </body></html>
  `;
  await page.setContent(tableHtml);
  await page.waitForTimeout(800);

  await narrateAndPause(
    page,
    'One click and your board exports as a CSV. Here it is — title, description, column, priority, and tags. Open it in Excel or Google Sheets, share with your team, or use as a weekly report.',
    1000
  );

  // Navigate back to the app
  await page.goto('/');
  await page.waitForTimeout(1200);

  // Import — use the sample CSV with different tasks
  await narrate(
    page,
    'Now let\'s import a different set of tasks. Click Import and select a CSV file.'
  );
  await page.waitForTimeout(400);

  await page.click('button:has-text("Import")');
  await page.waitForTimeout(600);

  const fileInput = page.locator('input[type="file"][accept=".csv"]');
  await fileInput.setInputFiles(SAMPLE_CSV);
  await page.waitForTimeout(3000);

  const importedItem = page.locator('.sidebar__item', { hasText: 'Imported Board' });
  await expect(importedItem).toBeVisible({ timeout: 15000 });
  await importedItem.click();
  await page.waitForTimeout(1500);

  await narrateAndPause(
    page,
    'A new board appears with five different tasks — payroll, staff meetings, backups, customer feedback, and office supplies. All imported in one click from a spreadsheet.',
    1200
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ACT 3: BOARD SUMMARY (VOICE READOUT)
  // ══════════════════════════════════════════════════════════════════════════

  // Switch back to My Board to show the cards we created
  await page.locator('.sidebar__item', { hasText: 'My Board' }).click();
  await page.waitForTimeout(800);

  await narrateAndPause(
    page,
    'Finally — board summary. Click Listen and the app reads your board aloud.',
    600
  );

  // Click Listen — browser TTS won't be captured in the video recording,
  // so we narrate the readout text ourselves.
  await page.click('button:has-text("Listen")');
  await page.waitForTimeout(1000);

  // Narrate what the app is reading aloud (matching the useVoiceReadout format)
  await narrate(
    page,
    'Backlog is empty. In To Do: Reorder packaging supplies, Update social media posts for spring promotion. In In Progress: Send quarterly invoice to Acme Corp. Done is empty.'
  );
  await page.waitForTimeout(500);

  // Click Stop
  await page.click('button:has-text("Stop")');
  await page.waitForTimeout(600);

  await narrateAndPause(
    page,
    'A hands-free overview — column by column, card by card. Start your morning with a voice summary, then dictate new tasks without touching the keyboard.',
    1200
  );

  // ── Closing ──
  await narrateAndPause(
    page,
    'That\'s Personal Kanban — dictate tasks, bulk-manage with CSV, and hear your board read back to you. Works on desktop, tablet, and mobile. All powered by browser-native APIs. Thanks for watching!',
    1500
  );

  // Save narration log for audio generation
  saveNarrationLog();

  // Save video
  const video = page.video();
  if (video) {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    await page.close();
    await video.saveAs(path.join(OUTPUT_DIR, 'personalkanban-demo.webm'));
  }
});
