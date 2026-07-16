export interface FdcMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const NUTRIENT_IDS = {
  calories: [1008],
  protein: [1003],
  carbs: [1005],
  fat: [1004],
};

function extractNutrient(nutrients: any[], ids: number[]): number {
  const match = nutrients.find((n) => ids.includes(n.nutrientId));
  return match?.value ?? 0;
}

// Returns macros per 100g for the best-matching food, or null if no match/lookup failed.
export async function lookupFoodPer100g(name: string, apiKey: string): Promise<FdcMacros | null> {
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
      apiKey
    )}&query=${encodeURIComponent(name)}&pageSize=3&dataType=Foundation,SR%20Legacy`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as { foods?: any[] };
    const food = data.foods?.[0];
    if (!food?.foodNutrients) return null;

    return {
      calories: extractNutrient(food.foodNutrients, NUTRIENT_IDS.calories),
      protein: extractNutrient(food.foodNutrients, NUTRIENT_IDS.protein),
      carbs: extractNutrient(food.foodNutrients, NUTRIENT_IDS.carbs),
      fat: extractNutrient(food.foodNutrients, NUTRIENT_IDS.fat),
    };
  } catch {
    return null;
  }
}
