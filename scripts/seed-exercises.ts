import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { exercises } from "@/db/schema";

const EXERCISE_DATA_PATH = path.join(
  import.meta.dirname,
  "../legacy/exercise-data/dist/exercises.json",
);

const BATCH_SIZE = 100;

type RawExercise = {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  category: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function seedExercises() {
  const raw = await readFile(EXERCISE_DATA_PATH, "utf-8");
  const data: RawExercise[] = JSON.parse(raw);

  const rows = data.map((ex) => ({
    externalId: ex.id,
    name: ex.name,
    force: ex.force,
    level: ex.level ?? "beginner",
    mechanic: ex.mechanic,
    equipment: ex.equipment,
    category: ex.category ?? "strength",
    primaryMuscles: ex.primaryMuscles ?? [],
    secondaryMuscles: ex.secondaryMuscles ?? [],
    instructions: ex.instructions ?? [],
    imagePaths: ex.images ?? [],
  }));

  let inserted = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const result = await db
      .insert(exercises)
      .values(batch)
      .onConflictDoNothing({ target: exercises.externalId })
      .returning({ id: exercises.id });
    inserted += result.length;
  }

  console.log(`Leídos ${rows.length} ejercicios de ${EXERCISE_DATA_PATH}`);
  console.log(`Insertados ${inserted} ejercicios nuevos (${rows.length - inserted} ya existían).`);
}

seedExercises().catch((err) => {
  console.error("Error al hacer seed de ejercicios:", err);
  process.exitCode = 1;
});
