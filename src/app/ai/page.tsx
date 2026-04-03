"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";
import { handleAiQuery, type AiResult, type ChatMessage } from "@/lib/aiEngine";

// ─── Tez savollar strukturasi ─────────────────────────────────────────────────

type QuickSection = {
  key: string;
  label: string;
  emoji: string;
  questions: { label: string; query: string }[];
};

const SECTIONS: QuickSection[] = [
  {
    key: "savdo",
    label: "Savdo",
    emoji: "💰",
    questions: [
      { label: "Bu oy savdo", query: "bu oy savdo hisoboti" },
      { label: "Bugungi savdo", query: "bugun savdo" },
      { label: "O'tgan hafta", query: "o'tgan hafta savdo" },
      { label: "Bu yil tushum", query: "bu yil savdo" },
      { label: "Do'konlar bo'yicha", query: "bu oy do'konlar bo'yicha savdo" },
    ],
  },
  {
    key: "mahsulot",
    label: "Mahsulotlar",
    emoji: "📦",
    questions: [
      { label: "Eng ko'p sotilgan", query: "bu oy eng ko'p sotilgan mahsulotlar" },
      { label: "Mahsulot bo'yicha savdo", query: "bu oy mahsulot bo'yicha savdo" },
      { label: "Kam zaxiradagilar", query: "kam qolgan mahsulotlar" },
      { label: "O'tgan oy top", query: "o'tgan oy eng ko'p sotilgan mahsulotlar" },
    ],
  },
  {
    key: "transfer",
    label: "Transfer",
    emoji: "🚚",
    questions: [
      { label: "Bu oy transferlar", query: "bu oy transfer hisoboti" },
      { label: "Bugungi transferlar", query: "bugun transfer" },
      { label: "O'tgan oy", query: "o'tgan oy transfer" },
      { label: "Bu hafta", query: "bu hafta transfer" },
    ],
  },
  {
    key: "qaytarish",
    label: "Qaytarish",
    emoji: "↩️",
    questions: [
      { label: "Bu oy qaytarishlar", query: "bu oy qaytarish hisoboti" },
      { label: "Bugun qaytarishlar", query: "bugun qaytarish" },
      { label: "O'tgan oy", query: "o'tgan oy qaytarish" },
      { label: "Mahsulot bo'yicha", query: "bu oy mahsulot bo'yicha qaytarish" },
    ],
  },
  {
    key: "moliya",
    label: "Moliya",
    emoji: "📊",
    questions: [
      { label: "Sof foyda (bu oy)", query: "bu oy sof foyda" },
      { label: "Xarajatlar (bu oy)", query: "bu oy xarajatlar" },
      { label: "O'tgan oy foyda", query: "o'tgan oy sof foyda" },
      { label: "Bu yil foyda", query: "bu yil sof foyda" },
    ],
  },
];

// Placeholder misollari — input'da almashinib ko'rsatiladi
const PLACEHOLDER_EXAMPLES = [
  "bu oy savdo qancha?",
  "eng ko'p sotilgan mahsulotlar",
  "bugungi tushum",
  "o'tgan hafta transferlar",
  "sof foyda bu oy",
  "kam zaxiradagi mahsulotlar",
  "fevral oyi savdo",
  "bu yil xarajatlar",
];

// ─── Chat message ─────────────────────────────────────────────────────────────

type Message = {
  id: number;
  role: "user" | "ai";
  text: string;
  table?: AiResult["table"];
  loading?: boolean;
};

// ─── Komponent ────────────────────────────────────────────────────────────────

