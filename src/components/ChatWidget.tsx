"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; text: string };

export default function ChatWidget({ agentName, businessName }: { agentName: string; businessName: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationId = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: `Hi! I'm ${agentName} from ${businessName} 👋 Ask me about prices, opening hours or insurance — or I can book you an appointment.` },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    conversationId.current ??= crypto.randomUUID();
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text }, { role: "assistant", text: "" }]);

    const appendToReply = (chunk: string) =>
      setMessages((m) => {
        const last = m[m.length - 1];
        return [...m.slice(0, -1), { ...last, text: last.text + chunk }];
      });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationId.current, message: text }),
      });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToReply(decoder.decode(value, { stream: true }));
      }
    } catch {
      appendToReply("Connection problem — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const suggestions = ["How much is teeth whitening?", "Do you accept AAR insurance?", "I'd like to book a cleaning"];

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[min(560px,calc(100vh-6rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center gap-3 bg-teal-700 px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 font-semibold">{agentName[0]}</div>
            <div className="flex-1">
              <div className="font-semibold leading-tight">{agentName}</div>
              <div className="text-xs text-teal-100">AI assistant · replies instantly, 24/7</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="rounded p-1 hover:bg-white/20">✕</button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-teal-700 text-white" : "border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {m.text || <span className="animate-pulse text-slate-400">typing…</span>}
                </div>
              </div>
            ))}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-teal-700 px-3 py-1 text-xs text-teal-800 hover:bg-teal-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-900 outline-none focus:border-teal-700"
            />
            <button
              disabled={busy || !input.trim()}
              className="rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open chat"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-2xl text-white shadow-lg hover:bg-teal-800"
      >
        {open ? "✕" : "💬"}
      </button>
    </div>
  );
}
