import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import api from '../../api/client';
import { 
  Bot, Send, Download, Trash2, Cpu, Activity, 
  MessageSquare, Settings, AlertCircle, CheckCircle, 
  RefreshCw, Terminal, Info, X, Shield, FileText, Container,
  Save, Globe, Package, Users, GitBranch
} from 'lucide-react';

const SUGGESTED_MODELS = [
  { id: 'qwen2.5:0.5b', name: 'Qwen 2.5 (0.5B)', size: '390 MB', ram: '2GB', desc: 'Ultra-lightweight, extremely fast for basic tasks.' },
  { id: 'qwen2.5:1.5b', name: 'Qwen 2.5 (1.5B)', size: '1.0 GB', ram: '4GB', desc: 'Lightweight, ideal for most home servers.' },
  { id: 'qwen2.5:3b', name: 'Qwen 2.5 (3B)', size: '1.9 GB', ram: '6GB', desc: 'Smart and balanced, high reasoning for its size.' },
  { id: 'qwen2.5:7b', name: 'Qwen 2.5 (7B)', size: '4.7 GB', ram: '8GB', desc: 'The gold standard for general purpose local AI.' },
  { id: 'gemma2:2b', name: 'Gemma 2 (2B)', size: '1.6 GB', ram: '4GB', desc: 'Google\'s latest compact model, very efficient.' },
  { id: 'gemma2:9b', name: 'Gemma 2 (9B)', size: '5.4 GB', ram: '12GB', desc: 'Google\'s state-of-the-art balanced model.' },
  { id: 'llama3.1:8b', name: 'Llama 3.1 (8B)', size: '4.7 GB', ram: '12GB', desc: 'Meta\'s flagship, extremely reliable and versatile.' },
  { id: 'mistral:latest', name: 'Mistral (7B)', size: '4.1 GB', ram: '8GB', desc: 'Classic European model, fast and precise.' },
  { id: 'phi3.5:latest', name: 'Phi-3.5 Mini', size: '2.2 GB', ram: '4GB', desc: 'Microsoft\'s latest update, high logic in tiny size.' },
  { id: 'qwen2.5:32b', name: 'Qwen 2.5 (32B)', size: '19 GB', ram: '32GB', desc: 'Professional grade reasoning (Requires high RAM).' },
];