export default function AiPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "ai",
      text:
        "Salom! Men sizning ERP yordamchingizman.\n\nQuyidagi bo'limlardan savol tanlang yoki o'zingiz yozing. Masalan:\n• «bu oy savdo», «bugungi tushum»\n• «eng ko'p sotilgan mahsulotlar»\n• «sof foyda», «xarajatlar»",
    },
  ]);
  const [activeSection, setActiveSection] = useState<string>("savdo");
  const [inputText, setInputText] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgIdRef = useRef(1);

  // Placeholder almashinishi
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_EXAMPLES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Yangi xabar kelganda scroll pastga
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (authLoading) return;
    if (user?.role !== "ADMIN") {
      router.replace("/");
    }
  }, [authLoading, router, user?.role]);

  if (authLoading || user?.role !== "ADMIN") {
    return null;
  }

  async function sendQuery(query: string) {
    if (!query.trim() || loading) return;

    const userMsgId = msgIdRef.current++;
    const aiMsgId = msgIdRef.current++;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text: query.trim() },
      { id: aiMsgId, role: "ai", text: "...", loading: true },
    ]);
    setInputText("");
    setLoading(true);

    try {
      const result = await handleAiQuery(query.trim(), chatHistory);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, text: result.text, table: result.table, loading: false }
            : m
        )
      );
      // Chat history ni yangilash (max 10 ta xabar saqlaymiz)
      setChatHistory((prev) => {
        const updated: ChatMessage[] = [
          ...prev,
          { role: "user", content: query.trim() },
          { role: "assistant", content: result.text },
        ];
        return updated.slice(-20);
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, text: "❌ Xatolik yuz berdi. Qayta urining.", loading: false }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendQuery(inputText);
  }

  const currentSection = SECTIONS.find((s) => s.key === activeSection) ?? SECTIONS[0];

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-3 lg:h-[calc(100vh-7rem)]">
      {/* Sarlavha */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-berry-700 text-white shadow-glow-sm">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path
              d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5V11h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h1V9.5A4 4 0 0 1 8 6a4 4 0 0 1 4-4z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M10 14h4M10 17h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-cocoa-900">AI Yordamchi</h1>
          <p className="text-xs text-cocoa-500">Savol bering — hisobot oling</p>
        </div>
      </div>

      <div className="flex flex-1 gap-3 overflow-hidden">
        {/* Chap: Bo'limlar + savollar */}
        <div className="flex w-52 shrink-0 flex-col gap-2 lg:w-60">
          {/* Bo'lim tugmalari */}
          <Card className="p-2">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-cocoa-500">
              Bo'limlar
            </p>
            <div className="flex flex-col gap-1">
              {SECTIONS.map((section) => (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    activeSection === section.key
                      ? "bg-berry-700 text-white shadow-glow-sm"
                      : "text-cocoa-700 hover:bg-cream-100"
                  }`}
                >
                  <span>{section.emoji}</span>
                  <span>{section.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Tez savollar */}
          <Card className="flex-1 overflow-y-auto p-2">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-cocoa-500">
              Tez savollar
            </p>
            <div className="flex flex-col gap-1">
              {currentSection.questions.map((q) => (
                <button
                  key={q.query}
                  onClick={() => sendQuery(q.query)}
                  disabled={loading}
                  className="flex items-start gap-2 rounded-lg px-3 py-2 text-left text-sm text-cocoa-700 transition-all hover:bg-berry-50 hover:text-berry-800 disabled:opacity-50"
                >
                  <span className="mt-0.5 text-berry-600">›</span>
                  <span>{q.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* O'ng: Chat */}
        <div className="flex flex-1 flex-col gap-2 overflow-hidden">
          {/* Xabarlar */}
          <Card className="flex-1 overflow-y-auto p-3 sm:p-4">
            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "rounded-br-sm bg-berry-700 text-white"
                        : "rounded-bl-sm border border-cream-200 bg-cream-50 text-cocoa-800"
                    }`}
                  >
                    {msg.loading ? (
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cocoa-400 [animation-delay:0ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cocoa-400 [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cocoa-400 [animation-delay:300ms]" />
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        {msg.table && (
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr>
                                  {msg.table.headers.map((h) => (
                                    <th
                                      key={h}
                                      className="border-b border-cream-200 pb-1.5 text-left font-semibold text-cocoa-600"
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {msg.table.rows.map((row, ri) => (
                                  <tr key={ri} className={ri % 2 === 0 ? "" : "bg-cream-50/50"}>
                                    {row.map((cell, ci) => (
                                      <td
                                        key={ci}
                                        className="py-1.5 pr-3 text-cocoa-800"
                                      >
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </Card>

          {/* Input */}
          <Card className="p-2 sm:p-3">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Masalan: "${PLACEHOLDER_EXAMPLES[placeholderIdx]}"`}
                disabled={loading}
                className="flex-1 rounded-xl border border-cream-200/70 bg-cream-50/80 px-4 py-2.5 text-sm text-cocoa-900 placeholder:text-cocoa-400 transition focus:border-berry-300 focus:outline-none focus:ring-2 focus:ring-berry-200/70 disabled:opacity-60"
              />
              <Button
                type="submit"
                disabled={!inputText.trim() || loading}
                className="shrink-0"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                  <path
                    d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="hidden sm:inline">Yuborish</span>
              </Button>
            </form>
            <p className="mt-1.5 px-1 text-[11px] text-cocoa-400">
              Sana yozing: «bu oy», «bugun», «o'tgan hafta», «yanvar», «2025-yil»
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
