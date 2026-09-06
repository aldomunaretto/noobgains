import {
  pgTable,
  text,
  integer,
  doublePrecision,
  boolean,
  date,
  timestamp,
  unique,
  pgEnum,
} from "drizzle-orm/pg-core";

// Estados propios de nuestro dominio: se definen como enum porque los
// controlamos nosotros (a diferencia de los campos de catálogo de `exercises`,
// que vienen de una fuente externa y se guardan como texto tal cual).
export const periodizationPhaseEnum = pgEnum("periodization_phase", [
  "progressive",
  "deload",
  "intensification",
]);

export const sessionStatusEnum = pgEnum("session_status", ["in_progress", "completed"]);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull().unique(),
});

// Catálogo global de ejercicios (873 filas via seed), no pertenece a ningún usuario.
export const exercises = pgTable("exercises", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  externalId: text("external_id").notNull().unique(),
  name: text("name").notNull(),
  nameEs: text("name_es"),
  force: text("force"),
  level: text("level").notNull().default("beginner"),
  mechanic: text("mechanic"),
  equipment: text("equipment"),
  category: text("category").notNull().default("strength"),
  primaryMuscles: text("primary_muscles").array().notNull().default([]),
  secondaryMuscles: text("secondary_muscles").array().notNull().default([]),
  instructions: text("instructions").array().notNull().default([]),
  instructionsEs: text("instructions_es").array(),
  imagePaths: text("image_paths").array().notNull().default([]),
});

export const userProfile = pgTable(
  "user_profile",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
    weightKg: doublePrecision("weight_kg").notNull(),
    heightCm: doublePrecision("height_cm").notNull(),
    bmi: doublePrecision("bmi").notNull(),
    activityLevel: text("activity_level").notNull().default("sedentary"),
    experienceLevel: text("experience_level").notNull().default("beginner"),
    trainingDaysPerWeek: integer("training_days_per_week").notNull().default(3),
    defaultRestSeconds: integer("default_rest_seconds").notNull().default(90),
    preferredSplit: text("preferred_split"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId)],
);

export const workoutPlans = pgTable("workout_plans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  weekStart: date("week_start", { mode: "string" }).notNull(),
  weekEnd: date("week_end", { mode: "string" }).notNull(),
  splitType: text("split_type").notNull(),
  periodizationPhase: periodizationPhaseEnum("periodization_phase").notNull().default("progressive"),
  mesocycleWeek: integer("mesocycle_week").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  aiReasoning: text("ai_reasoning"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // $onUpdate: se toca desde varias server actions (generar, editar, desactivar);
  // a diferencia de userProfile, no hay un único punto de escritura que lo garantice a mano.
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const workoutDays = pgTable("workout_days", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  planId: integer("plan_id")
    .notNull()
    .references(() => workoutPlans.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0=lunes, 6=domingo
  focus: text("focus").notNull(),
  name: text("name").notNull(),
});

export const plannedExercises = pgTable("planned_exercises", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workoutDayId: integer("workout_day_id")
    .notNull()
    .references(() => workoutDays.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id),
  orderIndex: integer("order_index").notNull().default(0),
  targetSets: integer("target_sets").notNull().default(3),
  targetRepsMin: integer("target_reps_min").notNull().default(8),
  targetRepsMax: integer("target_reps_max").notNull().default(12),
  targetWeightKg: doublePrecision("target_weight_kg"),
  restSeconds: integer("rest_seconds").notNull().default(90),
  notes: text("notes"),
  formTips: text("form_tips"),
});

export const workoutSessions = pgTable("workout_sessions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  // Directo, no vía workoutDayId: ese campo se pone en null si se borra el día/plan
  // de origen, y la sesión debe seguir siendo atribuible a su usuario igualmente.
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  workoutDayId: integer("workout_day_id").references(() => workoutDays.id, {
    onDelete: "set null",
  }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: sessionStatusEnum("status").notNull().default("in_progress"),
  totalVolumeKg: doublePrecision("total_volume_kg"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const setLogs = pgTable("set_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => workoutSessions.id, { onDelete: "cascade" }),
  plannedExerciseId: integer("planned_exercise_id").references(() => plannedExercises.id, {
    onDelete: "set null",
  }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id),
  setNumber: integer("set_number").notNull(),
  repsCompleted: integer("reps_completed").notNull().default(0),
  weightKg: doublePrecision("weight_kg").notNull().default(0),
  rpe: integer("rpe"),
  restTakenSeconds: integer("rest_taken_seconds"),
  completed: boolean("completed").notNull().default(false),
  performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
});
