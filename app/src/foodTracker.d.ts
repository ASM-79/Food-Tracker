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

export interface Totals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodTrackerAPI {
  getMealsForDate: (date: string) => Promise<Meal[]>;
  getTotals: (date: string) => Promise<Totals>;
  addMeal: (input: { date: string; category: string; description: string }) => Promise<Meal[]>;
  updateMeal: (id: number, fields: Partial<Meal>) => Promise<Meal>;
  deleteMeal: (id: number) => Promise<boolean>;
  addWeight: (input: { date: string; weight_kg: number; note?: string }) => Promise<WeightLog>;
  getWeightHistory: (startDate?: string, endDate?: string) => Promise<WeightLog[]>;
  getSetting: (key: string) => Promise<string | undefined>;
  setSetting: (key: string, value: string) => Promise<void>;
}

declare global {
  interface Window {
    foodTracker: FoodTrackerAPI;
  }
}
