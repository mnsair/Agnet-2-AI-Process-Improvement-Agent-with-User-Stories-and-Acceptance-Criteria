import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Paperclip } from 'lucide-react';

type Turn = { role: 'user' | 'assistant'; text: string; html?: string };
const title = 'Process Improvement with User Stories and Acceptance Criteria (PIUSAC)';

export default function PiusacHome() {
  const [session, setSession] = useState(() => crypto.randomUUID());
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  async function send() {
    if (lock.current || (!text.trim() && !files.length)) return;
    lock.current = true;
    setBusy(true); setError('');
    const body = new FormData();
    body.set('message', text); body.set('sessionId', session);
    files.forEach(file => body.append('files', file));
    const userText = [text, ...files.map(f => `Attached: ${f.name}`)].filter(Boolean).join('\n');
    try {
      const response = await fetch('/api/piusac/chat', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The request failed.');
      setTurns(t => [...t, { role: 'user', text: userText }, { role: 'assistant', text: data.output, html: data.html }]);
      setText(''); setFiles([]);
      if (input.current) input.current.value = '';
      setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to contact the server.');
    } finally { lock.current = false; setBusy(false); }
  }

  function download(html: string) {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'PIUSAC-report.html'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="max-w-5xl mx-auto space-y-6" aria-label="Process improvement chat">
    <div className="flex justify-between items-start gap-4">
      <div><p className="text-sky-300 text-sm mb-2">YOUR PROCESS, UNDERSTOOD AND IMPROVED</p>
        <h1 className="text-2xl sm:text-4xl font-bold leading-tight">{title}</h1>
        <p className="text-slate-300 mt-4">Describe your current process or attach a document. The agent will ask focused questions, then prepare your assessment, process flows, user stories and acceptance criteria.</p></div>
      <button disabled={busy} className="shrink-0 border border-slate-600 rounded-lg p-2 disabled:opacity-50" onClick={() => {
        if (turns.length && !window.confirm('Start a new conversation? This clears the current chat from this page.')) return;
        setTurns([]); setSession(crypto.randomUUID()); setError(''); setText(''); setFiles([]);
        if (input.current) input.current.value = '';
      }}>New chat</button>
    </div>
    <div className="border border-slate-700 rounded-2xl bg-slate-900 overflow-hidden">
      <div className="p-5 space-y-6 max-h-[60vh] overflow-y-auto" role="log" aria-live="polite">
        {!turns.length && <div className="text-slate-300"><strong className="text-white">Tell me how your process works today.</strong><p className="mt-2">Include who starts it, the main steps, who is involved, and where delays or problems occur. You can paste text or attach files below.</p></div>}
        {turns.map((turn, i) => <article key={i} className={turn.role === 'user' ? 'rounded-xl bg-slate-800 p-4' : 'markdown-content'}>
          <p className="text-xs uppercase tracking-wider text-sky-300 mb-2">{turn.role === 'user' ? 'You' : 'Process Improvement AI Agent'}</p>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.text}</ReactMarkdown>
          {turn.html && <div className="mt-4 space-y-3"><button onClick={() => download(turn.html!)} className="rounded-lg bg-sky-400 text-slate-950 px-4 py-2">Download report (HTML)</button>
            <iframe title="Process improvement report with diagrams" sandbox="" referrerPolicy="no-referrer" srcDoc={turn.html} className="w-full h-[600px] bg-white rounded-lg" /></div>}
        </article>)}
        {busy && <p role="status" className="text-sky-300">Analyzing your process and running the workflow… This may take a few minutes.</p>}
        <div ref={end} />
      </div>
      <form className="border-t border-slate-700 p-4 space-y-3" onSubmit={e => { e.preventDefault(); void send(); }}>
        <label htmlFor="piusac-message" className="block font-medium">Your current process or reply</label>
        <textarea id="piusac-message" value={text} disabled={busy} maxLength={100000} onChange={e => setText(e.target.value)} rows={5}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
          placeholder="Type or paste your current process here…" className="w-full bg-slate-950 rounded-xl p-4 border border-slate-600 focus:outline-sky-400" />
        <input ref={input} type="file" multiple disabled={busy} accept=".docx,.pdf,.csv,.xlsx,.txt,.md" aria-label="Attach process documents" className="hidden"
          onChange={e => { const chosen = Array.from(e.target.files || []); if (chosen.length > 3 || chosen.some(f => f.size > 10 * 1024 * 1024)) { setError('Choose up to 3 files, each no larger than 10 MB.'); e.target.value = ''; setFiles([]); return; } setFiles(chosen); setError(''); }} />
        <div className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-sky-400 bg-sky-950/60 p-4">
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-300 px-5 py-3 font-bold text-slate-950 shadow-lg hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-200 disabled:opacity-50 cursor-pointer">
            <Paperclip className="h-5 w-5" aria-hidden="true" /> Attach files
          </button>
          <div><p className="font-semibold text-white">Choose documents from your computer</p>
            <p className="text-sm text-sky-200" aria-live="polite">{files.length ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : 'Word, PDF, Excel, CSV or text · Up to 3 files'}</p></div>
        </div>
        {files.map((f, i) => <div key={i} className="text-sm text-slate-300">{f.name} <button type="button" disabled={busy} onClick={() => setFiles(fs => fs.filter((_, n) => n !== i))} aria-label={`Remove ${f.name}`}>× Remove</button></div>)}
        <p className="text-xs text-slate-400">Word (.docx), PDF with selectable text, CSV, Excel (.xlsx), or text. Up to 3 files, 10 MB each. Enter sends; Shift+Enter adds a line. Files are sent for analysis only when you press Send. Chat lasts for this page session.</p>
        {error && <p role="alert" className="text-red-300">{error}</p>}
        <button disabled={busy || (!text.trim() && !files.length)} className="bg-sky-400 text-slate-950 font-bold px-6 py-3 rounded-xl disabled:opacity-40">{busy ? 'Working…' : 'Send process'}</button>
      </form>
    </div>
  </section>;
}
