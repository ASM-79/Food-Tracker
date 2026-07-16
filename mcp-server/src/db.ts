import Database from 'better-sqlite3';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const dataDir = path.join(os.homedir(), 'FoodTrackerData');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'data.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    calories REAL,
    protein REAL,
    carbs REAL,
    fat REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS weight_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);
  CREATE INDEX IF NOT EXISTS idx_weight_date ON weight_logs(date);
`);

export interface Meal {
  id: number;
  date: string;
  category: string;
  description: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  created_at: string;
}

export interface WeightLog {
  id: number;
  date: string;
  weight_kg: number;
  note: string | null;
  created_at: string;
}

export function addMeal(input: {
  date: string;
  category: string;
  description: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}): Meal {
  const stmt = db.prepare(
    `INSERT INTO meals (date, category, description, calories, protein, carbs, fat)
     VALUES (@date, @category, @description, @calories, @protein, @carbs, @fat)`
  );
  const result = stmt.run(input);
  return db.prepare('SELECT * FROM meals WHERE id = ?').get(result.lastInsertRowid) as Meal;
}

export function updateMeal(id: number, fields: Partial<Omit<Meal, 'id' | 'created_at'>>): Meal | undefined {
  const existing = db.prepare('SELECT * FROM meals WHERE id = ?').get(id) as Meal | undefined;
  if (!existing) return undefined;
  const merged = { ...existing, ...fields };
  db.prepare(
    `UPDATE meals SET date=@date, category=@category, description=@description,
     calories=@calories, protein=@protein, carbs=@carbs, fat=@fat WHERE id=@id`
  ).run(merged);
  return db.prepare('SELECT * FROM meals WHERE id = ?').get(id) as Meal;
}

export function deleteMeal(id: number): boolean {
  const result = db.prepare('DELETE FROM meals WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getMealsForDate(date: string): Meal[] {
  return db.prepare('SELECT * FROM meals WHERE date = ? ORDER BY created_at ASC').all(date) as Meal[];
}

export function getMealsInRange(startDate: string, endDate: string): Meal[] {
  return db
    .prepare('SELECT * FROM meals WHERE date BETWEEN ? AND ? ORDER BY date ASC, created_at ASC')
    .all(startDate, endDate) as Meal[];
}

export function addWeightLog(input: { date: string; weight_kg: number; note?: string | null }): WeightLog {
  const stmt = db.prepare(
    `INSERT INTO weight_logs (date, weight_kg, note) VALUES (@date, @weight_kg, @note)`
  );
  const result = stmt.run({ date: input.date, weight_kg: input.weight_kg, note: input.note ?? null });
  return db.prepare('SELECT * FROM weight_logs WHERE id = ?').get(result.lastInsertRowid) as WeightLog;
}

export function getWeightHistory(startDate?: string, endDate?: string): WeightLog[] {
  if (startDate && endDate) {
    return db
      .prepare('SELECT * FROM weight_logs WHERE date BETWEEN ? AND ? ORDER BY date ASC')
      .all(startDate, endDate) as WeightLog[];
  }
  return db.prepare('SELECT * FROM weight_logs ORDER BY date ASC').all() as WeightLog[];
}

export function getDailyTotals(date: string) {
  const meals = getMealsForDate(date);
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein: acc.protein + (m.protein ?? 0),
      carbs: acc.carbs + (m.carbs ?? 0),
      fat: acc.fat + (m.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function getRangeTotals(startDate: string, endDate: string) {
  const meals = getMealsInRange(startDate, endDate);
  const byDate = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
  for (const m of meals) {
    const cur = byDate.get(m.date) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    cur.calories += m.calories ?? 0;
    cur.protein += m.protein ?? 0;
    cur.carbs += m.carbs ?? 0;
    cur.fat += m.fat ?? 0;
    byDate.set(m.date, cur);
  }
  return Array.from(byDate.entries()).map(([date, totals]) => ({ date, ...totals }));
}
