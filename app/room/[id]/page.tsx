"use client";
import { useState, useEffect, useRef } from 'react';

// Module-level pending queue (per CONTEXT.md hardened pattern)
const pendingMsgs: string[] = [];

export default function Room({ params }: { params: { id: string } }) {
  const [embeddings, setEmbeddings] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [source, setSource] = useState('manual');
  const [query, setQuery] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number>(0);

  useEffect(() => {
    // Set html[data-hydrated] after first successful poll (per CONTEXT.md)
    const markHydrated = () => {
      setHydrated(true);
      if (typeof document !== 'undefined') document.documentElement.setAttribute('data-hydrated', '1');
    };

    const connect = () => {
      const ws = new WebSocket(`wss://embeddingroom.devdynamo713.workers.dev/room/${params.id}/ws`);
      ws.onopen = () => {
        reconnectRef.current = 0;
        // Flush pending messages (per CONTEXT.md)
        while (pendingMsgs.length > 0) {
          const msg = pendingMsgs.shift();
          if (msg) ws.send(msg);
        }
      };
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'embedding') setEmbeddings(prev => [...prev, data.data]);
      };
      ws.onclose = () => { setTimeout(connect, Math.min(1000 * 2 ** reconnectRef.current++, 30000)); };
      wsRef.current = ws;
    };
    connect();

    // Poll GET /room/<id>/embeddings every 3s (per CONTEXT.md)
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`https://embeddingroom.devdynamo713.workers.dev/room/${params.id}/embeddings`);
        if (res.ok) {
          setEmbeddings(await res.json());
          markHydrated();
        }
      } catch {}
    }, 3000);

    return () => { wsRef.current?.close(); clearInterval(poll); };
  }, [params.id]);

  // send() helper: pushes to pendingMsgs if ws not OPEN (per CONTEXT.md)
  const send = (msg: string) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(msg);
    } else {
      pendingMsgs.push(msg);
    }
  };

  const addEmbedding = async () => {
    const data = { text, source };
    await fetch(`https://embeddingroom.devdynamo713.workers.dev/room/${params.id}/embedding`, { method: 'POST', body: JSON.stringify(data) });
    setText('');
  };

  const doSearch = async () => {
    const res = await fetch(`https://embeddingroom.devdynamo713.workers.dev/room/${params.id}/search`, { method: 'POST', body: JSON.stringify({ query, topK: 5 }) });
    if (res.ok) { const data = await res.json(); setResults(data.results); }
  };

  // Buttons disabled until first state (per CONTEXT.md)
  const btnDisabled = !hydrated;

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', background: '#0a0a0a', color: '#e5e5e5', minHeight: '100vh' }}>
      <h1>EmbeddingRoom: {params.id}</h1>
      <div style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={{ padding: 16, border: '1px solid #27272a', borderRadius: 12, background: '#09090b' }}>
          <div style={{ color: '#a1a1aa', fontSize: 13 }}>Embeddings</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#4ade80' }}>{embeddings.length}</div>
        </div>
        <div style={{ padding: 16, border: '1px solid #27272a', borderRadius: 12, background: '#09090b' }}>
          <div style={{ color: '#a1a1aa', fontSize: 13 }}>Vector Dim</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#60a5fa' }}>128</div>
        </div>
      </div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="text to embed" className="text-input" style={{ padding: 8, background: '#111111', border: '1px solid #3f3f46', borderRadius: 6, color: '#fafafa', flex: 1 }} />
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="source" className="source-input" style={{ padding: 8, background: '#111111', border: '1px solid #3f3f46', borderRadius: 6, color: '#fafafa', width: 100 }} />
        <button className="add-btn" onClick={addEmbedding} disabled={btnDisabled || !text.trim()} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Add Embedding</button>
      </div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search query" className="query-input" style={{ padding: 8, background: '#111111', border: '1px solid #3f3f46', borderRadius: 6, color: '#fafafa', flex: 1 }} />
        <button className="search-btn" onClick={doSearch} disabled={btnDisabled || !query.trim()} style={{ padding: '8px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Search</button>
      </div>
      {results.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Top Matches</h2>
          <div className="results-list" style={{ display: 'grid', gap: 8 }}>
            {results.map((r, i) => (
              <div key={r.embedding.id} style={{ padding: 12, border: '1px solid #7c3aed', borderRadius: 8, background: '#09090b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ color: '#a78bfa' }}>#{i + 1}: {r.embedding.text.substring(0, 60)}</strong>
                  <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{(r.similarity * 100).toFixed(1)}%</span>
                </div>
                <div style={{ fontSize: 12, color: '#a1a1aa' }}>Source: {r.embedding.source}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>All Embeddings</h2>
        <div className="embedding-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {embeddings.map(e => (
            <div key={e.id} style={{ padding: 12, border: '1px solid #27272a', borderRadius: 8, background: '#09090b' }}>
              <strong style={{ color: '#60a5fa' }}>{e.text.substring(0, 40)}</strong>
              <div style={{ fontSize: 12, color: '#a1a1aa' }}>{e.source} | dim:{e.vector.length}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}