export default function AIManager() {
  const { data: status, loading: statusLoading, error: statusError, refetch: refetchStatus } = useApi('/ai/status');
  const { data: modelsData, loading: modelsLoading, refetch: refetchModels } = useApi('/ai/models');
  const { data: permissionsData, loading: permissionsLoading, error: permissionsError, refetch: refetchPermissions } = useApi('/ai/permissions');
  
  const [tab, setTab] = useState('chat'); // 'chat' or 'settings'
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [pullModel, setPullModel] = useState(SUGGESTED_MODELS[0].id);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelName, setCustomModelName] = useState('');
  const [tzModal, setTzModal] = useState(false);
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
    
    // Add temporary assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);
    
    try {
      let fullContent = '';
      await api.stream('/ai/chat', {
        model: selectedModel,
        messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      }, (chunk) => {
        if (chunk.content) {
          fullContent += chunk.content;
          setMessages(prev => {
            const newMsgs = [...prev];
            const last = newMsgs[newMsgs.length - 1];
            if (last && last.role === 'assistant') {
              last.content = fullContent;
              last.status = null;
            }
            return newMsgs;
          });
        } else if (chunk.status) {
          setMessages(prev => {
            const newMsgs = [...prev];
            const last = newMsgs[newMsgs.length - 1];
            if (last && last.role === 'assistant') {
              last.status = chunk.status;
            }
            return newMsgs;
          });
        } else if (chunk.error) {
          setError(chunk.error);
        }
      });
      
      // Mark as done streaming
      setMessages(prev => {
        const newMsgs = [...prev];
        const last = newMsgs[newMsgs.length - 1];
        if (last) last.isStreaming = false;
        return newMsgs;
      });

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

  const togglePermission = async (capability, current) => {
    try {
      await api.post('/ai/permissions', { capability, enabled: !current });
      refetchPermissions();
    } catch (err) {
      setError("Failed to update permission");
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title"><Bot size={28} /><h1>AI Manager</h1></div>
        <div className="header-actions">
           <div className="tabs-sm" style={{ marginRight: '12px' }}>
              <button className={`tab-sm ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>Chat</button>
              <button className={`tab-sm ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>Settings & Permissions</button>
           </div>
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
          {/* LIBRARY SECTION */}
          <div className="card library-section" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'var(--accent-blue-transparent)', padding: '8px', borderRadius: '8px' }}>
                <Download size={18} className="text-blue" />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>Model Library</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Get new AI brains</div>
              </div>
            </div>
            
            <button 
              className="btn btn-ghost" 
              style={{ 
                width: '100%', 
                justifyContent: 'space-between', 
                marginBottom: '16px', 
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-color)',
                padding: '12px 16px',
                height: 'auto'
              }}
              onClick={() => setTzModal(true)}
              disabled={pulling}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Package size={16} className="text-blue" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{isCustomModel ? 'Custom Model' : (SUGGESTED_MODELS.find(m => m.id === pullModel)?.name || 'Select Model')}</div>
                  <div style={{ fontSize: '10px', opacity: 0.5 }}>Click to browse catalog</div>
                </div>
              </div>
              <RefreshCw size={14} style={{ opacity: 0.4 }} />
            </button>

            {!isCustomModel && (() => {
              const modelInfo = SUGGESTED_MODELS.find(m => m.id === pullModel);
              return (
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontStyle: 'italic' }}>
                    "{modelInfo?.desc}"
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Size</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-blue)' }}>{modelInfo?.size}</div>
                    </div>
                    <div style={{ background: 'rgba(34, 197, 94, 0.05)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.1)' }}>
                      <div style={{ fontSize: '9px', color: '#22c55e', textTransform: 'uppercase' }}>Min RAM</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#22c55e' }}>{modelInfo?.ram}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {isCustomModel && (
              <div style={{ marginBottom: '16px' }}>
                <div className="input-wrapper" style={{ marginBottom: '8px', position: 'relative' }}>
                  <input 
                    className="input-sm" 
                    placeholder="Enter model name..." 
                    value={customModelName}
                    onChange={(e) => setCustomModelName(e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.3)', width: '100%', paddingRight: '40px' }}
                  />
                  <button className="btn btn-sm btn-ghost" style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }} onClick={() => { setIsCustomModel(false); setPullModel(SUGGESTED_MODELS[0].id); }}><X size={14} /></button>
                </div>
              </div>
            )}

            <button className="btn btn-primary" style={{ width: '100%', height: '42px', borderRadius: '10px' }} onClick={handlePull} disabled={pulling || !status?.active}>
               {pulling ? <RefreshCw size={16} className="spin" /> : <Download size={16} />} 
               <span style={{ marginLeft: '8px' }}>{pulling ? 'Downloading...' : 'Install AI Model'}</span>
            </button>
          </div>

          {/* INSTALLED MODELS SECTION */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '0 4px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Local Models</div>
              <div style={{ fontSize: '10px', background: 'var(--accent-blue-transparent)', color: 'var(--accent-blue)', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>
                {modelsData?.models?.length || 0} Total
              </div>
            </div>

            <div className="models-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {modelsLoading ? <div className="spinner-sm" style={{ margin: '40px auto' }} /> : (
                 modelsData?.models?.length > 0 ? (
                   <>
                     {modelsData.models.map((m, i) => {
                       const suggestedInfo = SUGGESTED_MODELS.find(sm => m.name.startsWith(sm.id));
                       return (
                        <div key={i} className={`model-item ${selectedModel === m.name ? 'active' : ''}`} 
                             onClick={() => setSelectedModel(m.name)}
                             style={{ 
                               background: selectedModel === m.name ? 'var(--accent-blue-transparent)' : 'rgba(255,255,255,0.03)',
                               border: `1px solid ${selectedModel === m.name ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                               padding: '14px',
                               borderRadius: '12px',
                               transition: '0.3s'
                             }}>
                          <div className="model-info">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <span className="model-name" style={{ fontWeight: 700, fontSize: '14px' }}>{m.name}</span>
                              <button className="btn-icon delete" style={{ padding: '4px', opacity: 0.5 }} title="Delete Model" onClick={(e) => { e.stopPropagation(); handleDelete(m.name); }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                            
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                {(m.size / (1024**3)).toFixed(2)} GB
                              </span>
                              {suggestedInfo?.ram && (
                                <span style={{ fontSize: '10px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                  RAM {suggestedInfo.ram}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                       );
                     })}

                     <div className="total-storage-pill" style={{ 
                       marginTop: 'auto', 
                       padding: '12px 16px', 
                       background: 'rgba(0,0,0,0.3)', 
                       borderRadius: '12px', 
                       border: '1px solid var(--border-color)',
                       display: 'flex',
                       justifyContent: 'space-between',
                       alignItems: 'center'
                     }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Storage</div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent-blue)' }}>
                          {(modelsData.models.reduce((acc, m) => acc + m.size, 0) / (1024**3)).toFixed(2)} GB
                        </div>
                     </div>
                   </>
                 ) : (
                   <div className="empty-state" style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.5 }}>
                     <Bot size={32} style={{ marginBottom: '12px' }} />
                     <div style={{ fontSize: '13px' }}>No local models installed</div>
                   </div>
                 )
               )}
            </div>
          </div>
        </div>

        {/* CHAT INTERFACE / SETTINGS */}
        <div className="ai-chat-container">
          {tab === 'chat' ? (
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
                         <div className="message-content">
                            {m.content}
                            {m.status && (
                              <div style={{ 
                                fontSize: '11px', 
                                color: 'var(--accent-blue)', 
                                marginTop: '6px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '5px',
                                background: 'rgba(0,0,0,0.2)',
                                padding: '4px 8px',
                                borderRadius: '4px'
                              }}>
                                <RefreshCw size={10} className="animate-spin" />
                                {m.status}
                              </div>
                            )}
                         </div>
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
                     placeholder={selectedModel ? `Ask ${selectedModel}...` : "Select a model to start"}
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
          ) : (
            <div className="card settings-card">
              <div className="card-header">
                <div className="card-title"><Shield size={18} /> AI Agent Permissions Matrix</div>
              </div>
              <div style={{ padding: '0 20px', marginTop: '20px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  Enable the following capabilities to allow the AI to interact with your system. 
                  <strong> Warning:</strong> Enabling high-risk operations (Shell, File Write) gives the AI full access to your host.
                </p>
              </div>
              <div className="permissions-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
                gap: '16px', 
                padding: '20px' 
              }}>
                {permissionsLoading && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
                    <RefreshCw className="animate-spin" size={32} style={{ opacity: 0.5 }} />
                    <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Loading permissions...</p>
                  </div>
                )}
                {permissionsError && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
                    <AlertCircle size={32} className="text-red" />
                    <p style={{ marginTop: '12px', color: 'var(--text-red)' }}>Error: {permissionsError}</p>
                  </div>
                )}
                {!permissionsLoading && !permissionsError && permissionsData?.permissions?.map(p => (
                  <div key={p.capability} className="permission-item" style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '16px', 
                    background: 'rgba(255,255,255,0.03)', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <div style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '10px', 
                        background: p.enabled ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.05)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: p.enabled ? 'var(--accent-blue)' : 'var(--text-muted)',
                        position: 'relative'
                      }}>
                        {p.capability === 'shell_exec' ? <Terminal size={20} /> : 
                         p.capability === 'docker_mgmt' ? <Container size={20} /> :
                         p.capability === 'file_read' ? <FileText size={20} /> :
                         p.capability === 'file_write' ? <Save size={20} /> :
                         p.capability === 'system_info' ? <Activity size={20} /> : 
                         p.capability === 'service_mgmt' ? <Settings size={20} /> :
                         p.capability === 'package_mgmt' ? <Package size={20} /> :
                         p.capability === 'process_mgmt' ? <Cpu size={20} /> :
                         p.capability === 'network_view' ? <Globe size={20} /> :
                         p.capability === 'firewall_mgmt' ? <Shield size={20} /> :
                         p.capability === 'user_mgmt' ? <Users size={20} /> :
                         p.capability === 'git_mgmt' ? <GitBranch size={20} /> :
                         <Shield size={20} />}
                        
                        {/* Criticality Indicator */}
                        <div style={{ 
                          position: 'absolute', 
                          top: '-4px', 
                          right: '-4px', 
                          width: '12px', 
                          height: '12px', 
                          borderRadius: '50%', 
                          border: '2px solid var(--card-bg, #1a1a1a)',
                          backgroundColor: p.level === 'high' ? '#ef4444' : p.level === 'medium' ? '#f59e0b' : '#22c55e'
                        }} title={`Criticality: ${p.level}`} />
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {p.capability.replace('_', ' ').toUpperCase()}
                          <span style={{ 
                            fontSize: '9px', 
                            padding: '1px 6px', 
                            borderRadius: '4px', 
                            backgroundColor: p.level === 'high' ? 'rgba(239, 68, 68, 0.1)' : p.level === 'medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                            color: p.level === 'high' ? '#ef4444' : p.level === 'medium' ? '#f59e0b' : '#22c55e',
                            textTransform: 'uppercase'
                          }}>
                            {p.level}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.description}</div>
                      </div>
                    </div>
                    
                    <button 
                      className={`btn btn-sm ${p.enabled ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => togglePermission(p.capability, p.enabled)}
                      style={{ minWidth: '100px' }}
                    >
                      {p.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Model Selection Modal (Timezone Style) */}
      {tzModal && (
        <div className="modal-overlay fade-in" onClick={() => setTzModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <div className="modal-title"><Package size={18} /> Select Model from Library</div>
              <button className="btn btn-sm btn-ghost" onClick={() => setTzModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '450px', overflowY: 'auto', padding: '12px' }}>
              <div className="tz-list">
                {SUGGESTED_MODELS.map(m => (
                  <div key={m.id} 
                       className={`tz-option ${pullModel === m.id && !isCustomModel ? 'active' : ''}`}
                       onClick={() => { setPullModel(m.id); setIsCustomModel(false); setTzModal(false); }}
                       style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{m.name}</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ fontSize: '10px', opacity: 0.7 }}>{m.size}</span>
                        <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: 600 }}>RAM {m.ram}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.6 }}>{m.desc}</div>
                  </div>
                ))}
                
                <div 
                   className={`tz-option ${isCustomModel ? 'active' : ''}`}
                   onClick={() => { setIsCustomModel(true); setTzModal(false); }}
                   style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <GitBranch size={16} />
                    <span>Enter Custom Model Name...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .ai-grid { display: grid; grid-template-columns: 320px 1fr; gap: 20px; height: calc(100vh - 180px); }
        .ai-sidebar { display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }
        
        /* Modal Styles (Timezone style) */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .modal-content { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; width: 100%; max-width: 500px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); overflow: hidden; }
        .modal-header { padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
        .modal-title { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; }
        .tz-list { display: flex; flex-direction: column; gap: 4px; }
        .tz-option { padding: 10px 16px; border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 13px; transition: 0.2s; }
        .tz-option:hover { background: var(--bg-lighter); }
        .tz-option.active { background: rgba(0, 150, 255, 0.1); color: var(--accent-blue); font-weight: 600; border-left: 3px solid var(--accent-blue); }

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

        .tabs-sm { display: flex; background: rgba(255,255,255,0.05); padding: 4px; border-radius: 8px; border: 1px solid var(--border-color); }
        .tab-sm { background: transparent; border: none; color: var(--text-muted); padding: 6px 16px; font-size: 12px; font-weight: 600; cursor: pointer; border-radius: 6px; transition: 0.2s; }
        .tab-sm.active { background: var(--accent-blue); color: white; }
        .tab-sm:hover:not(.active) { color: var(--text-primary); background: rgba(255,255,255,0.05); }

        .settings-card { height: 100%; overflow-y: auto; }
      `}} />
    </div>
  );
}
