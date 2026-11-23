import { z } from "zod";

export const ScoreCriterion = z.object({
  criterion: z.string(),
  weight: z.number(),
  fullMarks: z.string(),
});

export const BriefSchema = z.object({
  roleTitle: z.string().default(""),
  company: z.string().default(""),
  level: z.string().default(""),
  location: z.string().default(""),
  summary: z.string().default(""),
  mustHaves: z.array(z.string()).default([]),
  niceToHaves: z.array(z.string()).default([]),
  dealbreakers: z.array(z.string()).default([]),
  compensation: z.string().default(""),
  sellingPoints: z.array(z.string()).default([]),
  scorecard: z.array(ScoreCriterion).default([]),
  internalNotes: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
});

export type Brief = z.infer<typeof BriefSchema>;

export const TurnSchema = z.object({
  message: z.string(),
  brief: BriefSchema,
  completeness: z.number().min(0).max(100).default(0),
  ready: z.boolean().default(false),
});

export type Turn = z.infer<typeof TurnSchema>;

export const emptyBrief: Brief = BriefSchema.parse({});

/** Scorecard weights must total 100 (same 100-point scale as the recruiter scorecard). */
export function normalizeScorecard(brief: Brief): Brief {
  const total = brief.scorecard.reduce((s, c) => s + c.weight, 0);
  if (brief.scorecard.length === 0 || total === 100 || total <= 0) return brief;
  const scaled = brief.scorecard.map((c) => ({
    ...c,
    weight: Math.round((c.weight / total) * 100),
  }));
  const drift = 100 - scaled.reduce((s, c) => s + c.weight, 0);
  scaled[0].weight += drift;
  return { ...brief, scorecard: scaled };
}

const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n") || "- _not provided_";

/** Markdown brief. Internal notes are included only when asked, mirroring Prototype 1's INTERNAL stripping. */
export function toMarkdown(b: Brief, includeInternal: boolean): string {
  const rows = b.scorecard
    .map((c) => `| ${c.criterion} | ${c.weight} | ${c.fullMarks} |`)
    .join("\n");
  const parts = [
    `# ${b.roleTitle || "Untitled role"}${b.company ? ` at ${b.company}` : ""}`,
    [b.level, b.location].filter(Boolean).join(" · "),
    `## Summary\n${b.summary || "_not provided_"}`,
    `## Must-haves\n${list(b.mustHaves)}`,
    `## Nice-to-haves\n${list(b.niceToHaves)}`,
    `## Dealbreakers\n${list(b.dealbreakers)}`,
    `## Compensation\n${b.compensation || "_not provided_"}`,
    `## Why candidates say yes\n${list(b.sellingPoints)}`,
    `## Scorecard (100 points)\n| Criterion | Points | What earns full marks |\n|---|---|---|\n${rows}\n\n**Verdict:** 75+ Good fit · 55–74 Possible fit · under 55 Not a fit`,
  ];
  if (includeInternal) parts.push(`## INTERNAL (do not share with candidates)\n${list(b.internalNotes)}`);
  if (b.openQuestions.length) parts.push(`## Still to confirm with the founder\n${list(b.openQuestions)}`);
  return parts.filter(Boolean).join("\n\n") + "\n";
}
