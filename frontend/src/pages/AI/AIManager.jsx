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
  { id: 'qwen2.5:1.5b', name: 'Qwen 2.5 (Leggero)', desc: 'Perfetto per server con poca RAM (<4GB).' },
  { id: 'qwen2.5:7b', name: 'Qwen 2.5 (Standard)', desc: 'Il miglior equilibrio tra intelligenza e velocità.' },
  { id: 'llama3.1:8b', name: 'Llama 3.1 (Avanzato)', desc: 'Il modello più potente di Meta per uso generale.' },
  { id: 'mistral:latest', name: 'Mistral (Classico)', desc: 'Affidabile e molto veloce.' },
  { id: 'codegemma:2b', name: 'CodeGemma (Codice)', desc: 'Specializzato per aiutarti a programmare.' },
  { id: 'phi3:mini', name: 'Phi-3 Mini (Microsoft)', desc: 'Incredibilmente potente per le sue dimensioni ridotte.' },
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
      setError("Error pulling model. Make sure the name is correct.");
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
      setError("Error deleting model");
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
      setError("Chat error. Is the model loaded correctly?");
    } finally {
      setChatLoading(false);
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
              {status?.message || (statusLoading ? 'Caricamento stato...' : 'Ollama non rilevato')}
            </strong> 
            {status?.detected_ip ? `Indirizzo IP rilevato: ${status.detected_ip}` : 'Verifica che il motore Ollama sia installato e attivo.'}
          </div>
          <Link to="/docker" className="btn btn-sm btn-primary" style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}>
            Vai allo Store
          </Link>
        </div>
      )}

      <div className="ai-grid">
        {/* MODELLI E GESTIONE */}
        <div className="ai-sidebar">
          <div className="card">
            <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <div className="card-title"><Settings size={16} /> Models Library</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Scarica e gestisci i tuoi cervelli locali.</div>
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
                   <option value="custom">-- Altro (Inserisci nome) --</option>
                 </select>
               ) : (
                 <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                   <input 
                     className="input-sm" 
                     placeholder="Nome modello (es. llama3)" 
                     value={customModelName}
                     onChange={(e) => setCustomModelName(e.target.value)}
                   />
                   <button className="btn btn-sm btn-ghost" onClick={() => setIsCustomModel(false)}><X size={14} /></button>
                 </div>
               )}

               {!isCustomModel && (
                 <div style={{ fontSize: '10px', color: 'var(--accent-blue)', opacity: 0.8, padding: '0 4px' }}>
                   {SUGGESTED_MODELS.find(m => m.id === pullModel)?.desc}
                 </div>
               )}

               <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={handlePull} disabled={pulling || !status?.active}>
                  {pulling ? <RefreshCw size={14} className="spin" /> : <Download size={14} />} 
                  {pulling ? ' Scaricando...' : ' Scarica Modello'}
               </button>
            </div>

            <div className="models-list">
              {modelsLoading ? <div className="spinner-sm" /> : (
                modelsData?.models?.length > 0 ? modelsData.models.map((m, i) => (
                  <div key={i} className={`model-item ${selectedModel === m.name ? 'active' : ''}`} onClick={() => setSelectedModel(m.name)}>
                    <div className="model-info">
                      <div className="model-name">{m.name}</div>
                      <div className="model-size">{(m.size / 1e9).toFixed(2)} GB • {m.details?.parameter_size}</div>
                    </div>
                    <button className="btn-icon delete" onClick={(e) => { e.stopPropagation(); handleDelete(m.name); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )) : <div className="empty-state">No models found.</div>
              )}
            </div>
          </div>

          <div className="card stats-mini">
             <div className="stat-item">
                <Cpu size={14} /> <span>System Engine: Ollama</span>
             </div>
             <div className="stat-item">
                <Terminal size={14} /> <span>Port: 11434</span>
             </div>
          </div>
        </div>

        {/* CHAT INTERFACE */}
        <div className="ai-chat-container">
          <div className="card chat-card">
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-welcome">
                  <Bot size={48} className="bot-icon" />
                  <h2>Benvenuto nell'AI Locale di EasyLin</h2>
                  <p>Seleziona un modello dalla libreria e inizia a chattare. Tutto ciò che scrivi resta nel tuo server.</p>
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
        @keyframes typing { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      `}} />
    </div>
  );
}
