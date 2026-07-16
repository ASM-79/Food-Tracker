#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  addMeal,
  updateMeal,
  deleteMeal,
  getMealsForDate,
  getMealsInRange,
  getDailyTotals,
  getRangeTotals,
  addWeightLog,
  getWeightHistory,
} from './db.js';

const server = new McpServer({
  name: 'food-tracker',
  version: '1.0.0',
});

server.registerTool(
  'add_meal',
  {
    title: 'Add meal entry',
    description:
      'Add a meal entry to the food log. Provide date (YYYY-MM-DD), category (breakfast/lunch/dinner/other), a description, and macros if known.',
    inputSchema: {
      date: z.string().describe('Date in YYYY-MM-DD format'),
      category: z.enum(['breakfast', 'lunch', 'dinner', 'other']),
      description: z.string(),
      calories: z.number().nullable().default(null),
      protein: z.number().nullable().default(null),
      carbs: z.number().nullable().default(null),
      fat: z.number().nullable().default(null),
    },
  },
  async ({ date, category, description, calories, protein, carbs, fat }) => {
    const meal = addMeal({ date, category, description, calories, protein, carbs, fat });
    return { content: [{ type: 'text', text: JSON.stringify(meal) }] };
  }
);

server.registerTool(
  'edit_meal',
  {
    title: 'Edit meal entry',
    description: 'Edit an existing meal entry by id. Only provided fields are updated.',
    inputSchema: {
      id: z.number(),
      date: z.string().optional(),
      category: z.enum(['breakfast', 'lunch', 'dinner', 'other']).optional(),
      description: z.string().optional(),
      calories: z.number().nullable().optional(),
      protein: z.number().nullable().optional(),
      carbs: z.number().nullable().optional(),
      fat: z.number().nullable().optional(),
    },
  },
  async ({ id, ...fields }) => {
    const meal = updateMeal(id, fields);
    if (!meal) return { content: [{ type: 'text', text: `No meal found with id ${id}` }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify(meal) }] };
  }
);

server.registerTool(
  'delete_meal',
  {
    title: 'Delete meal entry',
    description: 'Delete a meal entry by id.',
    inputSchema: { id: z.number() },
  },
  async ({ id }) => {
    const ok = deleteMeal(id);
    return { content: [{ type: 'text', text: ok ? `Deleted meal ${id}` : `No meal found with id ${id}` }] };
  }
);

server.registerTool(
  'get_day_log',
  {
    title: 'Get day log',
    description: 'Get all meal entries and macro totals for a given date (YYYY-MM-DD).',
    inputSchema: { date: z.string() },
  },
  async ({ date }) => {
    const meals = getMealsForDate(date);
    const totals = getDailyTotals(date);
    return { content: [{ type: 'text', text: JSON.stringify({ date, meals, totals }, null, 2) }] };
  }
);

server.registerTool(
  'log_weight',
  {
    title: 'Log weight',
    description: 'Log a body weight measurement for a given date.',
    inputSchema: {
      date: z.string(),
      weight_kg: z.number(),
      note: z.string().optional(),
    },
  },
  async ({ date, weight_kg, note }) => {
    const entry = addWeightLog({ date, weight_kg, note });
    return { content: [{ type: 'text', text: JSON.stringify(entry) }] };
  }
);

server.registerTool(
  'get_weight_history',
  {
    title: 'Get weight history',
    description: 'Get logged weight history, optionally filtered by date range (YYYY-MM-DD).',
    inputSchema: {
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    },
  },
  async ({ startDate, endDate }) => {
    const history = getWeightHistory(startDate, endDate);
    return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] };
  }
);

server.registerTool(
  'analyze_range',
  {
    title: 'Analyze macro range',
    description:
      'Get per-day macro totals and meal entries for a date range (YYYY-MM-DD to YYYY-MM-DD), useful for trend analysis.',
    inputSchema: {
      startDate: z.string(),
      endDate: z.string(),
    },
  },
  async ({ startDate, endDate }) => {
    const dailyTotals = getRangeTotals(startDate, endDate);
    const meals = getMealsInRange(startDate, endDate);
    const avg = dailyTotals.length
      ? {
          calories: dailyTotals.reduce((a, d) => a + d.calories, 0) / dailyTotals.length,
          protein: dailyTotals.reduce((a, d) => a + d.protein, 0) / dailyTotals.length,
          carbs: dailyTotals.reduce((a, d) => a + d.carbs, 0) / dailyTotals.length,
          fat: dailyTotals.reduce((a, d) => a + d.fat, 0) / dailyTotals.length,
        }
      : null;
    return {
      content: [
        { type: 'text', text: JSON.stringify({ dailyTotals, average: avg, meals }, null, 2) },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
