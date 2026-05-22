"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Line = {
  text: string;
  isUser: boolean;
  isSystem?: boolean;
};

const DEFAULT_MODEL = "llama3.2:3b";

export default function Terminal() {
  const [lines, setLines] = useState<Line[]>([
    { text: "OllamaTUI v0.1 — Terminal UI for OllamaFreeAPI", isUser: false, isSystem: true },
    { text: "Type a message to chat or /help for commands.", isUser: false, isSystem: true },
    { text: "", isUser: false, isSystem: true },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const setPersistentModel = useCallback((m: string) => {
    setModel(m);
    localStorage.setItem("ollamatui_model", m);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("ollamatui_model");
    if (saved) setModel(saved);
  }, []);
  const [models, setModels] = useState<string[]>([]);
  const [streaming, setStreaming] = useState<AbortController | null>(null);
  const [selectingModel, setSelectingModel] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => { scrollBottom(); }, [lines]);

  const addLine = useCallback((line: Line) => {
    setLines(prev => [...prev, line]);
  }, []);

  const updateLastLine = useCallback((text: string) => {
    setLines(prev => {
      const next = [...prev];
      if (next.length > 0) {
        next[next.length - 1] = { ...next[next.length - 1], text };
      }
      return next;
    });
  }, []);

  const fetchModels = useCallback(async () => {
    addLine({ text: "Fetching available models...", isUser: false, isSystem: true });
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      if (data.type === "models") {
        setModels(data.data);
        addLine({ text: `Available models (${data.data.length}):`, isUser: false, isSystem: true });
        data.data.forEach((m: string, i: number) => {
          addLine({ text: `  [${i + 1}] ${m}`, isUser: false, isSystem: true });
        });
        addLine({ text: "Type a number to switch, or anything else to cancel.", isUser: false, isSystem: true });
        setSelectingModel(true);
      } else {
        addLine({ text: `Error: ${data.data}`, isUser: false, isSystem: true });
      }
    } catch (e: any) {
      addLine({ text: `Error fetching models: ${e.message}`, isUser: false, isSystem: true });
    }
  }, [addLine]);

  const handleStreamChat = useCallback(async (prompt: string) => {
    setLoading(true);
    const ctrl = new AbortController();
    setStreaming(ctrl);
    addLine({ text: "", isUser: false, isSystem: false });

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt }),
        signal: ctrl.signal,
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        updateLastLine(acc);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        updateLastLine(`[Error: ${e.message}]`);
      }
    } finally {
      setLoading(false);
      setStreaming(null);
    }
  }, [model, addLine, updateLastLine]);

  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setInput("");
    addLine({ text: `> ${trimmed}`, isUser: true });

    if (trimmed.startsWith("/")) {
      const parts = trimmed.slice(1).split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      switch (cmd) {
        case "help":
          addLine({ text: "Commands:", isUser: false, isSystem: true });
          addLine({ text: "  /help         Show this help", isUser: false, isSystem: true });
          addLine({ text: "  /models       List all models", isUser: false, isSystem: true });
          addLine({ text: "  /model <name> Switch active model", isUser: false, isSystem: true });
          addLine({ text: "  /info <model> Show model info", isUser: false, isSystem: true });
          addLine({ text: "  /clear        Clear terminal", isUser: false, isSystem: true });
          addLine({ text: "  /stop         Stop thinking", isUser: false, isSystem: true });
          addLine({ text: `  Current model: ${model}`, isUser: false, isSystem: true });
          break;
        case "models":
          if (args[0] && /^\d+$/.test(args[0])) {
            const idx = parseInt(args[0], 10) - 1;
            if (models[idx]) {
              setPersistentModel(models[idx]);
              addLine({ text: `Switched to model: ${models[idx]}`, isUser: false, isSystem: true });
            } else {
              addLine({ text: `Invalid index: ${args[0]}. Use /models to list models.`, isUser: false, isSystem: true });
            }
          } else if (args[0]) {
            setPersistentModel(args[0]);
            addLine({ text: `Switched to model: ${args[0]}`, isUser: false, isSystem: true });
          } else {
            fetchModels();
          }
          break;
        case "model":
          if (args[0]) {
            setPersistentModel(args[0]);
            addLine({ text: `Switched to model: ${args[0]}`, isUser: false, isSystem: true });
          } else {
            addLine({ text: `Current model: ${model}`, isUser: false, isSystem: true });
          }
          break;
        case "info": {
          const m = args[0] || model;
          addLine({ text: `Fetching info for: ${m}...`, isUser: false, isSystem: true });
          try {
            const res = await fetch("/api/model-info", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ model: m }),
            });
            const data = await res.json();
            if (data.type === "model_info") {
              addLine({ text: JSON.stringify(data.data, null, 2), isUser: false, isSystem: true });
            } else {
              addLine({ text: `Error: ${data.data}`, isUser: false, isSystem: true });
            }
          } catch (e: any) {
            addLine({ text: `Error: ${e.message}`, isUser: false, isSystem: true });
          }
          break;
        }
        case "clear":
          setLines([
            { text: "OllamaTUI v0.1 — Terminal UI for OllamaFreeAPI", isUser: false, isSystem: true },
            { text: "Terminal cleared.", isUser: false, isSystem: true },
            { text: "", isUser: false, isSystem: true },
          ]);
          break;
        case "stop":
          if (streaming) {
            streaming.abort();
            addLine({ text: "[Stopped]", isUser: false, isSystem: true });
          } else {
            addLine({ text: "No active stream to stop.", isUser: false, isSystem: true });
          }
          break;
        default:
          addLine({ text: `Unknown command: ${cmd}. Type /help`, isUser: false, isSystem: true });
      }
      return;
    }

    if (selectingModel) {
      setSelectingModel(false);
      if (/^\d+$/.test(trimmed)) {
        const idx = parseInt(trimmed, 10) - 1;
        if (models[idx]) {
          setPersistentModel(models[idx]);
          addLine({ text: `Switched to model: ${models[idx]}`, isUser: false, isSystem: true });
        } else {
          addLine({ text: `Invalid number. Use /models to list again.`, isUser: false, isSystem: true });
        }
      } else {
        addLine({ text: `Model selection cancelled.`, isUser: false, isSystem: true });
      }
      return;
    }

    await handleStreamChat(trimmed);
  }, [addLine, fetchModels, handleStreamChat, model, streaming, selectingModel, models, setPersistentModel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit(input);
    } else if (e.key === "Escape" && streaming) {
      e.preventDefault();
      streaming.abort();
      addLine({ text: "[Stopped]", isUser: false, isSystem: true });
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "#0c0c0c" }}>
      <div className="flex-none px-4 py-2 border-b border-[#33ff33]/30 text-sm opacity-70 flex items-center gap-4">
        <span className="font-bold">OllamaTUI</span>
        <span className="text-xs">
          Model: <span className="text-[#33ff33] font-bold">{model}</span>
        </span>
        {loading && <span className="text-xs animate-pulse">[thinking...]</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-words ${
              line.isSystem ? "opacity-70" : line.isUser ? "text-[#33ff33]" : "text-[#33ff33]"
            }`}
          >
            {line.text}
          </div>
        ))}
        {loading && (
          <span className="inline-block w-2 h-4 bg-[#33ff33] animate-pulse ml-1" />
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-none border-t border-[#33ff33]/30 px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="text-[#33ff33] shrink-0">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder={loading ? "Waiting for response..." : "Type a message or /help"}
            className="flex-1 bg-transparent border-none outline-none text-[#33ff33] placeholder-[#33ff33]/30 font-mono text-sm"
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
