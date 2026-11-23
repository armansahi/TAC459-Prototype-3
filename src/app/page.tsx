"use client";

import { useEffect, useRef, useState } from "react";
import { Brief, emptyBrief, toMarkdown } from "@/lib/brief";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "Hi, I'm Contrario's intake assistant. Tell me about the role you're hiring for, messy notes are fine. Who do you need, and what should they own?";

const EXAMPLE =
  "We're Lumen, a 12-person seed-stage startup building AI note-taking for clinicians. I need a founding senior full-stack engineer in SF. They'd own our EHR integrations. We need someone strong, ideally from a healthtech or dev-tools company.";

function List({ title, items, tone = "default" }: { title: string; items: string[]; tone?: "default" | "danger" }) {
  if (!items.length) return null;
  return (
    <section className="mb-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((i, k) => (
          <li key={k} className="flex gap-2 text-sm leading-snug">
            <span className={tone === "danger" ? "text-red-500" : "text-stone-400"}>{tone === "danger" ? "✕" : "•"}</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [brief, setBrief] = useState<Brief>(emptyBrief);
  const [completeness, setCompleteness] = useState(0);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setMessages([...next, { role: "assistant", content: data.message }]);
      setBrief(data.brief);
      setCompleteness(data.completeness);
      setReady(data.ready);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function download(includeInternal: boolean) {
    const blob = new Blob([toMarkdown(brief, includeInternal)], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(brief.roleTitle || "role-brief").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copy() {
    await navigator.clipboard.writeText(toMarkdown(brief, true));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const hasBrief = brief.roleTitle || brief.mustHaves.length || brief.scorecard.length;

  return (
    <div className="h-screen flex flex-col">
      <header className="px-6 py-3 border-b border-stone-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="font-semibold">Founder Intake</h1>
          <p className="text-xs text-stone-500">Turn a founder conversation into a role brief and 100-point scorecard</p>
        </div>
        <span className="text-xs text-stone-400">TAC 459 · Prototype 3 · student prototype, not affiliated with Contrario</span>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0">
        {/* Chat */}
        <div className="flex flex-col min-h-0 border-r border-stone-200">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <Bubble role="assistant" text={GREETING} />
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.content} />
            ))}
            {loading && <Bubble role="assistant" text="Thinking…" muted />}
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
            <div ref={endRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="p-4 border-t border-stone-200 bg-white space-y-2"
          >
            {messages.length === 0 && (
              <button type="button" onClick={() => setInput(EXAMPLE)} className="text-xs text-stone-500 underline underline-offset-2">
                Use an example founder message
              </button>
            )}
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={2}
                placeholder="Describe the role, answer the question…"
                className="flex-1 resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
              <button
                disabled={loading || !input.trim()}
                className="rounded-lg bg-stone-900 text-white px-4 text-sm font-medium disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </form>
        </div>

        {/* Brief */}
        <div className="flex flex-col min-h-0 bg-white">
          <div className="px-6 py-3 border-b border-stone-200 flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-stone-500 mb-1">
                <span>Brief completeness</span>
                <span>{completeness}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-stone-100">
                <div className="h-1.5 rounded-full bg-stone-900 transition-all" style={{ width: `${completeness}%` }} />
              </div>
            </div>
            <button onClick={copy} disabled={!hasBrief} className="text-xs rounded-md border border-stone-300 px-2.5 py-1.5 disabled:opacity-40">
              {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={() => download(false)} disabled={!hasBrief} className="text-xs rounded-md border border-stone-300 px-2.5 py-1.5 disabled:opacity-40">
              Download shareable .md
            </button>
            <button onClick={() => download(true)} disabled={!ready} className="text-xs rounded-md bg-stone-900 text-white px-2.5 py-1.5 disabled:opacity-40">
              Download full .md
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {!hasBrief ? (
              <p className="text-sm text-stone-400">The brief builds here as you talk.</p>
            ) : (
              <>
                <h2 className="text-xl font-semibold">{brief.roleTitle || "Untitled role"}</h2>
                <p className="text-sm text-stone-500 mb-4">{[brief.company, brief.level, brief.location].filter(Boolean).join(" · ")}</p>
                {brief.summary && <p className="text-sm mb-5 leading-relaxed">{brief.summary}</p>}
                <List title="Must-haves" items={brief.mustHaves} />
                <List title="Nice-to-haves" items={brief.niceToHaves} />
                <List title="Dealbreakers" items={brief.dealbreakers} tone="danger" />
                {brief.compensation && (
                  <section className="mb-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Compensation</h3>
                    <p className="text-sm">{brief.compensation}</p>
                  </section>
                )}
                <List title="Why candidates say yes" items={brief.sellingPoints} />

                {brief.scorecard.length > 0 && (
                  <section className="mb-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Scorecard · 100 points</h3>
                    <div className="rounded-lg border border-stone-200 divide-y divide-stone-200">
                      {brief.scorecard.map((c, i) => (
                        <div key={i} className="p-3 flex gap-3">
                          <span className="text-sm font-semibold w-10 shrink-0">{c.weight}</span>
                          <div>
                            <p className="text-sm font-medium">{c.criterion}</p>
                            <p className="text-xs text-stone-500 mt-0.5">{c.fullMarks}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-stone-500 mt-2">75+ Good fit · 55–74 Possible fit · under 55 Not a fit</p>
                  </section>
                )}

                {brief.internalNotes.length > 0 && (
                  <section className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-2">Internal · never shared with candidates</h3>
                    <ul className="space-y-1 text-sm text-amber-900">
                      {brief.internalNotes.map((n, i) => (
                        <li key={i}>• {n}</li>
                      ))}
                    </ul>
                  </section>
                )}
                <List title="Still to confirm" items={brief.openQuestions} />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Bubble({ role, text, muted }: { role: "user" | "assistant"; text: string; muted?: boolean }) {
  const user = role === "user";
  return (
    <div className={`flex ${user ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          user ? "bg-stone-900 text-white" : "bg-white border border-stone-200"
        } ${muted ? "text-stone-400 italic" : ""}`}
      >
        {text}
      </div>
    </div>
  );
}
