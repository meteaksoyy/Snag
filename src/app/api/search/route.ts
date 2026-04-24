export const runtime = "nodejs";

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Schemas ───────────────────────────────────────────────────────────────────

interface WishlistAttributes {
  category: string;
  color: string | null;
  budget_max: number;
  budget_min: number;
  condition_pref: string;
  tags: string[];
}

interface RawListing {
  id: string;
  title: string;
  price: number;
  description: string;
  image_url: string;
  category: string;
  color: string;
  tags: string[];
  condition: "Excellent" | "Very Good" | "Good";
  location: string;
  platform: string;
}

interface RankedListing extends RawListing {
  similarity_score: number;
  deal_score: number;
  savings: string;
}

// ── Mock listings dataset (mirrors backend/agent.py) ─────────────────────────

function getMockListings(): RawListing[] {
  return [
    { id: "1",  title: "Trek Marlin 7 MTB 29er Matte Black",   price: 499, description: "Hardtail mountain bike, disc brakes, 29er wheels, Shimano Deore drivetrain, barely used.",           image_url: "https://picsum.photos/seed/bike1/400/300",  category: "bike",  color: "matte black",  tags: ["mountain","hardtail","disc","shimano","29er"],    condition: "Excellent", location: "Amsterdam", platform: "Marktplaats" },
    { id: "2",  title: "Giant Talon 3 Mountain Bike 2022",      price: 380, description: "Great all-round MTB, aluminium frame, front suspension, 27.5\" wheels, minor scratches.",            image_url: "https://picsum.photos/seed/bike2/400/300",  category: "bike",  color: "dark grey",    tags: ["mountain","suspension","aluminium"],              condition: "Very Good", location: "Rotterdam", platform: "2dehands.be" },
    { id: "3",  title: "Specialized Rockhopper Comp Matte",     price: 520, description: "Hardtail MTB, 29er, matte finish, hydraulic disc brakes, 1x drivetrain.",                           image_url: "https://picsum.photos/seed/bike3/400/300",  category: "bike",  color: "matte olive",  tags: ["mountain","hardtail","hydraulic","29er"],         condition: "Excellent", location: "Utrecht",   platform: "Marktplaats" },
    { id: "4",  title: "Trek FX3 City Bike Matte Black",        price: 410, description: "Lightweight city/fitness bike, matte black finish, disc brakes, clean condition.",                  image_url: "https://picsum.photos/seed/bike4/400/300",  category: "bike",  color: "matte black",  tags: ["city","fitness","disc","lightweight"],            condition: "Very Good", location: "Den Haag",  platform: "eBay.nl" },
    { id: "5",  title: "Canyon Exceed CF SL MTB Carbon",        price: 890, description: "Carbon hardtail XC race bike, top spec components, SRAM Eagle 12-speed.",                          image_url: "https://picsum.photos/seed/bike5/400/300",  category: "bike",  color: "matte carbon", tags: ["mountain","carbon","xc","race","sram"],           condition: "Excellent", location: "Eindhoven", platform: "Marktplaats" },
    { id: "6",  title: "Gazelle Miss Grace E-bike",             price: 750, description: "Electric city bike, 7-speed, pearl white, perfect for commuting, 60km range.",                     image_url: "https://picsum.photos/seed/bike6/400/300",  category: "bike",  color: "pearl white",  tags: ["electric","city","commute"],                     condition: "Good",      location: "Groningen", platform: "2dehands.be" },
    { id: "7",  title: "Cannondale Trail 8 Hardtail MTB",       price: 340, description: "Jet black hardtail, Shimano 3x8 drivetrain, mechanical disc brakes, some scuffs.",                 image_url: "https://picsum.photos/seed/bike7/400/300",  category: "bike",  color: "jet black",    tags: ["mountain","hardtail","shimano"],                  condition: "Good",      location: "Breda",     platform: "Marktplaats" },
    { id: "8",  title: "Scott Aspect 950 Mountain Bike",        price: 295, description: "Entry MTB, black/red colourway, front suspension, good for trails.",                               image_url: "https://picsum.photos/seed/bike8/400/300",  category: "bike",  color: "black/red",    tags: ["mountain","suspension","trails"],                 condition: "Good",      location: "Tilburg",   platform: "eBay.nl" },
    { id: "9",  title: "Cube Aim Pro Hardtail MTB",             price: 450, description: "Matte black hardtail, 29er, Shimano Acera, hydraulic discs, excellent shape.",                     image_url: "https://picsum.photos/seed/bike9/400/300",  category: "bike",  color: "matte black",  tags: ["mountain","hardtail","29er","hydraulic","cube"],  condition: "Very Good", location: "Haarlem",   platform: "2dehands.be" },
    { id: "10", title: "Trek Roscoe 8 Fat Bike Matte",          price: 560, description: "Matte purple fat bike, 27.5+ wheels, great for sand and rough terrain.",                           image_url: "https://picsum.photos/seed/bike10/400/300", category: "bike",  color: "matte purple", tags: ["fat","beach","terrain"],                          condition: "Very Good", location: "Zwolle",    platform: "Marktplaats" },
    { id: "11", title: "iPhone 13 Pro 128GB",                   price: 650, description: "Graphite colour, excellent condition, original box, Face ID works perfectly.",                     image_url: "https://picsum.photos/seed/phone1/400/300", category: "phone", color: "graphite",     tags: ["apple","ios","128gb"],                            condition: "Excellent", location: "Amsterdam", platform: "Marktplaats" },
    { id: "12", title: "Batavus Dinsdag City Bike 7sp",         price: 220, description: "Classic Dutch city bike, matte grey, 7-speed, kickstand, rear carrier included.",                  image_url: "https://picsum.photos/seed/bike12/400/300", category: "bike",  color: "matte grey",   tags: ["city","dutch","7speed","carrier"],                condition: "Good",      location: "Leiden",    platform: "eBay.nl" },
  ];
}

