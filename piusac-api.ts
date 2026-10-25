import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import path from 'node:path';

const allowed = new Set(['.txt', '.md', '.csv', '.docx', '.pdf', '.xlsx']);
const MAX_TEXT = 100000;
export async function extract(file: { originalname: string; buffer: Buffer }): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.has(ext)) throw new Error('Supported files: DOCX, PDF, CSV, XLSX, TXT and MD. Convert older DOC/XLS files first.');
  let text = '';
  if (['.txt', '.md', '.csv'].includes(ext)) text = file.buffer.toString('utf8');
  if (ext === '.docx') text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
  if (ext === '.xlsx') {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(file.buffer as any);
    for (const sheet of book.worksheets) {
      text += `\nWorksheet: ${sheet.name}\n`;
      sheet.eachRow(row => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, cell => cells.push(cell.text));
        text += cells.join('\t') + '\n';
        if (text.length > MAX_TEXT) throw new Error('Spreadsheet is too large. Upload a smaller process-specific extract.');
      });
    }
  }
  if (ext === '.pdf') {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: new Uint8Array(file.buffer), useSystemFonts: true });
    try {
      const doc = await task.promise;
      if (doc.numPages > 100) throw new Error('PDF exceeds 100 pages. Upload a smaller extract.');
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += `\nPage ${i}\n` + content.items.map(item => 'str' in item ? item.str : '').join(' ') + '\n';
        if (text.length > MAX_TEXT) throw new Error('PDF text is too long. Upload a smaller extract.');
      }
      if (!text.replace(/Page \d+/g, '').trim()) throw new Error('This PDF has no selectable text. Run OCR or upload a text/Word version.');
    } finally { await task.destroy(); }
  }
  if (!text.trim()) throw new Error('The attachment contains no readable text.');
  if (text.length > MAX_TEXT) throw new Error('Attachment text is too long. Upload a smaller extract.');
  return text;
}

export const piusacRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 3, fields: 2, fieldSize: 400000, parts: 5 },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(path.extname(file.originalname).toLowerCase())) cb(new Error('Unsupported file. Use DOCX, PDF, CSV, XLSX or TXT.'));
    else cb(null, true);
  } });

piusacRouter.post('/chat', (req, res) => {
  upload.array('files', 3)(req, res, async uploadError => {
    if (uploadError) { res.status(400).json({ error: uploadError.message }); return; }
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const sessionId = req.body?.sessionId;
    if (typeof sessionId !== 'string' || !/^[\w-]{10,100}$/.test(sessionId)) { res.status(400).json({ error: 'Invalid chat session. Reload the page.' }); return; }
    const files = (req.files || []) as Express.Multer.File[];
    if ((!message && !files.length) || message.length > MAX_TEXT) { res.status(400).json({ error: 'Enter process text or attach a file (maximum 100,000 characters).' }); return; }
    const endpoint = process.env.N8N_CHAT_URL;
    if (!endpoint) { res.status(503).json({ error: 'Set N8N_CHAT_URL in the server .env file to your published n8n Chat URL, then restart npm run dev.' }); return; }
    let chatInput = message;
    try {
      for (const file of files) chatInput += `\n\n--- Reference document: ${file.originalname} ---\n${await extract(file)}\n--- End reference document ---`;
      if (chatInput.length > MAX_TEXT) throw new Error('Combined text exceeds 100,000 characters. Send a smaller extract.');
    } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : 'Unable to read attachment.' }); return; }
    try {
      const upstream = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendMessage', sessionId, chatInput }), signal: AbortSignal.timeout(240000) });
      if (!upstream.ok) { res.status(502).json({ error: `n8n returned HTTP ${upstream.status}. Check the workflow execution and published Chat URL.` }); return; }
      const raw = await upstream.json();
      const data = Array.isArray(raw) ? raw[0] : raw;
      const output = data?.output ?? data?.text;
      if (typeof output !== 'string' || !output.trim()) throw new Error('Unexpected n8n response');
      res.json({ output: output.replace(/PROCESS_FLOW_READY:\s*(true|false)/gi, '').trim(), html: typeof data.html === 'string' ? data.html : undefined });
    } catch (e) {
      res.status(502).json({ error: e instanceof Error && /timeout|abort/i.test(e.name)
        ? 'The workflow timed out. Check n8n Executions before retrying; it may still be running.'
        : 'Could not read a valid n8n reply. Check the Chat URL, workflow activation and execution errors.' });
    }
  });
});
