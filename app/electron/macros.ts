import { lookupFoodPer100g } from './fdc';

const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL = 'qwen2.5:7b';

export interface MacroItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface RawItem extends MacroItem {
  grams?: number;
}

export interface EstimateOptions {
  useFdc: boolean;
  fdcApiKey?: string;
}

const BASIC_FORMAT = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      calories: { type: 'number' },
      protein: { type: 'number' },
      carbs: { type: 'number' },
      fat: { type: 'number' },
    },
    required: ['name', 'calories', 'protein', 'carbs', 'fat'],
  },
};

const FDC_FORMAT = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      grams: { type: 'number' },
      calories: { type: 'number' },
      protein: { type: 'number' },
      carbs: { type: 'number' },
      fat: { type: 'number' },
    },
    required: ['name', 'grams', 'calories', 'protein', 'carbs', 'fat'],
  },
};

const BASIC_SYSTEM_PROMPT =
  'You are a nutrition estimation engine. Split the meal into its individual food/drink components and estimate macros for each. One entry per distinct item, accounting for stated quantities (e.g. "3 eggs" is one entry covering all 3 eggs). All values are grams except calories (kcal). Use your best nutritional knowledge for typical foods and portion sizes.';

const FDC_SYSTEM_PROMPT =
  'You are a nutrition estimation engine. Split the meal into its individual food/drink components. One entry per distinct item, accounting for stated quantities (e.g. "3 eggs" is one entry covering all 3 eggs). For each item, give a short generic name suitable for a USDA food database lookup (e.g. "egg", "chicken drumstick, roasted", "celery"), your best-estimate total weight in grams for the stated quantity, and fallback macro estimates in case a database lookup is unavailable. All macro values are grams except calories (kcal).';

async function callOllama(description: string, useFdc: boolean): Promise<RawItem[]> {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: useFdc ? FDC_SYSTEM_PROMPT : BASIC_SYSTEM_PROMPT },
        { role: 'user', content: description },
      ],
      stream: false,
      format: useFdc ? FDC_FORMAT : BASIC_FORMAT,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { message: { content: string } };
  return JSON.parse(data.message.content);
}

function normalize(item: RawItem): MacroItem {
  return {
    name: String(item.name ?? 'item'),
    calories: Number(item.calories) || 0,
    protein: Number(item.protein) || 0,
    carbs: Number(item.carbs) || 0,
    fat: Number(item.fat) || 0,
  };
}

export async function estimateMacros(description: string, options: EstimateOptions): Promise<MacroItem[]> {
  const rawItems = await callOllama(description, options.useFdc);

  if (!options.useFdc || !options.fdcApiKey) {
    return rawItems.map(normalize);
  }

  return Promise.all(
    rawItems.map(async (item) => {
      const fallback = normalize(item);
      const per100g = await lookupFoodPer100g(item.name, options.fdcApiKey!);
      if (!per100g) return fallback;

      const grams = item.grams && item.grams > 0 ? item.grams : 100;
      const scale = grams / 100;
      return {
        name: fallback.name,
        calories: per100g.calories * scale,
        protein: per100g.protein * scale,
        carbs: per100g.carbs * scale,
        fat: per100g.fat * scale,
      };
    })
  );
}