// ── Step A: Parse wishlist with Claude vision ─────────────────────────────────

async function parseWishlistWithClaude(
  item: string,
  budget: string,
  specs: string,
  imageBase64?: string,
): Promise<WishlistAttributes> {
  const prompt = `Extract buyer intent from this marketplace search request.

Item: "${item}"
Budget: "${budget}"
Additional specs: "${specs}"

Return ONLY a JSON object with these exact fields (no markdown, no explanation):
{
  "category": one of [bike, phone, laptop, camera, tv, console, headphones, any],
  "color": color preference as a lowercase string or null,
  "budget_max": numeric max budget in euros (default 500 if unclear),
  "budget_min": numeric min budget in euros (default 0),
  "condition_pref": one of [any, Excellent, Very Good, Good],
  "tags": array of relevant search keywords (e.g. ["mountain", "hardtail", "disc"])
}`;

  const content: Anthropic.MessageParam["content"] = [];

  if (imageBase64) {
    const match = imageBase64.match(/^data:(image\/\w+);base64,([\s\S]+)$/);
    if (match) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: match[2],
        },
      });
    }
  }

  content.push({ type: "text", text: prompt });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON found");
    return JSON.parse(jsonMatch[0]) as WishlistAttributes;
  } catch {
    // Fallback: parse budget numerically from the raw string
    const budgetNum = parseFloat(budget.replace(/[^0-9.]/g, "")) || 500;
    return {
      category: "any",
      color: null,
      budget_max: budgetNum,
      budget_min: 0,
      condition_pref: "any",
      tags: item.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
    };
  }
}

// ── Step B: Tier 1 hard metadata filter ──────────────────────────────────────

function tier1Filter(listings: RawListing[], attrs: WishlistAttributes): RawListing[] {
  return listings.filter((l) => {
    if (attrs.category !== "any" && l.category !== attrs.category) return false;
    if (l.price > attrs.budget_max) return false;
    if (l.price < attrs.budget_min) return false;
    return true;
  });
}

