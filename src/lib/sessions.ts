import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { setLogs, workoutDays, workoutSessions } from "@/db/schema";
import { currentUser } from "@/auth";

export type SessionSummary = {
  id: number;
  startedAt: Date;
  completedAt: Date | null;
  status: "in_progress" | "completed";
  totalVolumeKg: number | null;
  setLogsCount: number;
  // workoutDayId es nullable (se pone en null si se borra el día de origen),
  // así que el día/foco de una sesión histórica también puede faltar.
  dayName: string | null;
  dayFocus: string | null;
};

export async function getSessionHistory(limit = 20, offset = 0): Promise<SessionSummary[]> {
  const user = await currentUser();

  const rows = await db
    .select({
      id: workoutSessions.id,
      startedAt: workoutSessions.startedAt,
      completedAt: workoutSessions.completedAt,
      status: workoutSessions.status,
      totalVolumeKg: workoutSessions.totalVolumeKg,
      dayName: workoutDays.name,
      dayFocus: workoutDays.focus,
      setLogsCount: sql<number>`count(${setLogs.id})::int`,
    })
    .from(workoutSessions)
    .leftJoin(workoutDays, eq(workoutSessions.workoutDayId, workoutDays.id))
    .leftJoin(setLogs, eq(setLogs.sessionId, workoutSessions.id))
    .where(eq(workoutSessions.userId, user.id))
    .groupBy(workoutSessions.id, workoutDays.id)
    .orderBy(desc(workoutSessions.startedAt))
    .limit(limit)
    .offset(offset);

  return rows;
}
