import { NextResponse } from "next/server";
import { getWordFrequencies } from "@/lib/db/analytics";

export async function GET() {
  const words = await getWordFrequencies(200);
  return NextResponse.json(words);
}
