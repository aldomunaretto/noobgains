import { NextResponse } from "next/server";
import { getWeightSuggestion } from "@/lib/progression";

export async function GET(_request: Request, { params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  const id = Number(exerciseId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "exerciseId inválido" }, { status: 400 });
  }

  const suggestion = await getWeightSuggestion(id);
  return NextResponse.json(suggestion);
}
