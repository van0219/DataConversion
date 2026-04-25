import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';
import { theme } from '../theme';

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  links?: { title: string; url: string }[];
  followups?: string[];
}

interface GenAiChatProps {
  visible: boolean;
  onClose: () => void;
  appContext?: {
    page?: string;
    jobId?: number;
    businessClass?: string;
    hasErrors?: boolean;
    mappedFields?: number;
    batchFiles?: number;
  };
  captureScreenContext?: () => string;  // Function that returns current screen state as text
}

const GenAiChat: React.FC<GenAiChatProps> = ({ visible, onClose, appContext, captureScreenContext }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [dotCount, setDotCount] = useState(1);
  const [contextEnabled, setContextEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Animated dots for loading
  useEffect(() => {
    if (!sending) return;
    const id = setInterval(() => setDotCount(prev => (prev % 3) + 1), 400);
    return () => clearInterval(id);
  }, [sending]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (visible) setTimeout(() => inputRef.current?.focus(), 300);
  }, [visible]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      content: text,
      sender: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const resp = await api.post('/genai/chat', {
        prompt: text,
        session: sessionId,
        injectContext: contextEnabled,
        context: contextEnabled ? appContext : undefined
      });

      const data = resp.data;
      if (data.session && !sessionId) setSessionId(data.session);

      const aiMsg: ChatMessage = {
        id: data.id || `ai-${Date.now()}`,
        content: data.content || 'No response received.',
        sender: 'ai',
        timestamp: new Date(),
        links: data.links,
        followups: data.followups
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      const errText = err.response?.data?.detail || err.message || 'Failed to connect to GenAI service';
      let friendlyMsg = errText;
      if (errText.includes('No such deployment') || errText.includes('deployment details')) {
        friendlyMsg = 'Infor GenAI is not available for this tenant. Please contact your Infor administrator to enable the GenAI service.';
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        friendlyMsg = 'Authentication failed. Please log out and log back in.';
      } else if (err.response?.status === 429) {
        friendlyMsg = 'Too many requests. Please wait a moment and try again.';
      }
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        content: friendlyMsg,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, right: 0, bottom: 0,
      width: visible ? 400 : 0,
      backgroundColor: theme.background.secondary,
      borderLeft: visible ? `1px solid ${theme.background.quaternary}` : 'none',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s ease',
      overflow: 'hidden',
      zIndex: 900,
      boxShadow: visible ? '-4px 0 20px rgba(0,0,0,0.08)' : 'none'
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${theme.background.quaternary}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, backgroundColor: theme.background.primary
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${theme.primary.main}, #8B5CF6)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16
          }}>✨</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.text.primary }}>Infor GenAI</div>
            <div style={{ fontSize: 11, color: theme.text.muted }}>
              {sessionId ? 'Active session' : 'New conversation'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            onClick={() => setContextEnabled(!contextEnabled)}
            title={contextEnabled ? 'DataBridge context: ON — AI knows your current workflow' : 'DataBridge context: OFF — raw GenAI mode'}
            style={{
              background: 'none', border: `1px solid ${contextEnabled ? theme.primary.main : theme.background.quaternary}`,
              color: contextEnabled ? theme.primary.main : theme.text.muted,
              cursor: 'pointer', padding: '3px 8px', borderRadius: 4, fontSize: 11,
              fontWeight: 600, transition: 'all 0.2s ease'
            }}
          >{contextEnabled ? '🧠 Context' : '🧠'}</button>
          {messages.length > 0 && (
            <button onClick={clearChat} title="New conversation" style={{
              background: 'none', border: 'none', color: theme.text.muted,
              cursor: 'pointer', padding: '4px 8px', borderRadius: 4, fontSize: 16
            }}>↻</button>
          )}
          <button onClick={onClose} title="Close" style={{
            background: 'none', border: 'none', color: theme.text.muted,
            cursor: 'pointer', padding: '4px 8px', borderRadius: 4, fontSize: 18
          }}>✕</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: 12
      }}>
        {messages.length === 0 && !sending && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            color: theme.text.muted, textAlign: 'center', padding: '40px 20px'
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: `linear-gradient(135deg, ${theme.primary.main}20, #8B5CF620)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28
            }}>✨</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: theme.text.secondary }}>
              Ask Infor GenAI
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 280 }}>
              Ask questions about FSM, get help with data conversion, or explore your business data.
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex',
            justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: msg.sender === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              backgroundColor: msg.sender === 'user' ? theme.primary.main : theme.background.tertiary,
              color: msg.sender === 'user' ? '#fff' : theme.text.primary,
              fontSize: 13, lineHeight: 1.5,
              wordBreak: 'break-word'
            }}>
              {msg.sender === 'user' ? msg.content : (
                <div className="genai-markdown">
                  <ReactMarkdown
                    components={{
                      p: ({children}) => <p style={{ margin: '0 0 8px', lineHeight: 1.6 }}>{children}</p>,
                      strong: ({children}) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                      em: ({children}) => <em>{children}</em>,
                      ul: ({children}) => <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ul>,
                      ol: ({children}) => <ol style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ol>,
                      li: ({children}) => <li style={{ marginBottom: 2 }}>{children}</li>,
                      code: ({children, className}) => {
                        const isBlock = className?.includes('language-');
                        return isBlock ? (
                          <pre style={{
                            backgroundColor: '#1a1a2e', color: '#e0e0e0',
                            padding: '10px 12px', borderRadius: 6, fontSize: 12,
                            overflow: 'auto', margin: '6px 0'
                          }}><code>{children}</code></pre>
                        ) : (
                          <code style={{
                            backgroundColor: 'rgba(0,0,0,0.08)', padding: '1px 5px',
                            borderRadius: 3, fontSize: 12, fontFamily: 'monospace'
                          }}>{children}</code>
                        );
                      },
                      table: ({children}) => (
                        <div style={{ overflowX: 'auto', margin: '8px 0' }}>
                          <table style={{
                            borderCollapse: 'collapse', fontSize: 12, width: '100%',
                            border: `1px solid ${theme.background.quaternary}`
                          }}>{children}</table>
                        </div>
                      ),
                      th: ({children}) => (
                        <th style={{
                          padding: '6px 10px', textAlign: 'left', fontWeight: 600,
                          backgroundColor: theme.background.quaternary,
                          borderBottom: `1px solid ${theme.background.quaternary}`,
                          whiteSpace: 'nowrap', fontSize: 11
                        }}>{children}</th>
                      ),
                      td: ({children}) => (
                        <td style={{
                          padding: '5px 10px',
                          borderBottom: `1px solid ${theme.background.quaternary}`,
                          fontSize: 12
                        }}>{children}</td>
                      ),
                      h1: ({children}) => <h3 style={{ fontSize: 16, fontWeight: 700, margin: '8px 0 4px' }}>{children}</h3>,
                      h2: ({children}) => <h4 style={{ fontSize: 15, fontWeight: 600, margin: '8px 0 4px' }}>{children}</h4>,
                      h3: ({children}) => <h5 style={{ fontSize: 14, fontWeight: 600, margin: '6px 0 4px' }}>{children}</h5>,
                      a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: theme.primary.main }}>{children}</a>,
                      blockquote: ({children}) => (
                        <blockquote style={{
                          borderLeft: `3px solid ${theme.primary.main}`,
                          margin: '6px 0', padding: '4px 12px',
                          color: theme.text.secondary, fontSize: 12
                        }}>{children}</blockquote>
                      )
                    }}
                  >{msg.content}</ReactMarkdown>
                </div>
              )}

              {/* Links */}
              {msg.links && msg.links.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {msg.links.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: msg.sender === 'user' ? '#ddd' : theme.primary.main }}>
                      🔗 {link.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
              backgroundColor: theme.background.tertiary,
              color: theme.text.muted, fontSize: 13
            }}>
              Thinking{'.'.repeat(dotCount)}
            </div>
          </div>
        )}

        {/* Follow-up suggestions */}
        {messages.length > 0 && !sending && messages[messages.length - 1]?.followups && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {messages[messages.length - 1].followups!.map((fu, i) => (
              <button key={i} onClick={() => { setInput(fu); }}
                style={{
                  padding: '6px 12px', borderRadius: 20,
                  backgroundColor: theme.background.primary,
                  border: `1px solid ${theme.background.quaternary}`,
                  color: theme.text.secondary, fontSize: 12, cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = theme.primary.main; e.currentTarget.style.color = theme.primary.main; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = theme.background.quaternary; e.currentTarget.style.color = theme.text.secondary; }}
              >{fu}</button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${theme.background.quaternary}`,
        backgroundColor: theme.background.primary,
        flexShrink: 0
      }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button
            onClick={() => {
              // Capture the main content area's visible text
              let captured = '';
              
              if (captureScreenContext) {
                captured = captureScreenContext();
              } else {
                // Find the main content div (right of sidebar, left of chat)
                const mainEl = document.querySelector('[class*="main"]') as HTMLElement
                  || document.querySelectorAll('div[style]')[0]?.parentElement as HTMLElement;
                
                // Get all divs that are direct children of the app container
                // The main content is typically the largest scrollable area
                let bestEl: HTMLElement | null = null;
                let bestLen = 0;
                document.querySelectorAll('div').forEach(div => {
                  const el = div as HTMLElement;
                  const style = el.style;
                  // Look for the main content area (has overflow auto/scroll, large content)
                  if (el.scrollHeight > 200 && el.innerText.length > bestLen && el.innerText.length < 50000) {
                    // Skip the chat sidebar itself and the nav sidebar
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 400 && rect.left > 60) {
                      bestLen = el.innerText.length;
                      bestEl = el;
                    }
                  }
                });
                
                if (bestEl) {
                  const rawText = (bestEl as HTMLElement).innerText;
                  // Clean up: remove excessive whitespace, limit length
                  const lines = rawText.split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length > 0)
                    .slice(0, 60);
                  captured = lines.join('\n');
                }
                
                // Fallback: just get the page title and any visible stats
                if (!captured || captured.length < 20) {
                  const h1 = document.querySelector('h1, h2, h3');
                  captured = h1 ? (h1 as HTMLElement).innerText : 'Current page content';
                }
                
                // Trim to reasonable size
                if (captured.length > 2000) {
                  captured = captured.substring(0, 2000) + '\n... (truncated)';
                }
              }
              
              if (captured) {
                setInput(prev => {
                  const prefix = `[Screen Context]\n${captured}\n[End Screen Context]\n\nMy question: `;
                  return prefix;
                });
                setTimeout(() => {
                  if (inputRef.current) {
                    inputRef.current.style.height = 'auto';
                    inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 100) + 'px';
                    inputRef.current.focus();
                    // Place cursor at the end
                    inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
                  }
                }, 50);
              }
            }}
            title="Capture current screen context and add to message"
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
              backgroundColor: theme.background.secondary,
              border: `1px solid ${theme.background.quaternary}`,
              color: theme.text.secondary, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.primary.main; e.currentTarget.style.color = theme.primary.main; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.background.quaternary; e.currentTarget.style.color = theme.text.secondary; }}
          >📋 Capture Screen</button>
        </div>

        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          backgroundColor: theme.background.secondary,
          border: `1px solid ${theme.background.quaternary}`,
          borderRadius: 12, padding: '8px 12px',
          transition: 'border-color 0.2s ease'
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            style={{
              flex: 1, border: 'none', outline: 'none', resize: 'none',
              backgroundColor: 'transparent', color: theme.text.primary,
              fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit',
              maxHeight: 100, overflow: 'auto'
            }}
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 100) + 'px';
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            style={{
              width: 32, height: 32, borderRadius: 8,
              backgroundColor: input.trim() && !sending ? theme.primary.main : theme.background.tertiary,
              border: 'none', cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: input.trim() && !sending ? '#fff' : theme.text.muted,
              fontSize: 14, flexShrink: 0,
              transition: 'all 0.2s ease'
            }}
          >↑</button>
        </div>
        <div style={{ fontSize: 10, color: theme.text.muted, textAlign: 'center', marginTop: 6 }}>
          Powered by Infor GenAI
        </div>
      </div>
    </div>
  );
};

export default GenAiChat;
