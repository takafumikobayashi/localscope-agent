import { NextRequest, NextResponse } from "next/server";
import { getWordFrequencies } from "@/lib/db/analytics";

export async function GET(req: NextRequest) {
  const municipalityId = req.nextUrl.searchParams.get("municipalityId");

  if (!municipalityId) {
    return NextResponse.json(
      { error: "municipalityId is required" },
      { status: 400 },
    );
  }

  const words = await getWordFrequencies(municipalityId, 200);
  return NextResponse.json(words);
}
