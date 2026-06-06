import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, X, Send, Headphones } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ChatMessage } from '../lib/supabase';
import { markChatRead } from '../lib/readState';

interface Props {
  companyId: string;
  companyName?: string;
  userId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onMarkedRead?: () => void;
  hasUnread?: boolean;
}

export function AdminChatWidget({
  companyId, companyName, userId,
  open: controlledOpen, onOpenChange, onMarkedRead, hasUnread,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(open) : value;
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('admin_chat_messages')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (error) {
      setError('Could not load messages. Please try again.');
      setMessages([]);
    } else {
      const list = (data as ChatMessage[]) ?? [];
      setMessages(list);
      if (open && userId && list.length > 0) {
        const latest = list[list.length - 1]?.created_at;
        markChatRead(userId, companyId, latest);
        onMarkedRead?.();
      }
    }
    setLoading(false);
  }, [companyId, open, userId, onMarkedRead]);

  useEffect(() => {
    if (!open || !companyId) return;
    loadMessages();
    const interval = setInterval(loadMessages, 8000);
    return () => clearInterval(interval);
  }, [open, companyId, loadMessages]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !companyId || sending) return;
    setSending(true);
    setError('');
    const { error: insertErr } = await supabase.from('admin_chat_messages').insert({
      company_id: companyId,
      sender_role: 'carrier',
      message: text,
    });
    if (insertErr) {
      setError(insertErr.message || 'Failed to send message.');
      setSending(false);
      return;
    }
    setInput('');
    await loadMessages();
    setSending(false);
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 pointer-events-none">
      {open && (
        <div
          className="pointer-events-auto w-[min(100vw-2rem,380px)] h-[min(70vh,520px)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-fade-in"
          role="dialog"
          aria-label="Chat with admin support"
        >
          <div className="flex items-center gap-3 px-4 py-3.5 bg-gray-900 text-white flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Headphones size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">Admin Support</p>
              <p className="text-[11px] text-gray-400 truncate">
                {companyName ? `${companyName} · ` : ''}We typically reply within 1 business day
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition text-gray-300 hover:text-white"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/80"
          >
            {messages.length === 0 && !loading && (
              <div className="text-center py-8 px-2">
                <MessageSquare size={28} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700">How can we help?</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Describe billing issues, technical problems, or questions about your account. Our team will respond here.
                </p>
              </div>
            )}
            {loading && messages.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-6">Loading conversation…</p>
            )}
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_role === 'carrier' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    msg.sender_role === 'carrier'
                      ? 'bg-gray-900 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md shadow-sm'
                  }`}
                >
                  {msg.sender_role === 'admin' && (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-1">
                      Admin
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  <p
                    className={`text-[10px] mt-1.5 ${
                      msg.sender_role === 'carrier' ? 'text-gray-400' : 'text-gray-400'
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">{error}</p>
          )}

          <div className="flex-shrink-0 p-3 border-t border-gray-200 bg-white">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Describe your issue…"
                rows={2}
                disabled={sending}
                className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition disabled:opacity-40"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="pointer-events-auto relative flex items-center gap-2 pl-4 pr-5 py-3.5 bg-gray-900 text-white rounded-full shadow-xl hover:bg-gray-800 hover:shadow-2xl transition-all duration-200 group"
        aria-expanded={open}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
      >
        {!open && hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-900 animate-pulse-soft" />
        )}
        {open ? <X size={20} /> : <MessageSquare size={20} />}
        <span className="text-sm font-semibold pr-0.5">
          {open ? 'Close' : 'Ask Admin'}
        </span>
      </button>
    </div>
  );
}
