import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  Bot, Send, Download, Trash2, Cpu, Activity, 
  MessageSquare, Settings, AlertCircle, CheckCircle, 
  RefreshCw, Terminal, Info, X 
} from 'lucide-react';

const SUGGESTED_MODELS = [
  { id: 'qwen2.5:1.5b', name: 'Qwen 2.5 (1.5B)', size: '1.0 GB', desc: 'Lightweight, ideal for servers with low RAM (<4GB).' },
  { id: 'qwen2.5:7b', name: 'Qwen 2.5 (7B)', size: '4.7 GB', desc: 'Balanced, great for general use.' },
  { id: 'llama3.1:8b', name: 'Llama 3.1 (8B)', size: '4.7 GB', desc: 'Advanced, the most powerful from Meta.' },
  { id: 'mistral:latest', name: 'Mistral (7B)', size: '4.1 GB', desc: 'Reliable, fast and precise.' },
  { id: 'codegemma:2b', name: 'CodeGemma (2B)', size: '1.7 GB', desc: 'Specialized for software development.' },
  { id: 'phi3:mini', name: 'Phi-3 Mini', size: '2.3 GB', desc: 'Incredibly compact yet intelligent.' },
];

export default function AIManager() {
  const { data: status, loading: statusLoading, error: statusError, refetch: refetchStatus } = useApi('/ai/status');
  const { data: modelsData, loading: modelsLoading, refetch: refetchModels } = useApi('/ai/models');
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [pullModel, setPullModel] = useState(SUGGESTED_MODELS[0].id);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelName, setCustomModelName] = useState('');
  const [pulling, setPulling] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState(null);

  const chatEndRef = useRef(null);

  useEffect(() => {
    if (modelsData?.models?.length > 0 && !selectedModel) {
      setSelectedModel(modelsData.models[0].name);
    }
  }, [modelsData]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  useEffect(() => {
    if (selectedModel) {
      const fetchHistory = async () => {
        try {
          const res = await api.get(`/ai/chat/history?model=${selectedModel}`);
          setMessages(res.messages || []);
        } catch (err) {
          console.error("Failed to fetch chat history", err);
        }
      };
      fetchHistory();
    }
  }, [selectedModel]);

  const handlePull = async () => {
    const modelToPull = isCustomModel ? customModelName : pullModel;
    if (!modelToPull) return;
    setPulling(true);
    setError(null);
    try {
      await api.post('/ai/pull', { name: modelToPull });
      refetchModels();
      setCustomModelName('');
      setIsCustomModel(false);
    } catch (err) {
      setError(err.message || "Error downloading model.");
    } finally {
      setPulling(false);
    }
  };

  const handleDelete = async (name) => {
    if (!confirm(`Are you sure you want to delete model ${name}?`)) return;
    try {
      await api.delete('/ai/delete', { data: { name } });
      refetchModels();
      if (selectedModel === name) setSelectedModel('');
    } catch (err) {
      setError(err.message || "Error deleting model.");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedModel || chatLoading) return;
    
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setChatLoading(true);
    
    try {
      const res = await api.post('/ai/chat', {
        model: selectedModel,
        messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      });
      
      setMessages(prev => [...prev, { role: 'assistant', content: res.message.content }]);
    } catch (err) {
      setError(err.message || "Chat error. Is the model loaded correctly?");
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm("Are you sure you want to clear the chat history for this model?")) return;
    try {
      await api.post('/ai/chat/clear', { model: selectedModel });
      setMessages([]);
    } catch (err) {
      setError("Error clearing chat history");
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><Bot size={28} /><h1>AI Manager</h1></div>
        <div className="header-actions">
           <div className={`status-badge ${status?.active ? 'active' : 'offline'}`}>
              {status?.active ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {status?.active ? 'Ollama Online' : 'Ollama Offline'}
           </div>
           <button className="btn btn-ghost" onClick={() => { refetchStatus(); refetchModels(); }}>
              <RefreshCw size={16} />
           </button>
        </div>
      </div>

      {!status?.active && (
        <div className="alert alert-error" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Info size={24} />
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', marginBottom: '4px' }}>
              {status?.message || (statusLoading ? 'Loading status...' : 'Ollama not detected')}
            </strong> 
            {status?.detected_ip ? `Detected IP Address: ${status.detected_ip}` : 'Ensure Ollama engine is installed and active.'}
          </div>
          <Link to="/docker" className="btn btn-sm btn-primary" style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}>
            Go to Store
          </Link>
        </div>
      )}

      <div className="ai-grid">
        {/* MODELLI E GESTIONE */}
        <div className="ai-sidebar">
          <div className="card">
            <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <div className="card-title"><Settings size={16} /> Models Library</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Download and manage your local brains.</div>
            </div>
            
            <div className="pull-section" style={{ flexDirection: 'column', gap: '10px' }}>
               {!isCustomModel ? (
                 <select 
                   className="input-sm" 
                   value={pullModel}
                   onChange={(e) => {
                     if (e.target.value === 'custom') {
                       setIsCustomModel(true);
                     } else {
                       setPullModel(e.target.value);
                     }
                   }}
                 >
                   {SUGGESTED_MODELS.map(m => (
                     <option key={m.id} value={m.id}>{m.name}</option>
                   ))}
                   <option value="custom">-- Other (Enter name) --</option>
                 </select>
               ) : (
                 <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                   <input 
                     className="input-sm" 
                     placeholder="Model name (e.g. llama3)" 
                     value={customModelName}
                     onChange={(e) => setCustomModelName(e.target.value)}
                   />
                   <button className="btn btn-sm btn-ghost" onClick={() => setIsCustomModel(false)}><X size={14} /></button>
                 </div>
               )}

               {!isCustomModel && (
                 <div style={{ fontSize: '10px', color: 'var(--accent-blue)', opacity: 0.8, padding: '0 4px', display: 'flex', justifyContent: 'space-between' }}>
                   <span>{SUGGESTED_MODELS.find(m => m.id === pullModel)?.desc}</span>
                   <span style={{ fontWeight: 600 }}>{SUGGESTED_MODELS.find(m => m.id === pullModel)?.size}</span>
                 </div>
               )}

               <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={handlePull} disabled={pulling || !status?.active}>
                  {pulling ? <RefreshCw size={14} className="spin" /> : <Download size={14} />} 
                  {pulling ? ' Downloading...' : ' Download Model'}
               </button>
            </div>

            <div className="models-list">
               {modelsLoading ? <div className="spinner-sm" /> : (
                modelsData?.models?.length > 0 ? (
                  <>
                    {modelsData.models.map((m, i) => (
                      <div key={i} className={`model-item ${selectedModel === m.name ? 'active' : ''}`} onClick={() => setSelectedModel(m.name)}>
                        <div className="model-info">
                          <div className="model-name">{m.name}</div>
                          <div className="model-size">
                            {(m.size / (1024**3)).toFixed(2)} GB • {m.details?.parameter_size} • {m.details?.quantization_level || 'N/A'}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Modified: {new Date(m.modified_at).toLocaleDateString('en-US')}
                          </div>
                        </div>
                        <button className="btn-icon delete" title="Delete Model" onClick={(e) => { e.stopPropagation(); handleDelete(m.name); }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="models-total-info">
                      <div className="total-label">Total Storage Used</div>
                      <div className="total-value">
                        {(modelsData.models.reduce((acc, m) => acc + m.size, 0) / (1024**3)).toFixed(2)} GB
                      </div>
                    </div>
                  </>
                ) : <div className="empty-state">No models found.</div>
              )}
            </div>
          </div>

          <div className="card stats-mini" style={{ padding: '16px' }}>
             <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>External Access</div>
             <div className="stat-item" style={{ marginBottom: '8px' }}>
                <Cpu size={14} /> <span style={{ fontSize: '12px' }}>Engine: Ollama</span>
             </div>
             <div className="stat-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>API Address (for external apps):</div>
                <code style={{ fontSize: '11px', color: 'var(--accent-blue)' }}>http://{status?.detected_ip || 'localhost'}:11434</code>
             </div>
          </div>
        </div>

        {/* CHAT INTERFACE */}
        <div className="ai-chat-container">
          <div className="card chat-card">
            {selectedModel && (
              <div className="chat-header-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bot size={18} className="text-blue" />
                  <span style={{ fontSize: '13px' }}>Active model: <strong>{selectedModel}</strong></span>
                </div>
                {modelsData?.models?.find(m => m.name === selectedModel) && (
                  <div className="model-stats-pill">
                    <Activity size={12} />
                    <span>{(modelsData.models.find(m => m.name === selectedModel).size / (1024**3)).toFixed(2)} GB</span>
                  </div>
                )}
                <button className="btn btn-sm btn-ghost text-red" style={{ marginLeft: 'auto', fontSize: '11px', gap: '4px' }} onClick={handleClearChat}>
                  <Trash2 size={12} /> Clear Chat
                </button>
              </div>
            )}
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-welcome">
                  <Bot size={48} className="bot-icon" />
                  <h2>Welcome to EasyLin Local AI</h2>
                  <p>Select a model from the library and start chatting. Everything you write stays on your server.</p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`message-row ${m.role}`}>
                    <div className="message-bubble">
                       <div className="message-content">{m.content}</div>
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="message-row assistant">
                  <div className="message-bubble loading">
                     <div className="typing-dots"><span></span><span></span><span></span></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="chat-input-area">
               {error && <div className="chat-error">{error}</div>}
               <div className="input-wrapper">
                 <textarea 
                   rows="1"
                   placeholder={selectedModel ? `Chiedi a ${selectedModel}...` : "Seleziona un modello per iniziare"}
                   disabled={!selectedModel || chatLoading || !status?.active}
                   value={input}
                   onChange={(e) => setInput(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       handleSend();
                     }
                   }}
                 />
                 <button className="btn btn-primary" onClick={handleSend} disabled={!input.trim() || chatLoading || !selectedModel}>
                   <Send size={18} />
                 </button>
               </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .ai-grid { display: grid; grid-template-columns: 320px 1fr; gap: 20px; height: calc(100vh - 180px); }
        .ai-sidebar { display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }
        
        .header-actions { display: flex; align-items: center; gap: 12px; }
        .status-badge { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; background: rgba(255,255,255,0.05); }
        .status-badge.active { color: #10b981; background: rgba(16, 185, 129, 0.1); }
        .status-badge.offline { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

        .pull-section { display: flex; gap: 8px; margin-bottom: 20px; padding: 0 4px; }
        .models-list { display: flex; flex-direction: column; gap: 8px; }
        .model-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid transparent; cursor: pointer; transition: 0.2s; }
        .model-item:hover { background: rgba(255,255,255,0.06); }
        .model-item.active { border-color: var(--accent-blue); background: rgba(59, 130, 246, 0.05); }
        .model-name { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
        .model-size { font-size: 11px; color: var(--text-muted); }
        .btn-icon.delete { color: var(--text-muted); opacity: 0; }
        .model-item:hover .btn-icon.delete { opacity: 1; }
        .btn-icon.delete:hover { color: #ef4444; }
        
        .models-total-info { 
          margin-top: 16px; 
          padding: 12px; 
          border-radius: 12px; 
          background: rgba(255,255,255,0.02); 
          border: 1px dashed var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .total-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .total-value { font-size: 13px; font-weight: 700; color: var(--accent-blue); }
        
        .chat-header-info { 
          padding: 12px 20px; 
          background: rgba(255,255,255,0.03); 
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .model-stats-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          background: rgba(59, 130, 246, 0.1);
          color: var(--accent-blue);
          font-size: 11px;
          font-weight: 600;
        }
        .text-blue { color: var(--accent-blue); }

        .ai-chat-container { height: 100%; min-height: 0; }
        .chat-card { height: 100%; display: flex; flex-direction: column; padding: 0 !important; background: rgba(255,255,255,0.02); overflow: hidden; }
        .chat-messages { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        
        .chat-welcome { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--text-muted); }
        .bot-icon { margin-bottom: 20px; opacity: 0.5; color: var(--accent-blue); }
        .chat-welcome h2 { color: var(--text-primary); margin-bottom: 8px; }

        .message-row { display: flex; width: 100%; }
        .message-row.user { justify-content: flex-end; }
        .message-bubble { max-width: 80%; padding: 12px 18px; border-radius: 18px; font-size: 14px; line-height: 1.5; }
        .user .message-bubble { background: var(--accent-blue); color: white; border-bottom-right-radius: 4px; }
        .assistant .message-bubble { background: rgba(255,255,255,0.06); color: var(--text-primary); border-bottom-left-radius: 4px; }
        
        .chat-input-area { padding: 20px; border-top: 1px solid var(--border-color); }
        .input-wrapper { display: flex; gap: 12px; background: rgba(255,255,255,0.04); padding: 8px; border-radius: 16px; border: 1px solid var(--border-color); }
        .input-wrapper textarea { flex: 1; background: transparent; border: none; color: var(--text-primary); padding: 8px 12px; resize: none; font-family: inherit; outline: none; }
        .chat-error { color: #ef4444; font-size: 12px; margin-bottom: 8px; text-align: center; }

        .typing-dots { display: flex; gap: 4px; padding: 4px 0; }
        .typing-dots span { width: 6px; height: 6px; background: var(--text-muted); border-radius: 50%; animation: typing 1.4s infinite; opacity: 0.4; }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @media (max-width: 992px) {
          .ai-grid { grid-template-columns: 1fr; height: auto; display: flex; flex-direction: column; gap: 20px; }
          .ai-sidebar { order: 2; overflow-y: visible; }
          .ai-chat-container { order: 1; height: 500px; }
        }
        @media (max-width: 576px) {
          .chat-bubble { max-width: 90%; }
          .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
          .header-actions { width: 100%; justify-content: space-between; }
        }
      `}} />
    </div>
  );
}
