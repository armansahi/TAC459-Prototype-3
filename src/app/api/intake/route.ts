import { z } from "zod";
import { TurnSchema, normalizeScorecard } from "@/lib/brief";

const MODEL = process.env.GROK_MODEL ?? "grok-4.7";
const BASE_URL = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";

const SYSTEM = `You are the intake interviewer for Contrario, a recruiting network that pairs expert recruiters with AI. A startup founder is telling you about a role they want to fill. Your job is to turn the conversation into a precise role brief and a 100-point scorecard that recruiters will use to source and screen candidates.

How to interview:
- Ask ONE question per turn, in a friendly, direct tone. Keep each message under 60 words.
- If an answer is vague ("strong engineer", "great culture fit"), push for something observable: a company they would poach from, a project the person would have shipped, a number.
- Cover, in roughly this order: what the person will own in 90 days, must-haves, dealbreakers, compensation and location, why a great candidate would say yes, and what is confidential.
- Anything the founder says should not be shared with candidates or recruiters (comp bands they will flex, a team conflict, a backfill) goes in internalNotes, never in the shareable sections.
- NEVER invent facts. If something has not been said, leave the field empty and add a short item to openQuestions.
- Once you know enough, propose 4-5 scorecard criteria whose weights sum to exactly 100, each with a concrete description of what earns full marks. Fixed verdicts: 75+ Good fit, 55-74 Possible fit, under 55 Not a fit.
- Set ready=true only when roleTitle, at least 3 mustHaves, compensation, and a complete scorecard exist. When ready, your message should summarise what you built and invite edits.

Every turn you MUST call the intake_turn function with the FULL current brief (not a diff), your next message to the founder, a completeness score 0-100, and the ready flag.`;

const stringList = { type: "array", items: { type: "string" } };

const TOOL = {
  type: "function" as const,
  function: {
  name: "intake_turn",
  description: "Return the next message to the founder together with the full, updated role brief.",
  parameters: {
    type: "object",
    properties: {
      message: { type: "string", description: "Next message to show the founder." },
      completeness: { type: "number", description: "0-100, how complete the brief is." },
      ready: { type: "boolean" },
      brief: {
        type: "object",
        properties: {
          roleTitle: { type: "string" },
          company: { type: "string" },
          level: { type: "string" },
          location: { type: "string" },
          summary: { type: "string" },
          mustHaves: stringList,
          niceToHaves: stringList,
          dealbreakers: stringList,
          compensation: { type: "string" },
          sellingPoints: stringList,
          scorecard: {
            type: "array",
            items: {
              type: "object",
              properties: {
                criterion: { type: "string" },
                weight: { type: "number" },
                fullMarks: { type: "string" },
              },
              required: ["criterion", "weight", "fullMarks"],
            },
          },
          internalNotes: stringList,
          openQuestions: stringList,
        },
        required: ["roleTitle", "mustHaves", "scorecard", "internalNotes", "openQuestions"],
      },
    },
    required: ["message", "brief", "completeness", "ready"],
  },
  },
};

const BodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) }))
    .min(1)
    .max(60),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages[0].role !== "user") {
    return Response.json({ error: "Send a non-empty messages array that starts with a user message." }, { status: 400 });
  }
  if (!process.env.XAI_API_KEY) {
    return Response.json(
      { error: "XAI_API_KEY is not set. Copy .env.example to .env.local and add your Grok key." },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.XAI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM }, ...parsed.data.messages],
        tools: [TOOL],
        tool_choice: "required",
      }),
    });
    if (!res.ok) throw new Error(`Grok API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("Model returned no structured turn.");
    const turn = TurnSchema.parse(JSON.parse(args));
    return Response.json({ ...turn, brief: normalizeScorecard(turn.brief) });
  } catch (err) {
    console.error("intake error", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 502 });
  }
}