// ── Step C: Batched Claude scoring (Tier 2 text + Tier 3 visual) ──────────────

interface ScoreEntry { id: string; text_score: number; visual_score: number; }

async function scoreListingsWithClaude(
  listings: RawListing[],
  attrs: WishlistAttributes,
  imageBase64?: string,
): Promise<ScoreEntry[]> {
  const listingsSummary = listings.map((l) => ({
    id: l.id,
    title: l.title,
    description: l.description,
    color: l.color,
    tags: l.tags,
    condition: l.condition,
  }));

  const prompt = `You are scoring second-hand marketplace listings for a buyer.

BUYER WISHLIST:
- Category: ${attrs.category}
- Color preference: ${attrs.color ?? "any"}
- Condition preference: ${attrs.condition_pref}
- Keywords: ${attrs.tags.join(", ")}
${imageBase64 ? "- The buyer also attached a reference photo of what they want." : ""}

LISTINGS TO SCORE:
${JSON.stringify(listingsSummary, null, 2)}

For each listing return a JSON array (no markdown, just the array):
[{ "id": "1", "text_score": 0.85, "visual_score": 0.70 }, ...]

text_score  = 0.0–1.0 semantic match between buyer wishlist and listing title/description/tags.
visual_score = 0.0–1.0 visual match to the reference photo (use 0.5 if no photo was provided).

Return ONLY the JSON array.`;

  const content: Anthropic.MessageParam["content"] = [];

  if (imageBase64) {
    const match = imageBase64.match(/^data:(image\/\w+);base64,([\s\S]+)$/);
    if (match) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: match[2],
        },
      });
    }
  }

  content.push({ type: "text", text: prompt });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("no JSON array in response");
    return JSON.parse(jsonMatch[0]) as ScoreEntry[];
  } catch {
    // Neutral fallback scores so the demo always completes
    return listings.map((l) => ({ id: l.id, text_score: 0.5, visual_score: 0.5 }));
  }
}

// ── Step D: Deal score calculation ───────────────────────────────────────────

function computeDealScore(listing: RawListing, combined: number, attrs: WishlistAttributes): number {
  const priceSavingsPct = attrs.budget_max > 0
    ? Math.max(0, 1 - listing.price / attrs.budget_max)
    : 0;
  return Math.min(100, Math.round(combined * 60 + priceSavingsPct * 40));
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { item, budget, specs, imageBase64 } = body as {
      item: string;
      budget: string;
      specs: string;
      imageBase64?: string;
    };

    if (!item || !budget) {
      return NextResponse.json({ error: "item and budget are required" }, { status: 400 });
    }

    // Step A: parse wishlist
    const attrs = await parseWishlistWithClaude(item, budget, specs ?? "", imageBase64);

    // Step B: tier 1 filter
    const allListings = getMockListings();
    const survivors = tier1Filter(allListings, attrs);

    if (survivors.length === 0) {
      return NextResponse.json({ results: [], wishlist: attrs });
    }

    // Step C: score with Claude
    const scores = await scoreListingsWithClaude(survivors, attrs, imageBase64);
    const scoreMap = new Map(scores.map((s) => [s.id, s]));

    // Step D: compute final scores and sort
    const results: RankedListing[] = survivors.map((listing) => {
      const s = scoreMap.get(listing.id) ?? { text_score: 0.5, visual_score: 0.5 };
      const combined = imageBase64
        ? s.text_score * 0.6 + s.visual_score * 0.4
        : s.text_score;
      const deal_score = computeDealScore(listing, combined, attrs);
      const savedAmount = Math.max(0, Math.round(attrs.budget_max - listing.price));
      return {
        ...listing,
        similarity_score: Math.round(combined * 1000) / 1000,
        deal_score,
        savings: savedAmount > 0 ? `Save €${savedAmount} vs budget` : "At budget limit",
      };
    });

    results.sort((a, b) => b.similarity_score - a.similarity_score);

    return NextResponse.json({ results, wishlist: attrs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
