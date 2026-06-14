import { useState, useRef, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:8000";

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconUpload = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const IconSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const IconFile = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const IconSpinner = () => (
  <svg className="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);
const IconBot = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><line x1="12" y1="7" x2="12" y2="3"/><line x1="8" y1="15" x2="8" y2="15"/><line x1="16" y1="15" x2="16" y2="15"/>
  </svg>
);
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const IconChevron = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IconShield = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

// ─── Source Card ──────────────────────────────────────────────────────────────
function SourceCard({ source }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="source-card" onClick={() => setOpen(!open)}>
      <div className="source-header">
        <span className="source-badge">Source {source.index}</span>
        {source.page !== "N/A" && <span className="source-page">Page {source.page}</span>}
        <IconChevron open={open} />
      </div>
      {open && <p className="source-excerpt">{source.excerpt}</p>}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const [showSources, setShowSources] = useState(false);
  const isBot = msg.role === "assistant";

  return (
    <div className={`msg-row ${isBot ? "msg-bot" : "msg-user"}`}>
      <div className={`msg-avatar ${isBot ? "avatar-bot" : "avatar-user"}`}>
        {isBot ? <IconBot /> : <IconUser />}
      </div>
      <div className="msg-body">
        <div className={`msg-bubble ${isBot ? "bubble-bot" : "bubble-user"}`}>
          {msg.content.split("\n").map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))}
        </div>
        {isBot && msg.sources && msg.sources.length > 0 && (
          <div className="sources-section">
            <button className="sources-toggle" onClick={() => setShowSources(!showSources)}>
              <IconFile /> {msg.sources.length} source{msg.sources.length > 1 ? "s" : ""} used
              <IconChevron open={showSources} />
            </button>
            {showSources && (
              <div className="sources-list">
                {msg.sources.map((s, i) => <SourceCard key={i} source={s} />)}
              </div>
            )}
          </div>
        )}
        {msg.processingTime && (
          <span className="msg-time">⚡ {msg.processingTime}ms</span>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // api_key state REMOVED — key is stored server-side only
  const [sessionId, setSessionId] = useState(null);
  const [docInfo, setDocInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [topK, setTopK] = useState(3);

  const fileRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, querying]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "txt"].includes(ext)) {
      setUploadError("Only PDF, DOCX, and TXT files are supported.");
      return;
    }

    setUploadError("");
    setUploading(true);
    setMessages([]);
    setSessionId(null);
    setDocInfo(null);

    const form = new FormData();
    form.append("file", file);
    // api_key is NOT appended — it's handled entirely by the backend

    try {
      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");

      setSessionId(data.session_id);
      setDocInfo({ filename: data.filename, chunks: data.chunks });
      setMessages([{
        role: "assistant",
        content: `✅ **${data.filename}** indexed successfully!\n\n📊 Split into **${data.chunks} searchable chunks**.\n\nAsk me anything about this document.`,
        sources: [],
      }]);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }, []); // no apiKey dependency

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleQuery = async () => {
    if (!input.trim() || !sessionId || querying) return;

    const question = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setQuerying(true);

    try {
      const res = await fetch(`${API_BASE}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question,
          top_k: topK,
          // api_key is NOT sent — handled server-side
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Query failed");

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        processingTime: data.processing_time_ms,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `❌ Error: ${err.message}`,
        sources: [],
      }]);
    } finally {
      setQuerying(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleReset = async () => {
    if (sessionId) {
      try { await fetch(`${API_BASE}/session/${sessionId}`, { method: "DELETE" }); } catch (_) {}
    }
    setSessionId(null);
    setDocInfo(null);
    setMessages([]);
    setUploadError("");
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #0d0f14;
          --surface: #13161d;
          --surface2: #1a1e28;
          --surface3: #222738;
          --border: #2a2f3e;
          --border-soft: #1f2435;
          --accent: #6c8ef5;
          --accent-dim: #3a4d8f;
          --accent-glow: rgba(108,142,245,0.15);
          --green: #4ade80;
          --green-dim: rgba(74,222,128,0.12);
          --red: #f87171;
          --teal: #2dd4bf;
          --teal-dim: rgba(45,212,191,0.10);
          --text-1: #e8eaf0;
          --text-2: #8890a8;
          --text-3: #555d75;
          --radius: 12px;
          --radius-sm: 8px;
          --font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --mono: 'JetBrains Mono', 'Fira Code', monospace;
        }

        body { font-family: var(--font); background: var(--bg); color: var(--text-1); min-height: 100vh; }

        .layout { display: grid; grid-template-columns: 300px 1fr; height: 100vh; overflow: hidden; }

        /* ── SIDEBAR ── */
        .sidebar {
          background: var(--surface);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sidebar-header {
          padding: 20px;
          border-bottom: 1px solid var(--border-soft);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 4px;
        }

        .logo-mark {
          width: 32px; height: 32px;
          background: linear-gradient(135deg, var(--accent), #a78bfa);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: white;
          letter-spacing: -0.5px;
        }

        .logo-text { font-size: 15px; font-weight: 700; color: var(--text-1); letter-spacing: -0.3px; }
        .logo-sub { font-size: 11px; color: var(--text-3); margin-left: 42px; }

        .sidebar-body {
          flex: 1; overflow-y: auto; padding: 16px;
          display: flex; flex-direction: column; gap: 16px;
        }

        /* ── Secure Badge ── */
        .secure-badge {
          display: flex; align-items: center; gap: 8px;
          background: var(--teal-dim);
          border: 1px solid rgba(45,212,191,0.25);
          border-radius: var(--radius-sm);
          padding: 10px 12px;
        }
        .secure-badge-icon {
          color: var(--teal);
          display: flex; align-items: center; flex-shrink: 0;
        }
        .secure-badge-text { font-size: 11px; line-height: 1.5; }
        .secure-badge-title {
          color: var(--teal);
          font-weight: 700;
          font-size: 11px;
          display: block;
          margin-bottom: 2px;
        }
        .secure-badge-sub { color: var(--text-3); font-size: 10.5px; }

        /* Upload Zone */
        .field-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.8px; color: var(--text-3); margin-bottom: 6px;
          display: flex; align-items: center; gap: 6px;
        }

        .upload-zone {
          border: 1.5px dashed var(--border);
          border-radius: var(--radius);
          padding: 20px 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
        }
        .upload-zone:hover, .upload-zone.drag-over {
          border-color: var(--accent);
          background: var(--accent-glow);
        }
        .upload-zone.uploading { pointer-events: none; opacity: 0.7; }
        .upload-icon { color: var(--accent); margin-bottom: 8px; display: flex; justify-content: center; }
        .upload-title { font-size: 13px; font-weight: 600; color: var(--text-1); margin-bottom: 4px; }
        .upload-sub { font-size: 11px; color: var(--text-3); }
        .upload-types { font-size: 10px; color: var(--accent-dim); margin-top: 6px; font-family: var(--mono); }
        input[type="file"] { display: none; }

        /* Doc Info Card */
        .doc-card {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 12px;
        }
        .doc-name { font-size: 12px; font-weight: 600; color: var(--text-1); word-break: break-all; }
        .doc-status { display: flex; align-items: center; gap: 5px; margin-top: 5px; }
        .dot-green { width: 6px; height: 6px; border-radius: 50%; background: var(--green); flex-shrink: 0; }
        .doc-chunks { font-size: 10px; color: var(--green); background: var(--green-dim); padding: 2px 6px; border-radius: 4px; }

        .btn-reset {
          width: 100%; padding: 9px;
          background: transparent; border: 1px solid var(--border);
          border-radius: var(--radius-sm); color: var(--text-3);
          font-size: 12px; cursor: pointer; display: flex; align-items: center;
          justify-content: center; gap: 6px; transition: all 0.2s;
          margin-top: 6px;
        }
        .btn-reset:hover { border-color: var(--red); color: var(--red); background: rgba(248,113,113,0.05); }

        /* Top-K Selector */
        .topk-row { display: flex; align-items: center; justify-content: space-between; }
        .topk-btns { display: flex; gap: 4px; }
        .topk-btn {
          width: 30px; height: 26px;
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 6px; color: var(--text-2); font-size: 12px;
          cursor: pointer; transition: all 0.15s;
          display: flex; align-items: center; justify-content: center;
        }
        .topk-btn.active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); font-weight: 700; }
        .topk-btn:hover:not(.active) { border-color: var(--text-3); color: var(--text-1); }

        .error-msg {
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.25);
          border-radius: var(--radius-sm);
          padding: 10px 12px;
          font-size: 12px; color: var(--red); line-height: 1.5;
        }

        .divider { height: 1px; background: var(--border-soft); }

        /* ── CHAT AREA ── */
        .chat-area { display: flex; flex-direction: column; overflow: hidden; }

        .chat-topbar {
          padding: 14px 20px;
          border-bottom: 1px solid var(--border-soft);
          background: var(--surface);
          display: flex; align-items: center; justify-content: space-between;
        }
        .chat-title { font-size: 14px; font-weight: 600; color: var(--text-1); }
        .chat-subtitle { font-size: 11px; color: var(--text-3); margin-top: 2px; }

        .status-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 5px 10px; border-radius: 20px;
          font-size: 11px; font-weight: 600;
          background: var(--surface2); border: 1px solid var(--border);
        }
        .status-pill.ready { color: var(--green); border-color: rgba(74,222,128,0.3); background: var(--green-dim); }
        .status-pill.idle { color: var(--text-3); }

        .messages-wrap {
          flex: 1; overflow-y: auto;
          padding: 24px 20px;
          display: flex; flex-direction: column; gap: 20px;
          scroll-behavior: smooth;
        }
        .messages-wrap::-webkit-scrollbar { width: 4px; }
        .messages-wrap::-webkit-scrollbar-track { background: transparent; }
        .messages-wrap::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

        .msg-row { display: flex; gap: 12px; max-width: 800px; }
        .msg-bot { align-self: flex-start; }
        .msg-user { align-self: flex-end; flex-direction: row-reverse; }

        .msg-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 2px;
        }
        .avatar-bot { background: linear-gradient(135deg, var(--accent), #a78bfa); color: white; }
        .avatar-user { background: var(--surface3); color: var(--text-2); }

        .msg-body { display: flex; flex-direction: column; gap: 6px; max-width: calc(100% - 44px); }
        .msg-bubble {
          padding: 12px 16px; border-radius: 14px;
          font-size: 14px; line-height: 1.65;
        }
        .bubble-bot {
          background: var(--surface2); border: 1px solid var(--border);
          color: var(--text-1); border-top-left-radius: 4px;
        }
        .bubble-user {
          background: var(--accent-dim); border: 1px solid var(--accent);
          color: var(--text-1); border-top-right-radius: 4px;
          text-align: right;
        }

        /* Sources */
        .sources-section { display: flex; flex-direction: column; gap: 6px; }
        .sources-toggle {
          display: flex; align-items: center; gap: 6px;
          background: none; border: 1px solid var(--border-soft);
          border-radius: 6px; padding: 5px 10px;
          font-size: 11px; color: var(--text-3); cursor: pointer;
          transition: all 0.15s; width: fit-content;
        }
        .sources-toggle:hover { color: var(--accent); border-color: var(--accent); }
        .sources-list { display: flex; flex-direction: column; gap: 6px; }
        .source-card {
          background: var(--surface); border: 1px solid var(--border-soft);
          border-radius: 8px; padding: 8px 12px; cursor: pointer;
          transition: border-color 0.15s;
        }
        .source-card:hover { border-color: var(--border); }
        .source-header { display: flex; align-items: center; gap: 8px; }
        .source-badge {
          font-size: 10px; font-weight: 700; font-family: var(--mono);
          color: var(--accent); background: rgba(108,142,245,0.1);
          padding: 2px 6px; border-radius: 4px;
        }
        .source-page { font-size: 10px; color: var(--text-3); }
        .source-excerpt { font-size: 11px; color: var(--text-2); margin-top: 6px; line-height: 1.5; font-family: var(--mono); }
        .msg-time { font-size: 10px; color: var(--text-3); }

        /* Typing */
        .typing-row { display: flex; gap: 12px; align-self: flex-start; }
        .typing-bubble {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 14px; border-top-left-radius: 4px;
          padding: 14px 18px;
          display: flex; align-items: center; gap: 4px;
        }
        .typing-dot {
          width: 6px; height: 6px;
          background: var(--text-3); border-radius: 50%;
          animation: typingBounce 1.3s infinite ease-in-out;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.15s; }
        .typing-dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }

        /* Empty State */
        .empty-state {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 12px; color: var(--text-3); text-align: center;
        }
        .empty-icon { font-size: 40px; opacity: 0.4; }
        .empty-title { font-size: 15px; font-weight: 600; color: var(--text-2); }
        .empty-sub { font-size: 13px; max-width: 300px; line-height: 1.6; }

        /* Input Bar */
        .input-bar {
          padding: 16px 20px;
          border-top: 1px solid var(--border-soft);
          background: var(--surface);
          display: flex; gap: 10px; align-items: flex-end;
        }
        .chat-input {
          flex: 1; padding: 12px 16px;
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: var(--radius); color: var(--text-1);
          font-size: 14px; font-family: var(--font);
          resize: none; outline: none; min-height: 46px; max-height: 140px;
          line-height: 1.5; transition: border-color 0.2s;
        }
        .chat-input:focus { border-color: var(--accent); }
        .chat-input::placeholder { color: var(--text-3); }
        .chat-input:disabled { opacity: 0.5; cursor: not-allowed; }

        .send-btn {
          width: 46px; height: 46px;
          background: var(--accent); border: none; border-radius: var(--radius);
          color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.15s;
        }
        .send-btn:hover:not(:disabled) { background: #7da3ff; transform: translateY(-1px); }
        .send-btn:active:not(:disabled) { transform: translateY(0); }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.9s linear infinite; }

        .sidebar-body::-webkit-scrollbar { width: 3px; }
        .sidebar-body::-webkit-scrollbar-track { background: transparent; }
        .sidebar-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

        @media (max-width: 700px) {
          .layout { grid-template-columns: 1fr; }
          .sidebar { display: none; }
        }
      `}</style>

      <div className="layout">
        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="logo">
              <div className="logo-mark">R</div>
              <span className="logo-text">RAG Studio</span>
            </div>
            <div className="logo-sub">Retrieval-Augmented Generation</div>
          </div>

          <div className="sidebar-body">

            {/* ── Secure Server Badge (replaces API key input) ── */}
            <div className="secure-badge">
              <div className="secure-badge-icon"><IconShield /></div>
              <div className="secure-badge-text">
                <span className="secure-badge-title">🔐 Secure Connection</span>
                <span className="secure-badge-sub">
                  API key is stored server-side only.<br />
                  It is never sent to your browser.
                </span>
              </div>
            </div>

            <div className="divider" />

            {/* Upload Zone */}
            {!docInfo ? (
              <div>
                <div className="field-label"><IconFile /> Upload Document</div>
                <div
                  className={`upload-zone ${dragOver ? "drag-over" : ""} ${uploading ? "uploading" : ""}`}
                  onClick={() => !uploading && fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="upload-icon">
                    {uploading ? <IconSpinner /> : <IconUpload />}
                  </div>
                  <div className="upload-title">
                    {uploading ? "Processing document…" : "Drop file here"}
                  </div>
                  <div className="upload-sub">
                    {uploading ? "Building vector index…" : "or click to browse"}
                  </div>
                  <div className="upload-types">PDF · DOCX · TXT</div>
                </div>
                <input
                  type="file"
                  ref={fileRef}
                  accept=".pdf,.docx,.txt"
                  onChange={e => handleFile(e.target.files[0])}
                />
              </div>
            ) : (
              <div>
                <div className="field-label"><IconFile /> Active Document</div>
                <div className="doc-card">
                  <div className="doc-name">{docInfo.filename}</div>
                  <div className="doc-status">
                    <div className="dot-green" />
                    <span className="doc-chunks">{docInfo.chunks} chunks indexed</span>
                  </div>
                </div>
                <button className="btn-reset" onClick={handleReset}>
                  <IconTrash /> Remove &amp; Reset
                </button>
              </div>
            )}

            {uploadError && <div className="error-msg">⚠ {uploadError}</div>}

            <div className="divider" />

            {/* Top-K Control */}
            <div>
              <div className="field-label">Context Chunks (Top-K)</div>
              <div className="topk-row">
                <span style={{ fontSize: "11px", color: "var(--text-3)" }}>Sources retrieved per query</span>
                <div className="topk-btns">
                  {[2, 3, 5].map(k => (
                    <button key={k} className={`topk-btn ${topK === k ? "active" : ""}`} onClick={() => setTopK(k)}>
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </aside>

        {/* ── CHAT AREA ── */}
        <main className="chat-area">
          <div className="chat-topbar">
            <div>
              <div className="chat-title">Document Q&amp;A</div>
              <div className="chat-subtitle">
                {docInfo ? `Chatting with: ${docInfo.filename}` : "No document loaded"}
              </div>
            </div>
            <div className={`status-pill ${docInfo ? "ready" : "idle"}`}>
              {docInfo ? <><div className="dot-green" /> Ready</> : "Idle"}
            </div>
          </div>

          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <div className="empty-title">No document loaded yet</div>
              <div className="empty-sub">
                Upload a PDF, DOCX, or TXT file to begin asking questions.
              </div>
            </div>
          ) : (
            <div className="messages-wrap">
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              {querying && (
                <div className="typing-row">
                  <div className="msg-avatar avatar-bot"><IconBot /></div>
                  <div className="typing-bubble">
                    <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          <div className="input-bar">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder={docInfo ? "Ask anything about your document…" : "Upload a document first…"}
              value={input}
              disabled={!docInfo || querying}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleQuery();
                }
              }}
              rows={1}
            />
            <button
              className="send-btn"
              onClick={handleQuery}
              disabled={!docInfo || !input.trim() || querying}
            >
              {querying ? <IconSpinner /> : <IconSend />}
            </button>
          </div>
        </main>
      </div>
    </>
  );
}