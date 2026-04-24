import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

interface ResultCard {
  title: string;
  platform: string;
  price: string;
  condition: string;
  valueScore: number;
  savings: string;
  location: string;
}

interface SearchParams {
  item: string;
  budget: string;
  specs: string;
}

function buildSystemPrompt(searchParams: SearchParams | null, results: ResultCard[]): string {
  let prompt = `You are Scout, a friendly and sharp second-hand deal-hunting assistant. You help users find the best value on pre-owned items. Be concise (1-3 sentences max), helpful, and occasionally witty. Focus on practical buying advice.`;

  if (searchParams?.item) {
    prompt += `\n\nThe user is looking for: ${searchParams.item}`;
    if (searchParams.budget) prompt += `\nBudget: ${searchParams.budget}`;
    if (searchParams.specs) prompt += `\nRequirements: ${searchParams.specs}`;
  }

  if (results.length > 0) {
    prompt += `\n\nSearch results shown to user:\n`;
    results.forEach((r, i) => {
      prompt += `${i + 1}. ${r.title} — ${r.price} (${r.valueScore}% deal score, ${r.condition}, ${r.platform}, ${r.location})\n`;
    });
    prompt += `\nHelp the user evaluate these results, negotiate prices, or refine their search.`;
  }

  return prompt;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, searchParams, results } = await req.json();

    const systemPrompt = buildSystemPrompt(searchParams, results ?? []);

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const reply = textBlock && textBlock.type === "text" ? textBlock.text : "Sorry, I couldn't generate a response.";

    return NextResponse.json({ reply });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Claude API error:", message);
    return NextResponse.json({ reply: `API error: ${message}` }, { status: 500 });
  }
}
