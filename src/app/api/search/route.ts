import { NextRequest, NextResponse } from "next/server";

interface MarktplaatsListing {
  title?: string;
  priceInfo?: { priceCents?: number };
  vipUrl?: string;
  pictures?: { mediumUrl?: string; extraSmallUrl?: string }[];
  location?: { cityName?: string };
  attributes?: Array<{ key?: string; value?: string }>;
}

type Condition = "Excellent" | "Very Good" | "Good";

function inferCondition(attributes: Array<{ key?: string; value?: string }> = []): Condition {
  const condAttr = attributes.find((a) => {
    const k = (a.key ?? "").toLowerCase();
    return k.includes("conditie") || k.includes("condition") || k.includes("staat");
  });
  if (!condAttr?.value) return "Good";
  const val = condAttr.value.toLowerCase();
  if (
    val.includes("nieuw") ||
    val.includes("uitstekend") ||
    val.includes("excellent") ||
    val.includes("zo goed als nieuw")
  )
    return "Excellent";
  if (val.includes("zeer goed") || val.includes("very good") || val.includes("goed")) return "Very Good";
  return "Good";
}

export async function POST(req: NextRequest) {
  try {
    const { item, budget, specs } = await req.json();

    const budgetNum = parseInt(String(budget).replace(/[^0-9]/g, "")) || 500;
    const queryParts = [item, specs].filter((s) => s && String(s).toLowerCase() !== "any");
    const query = queryParts.join(" ").trim() || String(item);

    const url = new URL("https://www.marktplaats.nl/lrp/api/search");
    url.searchParams.set("query", query);
    url.searchParams.set("searchInTitleAndDescription", "true");
    url.searchParams.set("viewOptions", "list-view");
    url.searchParams.set("limit", "10");
    url.searchParams.append("attributeRanges[]", `PriceCents:0:${budgetNum * 100}`);

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Marktplaats returned ${response.status}`, results: [] },
        { status: 502 }
      );
    }

    const data = await response.json();
    const listings: MarktplaatsListing[] = data.listings ?? [];

    const results = listings.slice(0, 6).map((listing) => {
      const priceEur = (listing.priceInfo?.priceCents ?? 0) / 100;
      const savingsEur = Math.round(budgetNum - priceEur);
      const ratio = priceEur > 0 ? priceEur / budgetNum : 0.5;
      const valueScore = Math.min(95, Math.max(40, Math.round((1 - ratio) * 60 + 40)));

      return {
        title: listing.title ?? "Unknown listing",
        platform: "Marktplaats",
        price: `€${priceEur.toFixed(0)}`,
        condition: inferCondition(listing.attributes),
        valueScore,
        savings: savingsEur > 0 ? `€${savingsEur} under budget` : "At budget",
        location: listing.location?.cityName ?? "Netherlands",
        link: listing.vipUrl ? `https://www.marktplaats.nl${listing.vipUrl}` : undefined,
        image: listing.pictures?.[0]?.extraSmallUrl ?? listing.pictures?.[0]?.mediumUrl,
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Marktplaats search error:", message);
    return NextResponse.json({ error: message, results: [] }, { status: 500 });
  }
}
