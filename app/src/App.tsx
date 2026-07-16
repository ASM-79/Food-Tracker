import { useEffect, useState } from 'react';
import type { Meal, Totals } from './foodTracker.d.ts';

const CATEGORIES = ['breakfast', 'lunch', 'dinner', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

function today() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function App() {
  const [date] = useState(today());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [totals, setTotals] = useState<Totals>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [activeCategory, setActiveCategory] = useState<Category>('breakfast');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [showWeight, setShowWeight] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [useFdc, setUseFdc] = useState(false);
  const [fdcApiKey, setFdcApiKey] = useState('');

  async function refresh() {
    const [m, t] = await Promise.all([
      window.foodTracker.getMealsForDate(date),
      window.foodTracker.getTotals(date),
    ]);
    setMeals(m);
    setTotals(t);
  }

  useEffect(() => {
    refresh();
    (async () => {
      const [storedUseFdc, storedKey] = await Promise.all([
        window.foodTracker.getSetting('useFdc'),
        window.foodTracker.getSetting('fdcApiKey'),
      ]);
      setUseFdc(storedUseFdc === 'true');
      setFdcApiKey(storedKey ?? '');
    })();

    // Pick up changes made outside the app (e.g. Claude via MCP) without needing a restart
    const interval = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  async function handleToggleFdc() {
    const next = !useFdc;
    setUseFdc(next);
    await window.foodTracker.setSetting('useFdc', String(next));
  }

  async function handleSaveFdcKey() {
    await window.foodTracker.setSetting('fdcApiKey', fdcApiKey.trim());
  }

  async function handleAdd() {
    if (!description.trim()) return;
    setLoading(true);
    try {
      await window.foodTracker.addMeal({ date, category: activeCategory, description: description.trim() });
      setDescription('');
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    await window.foodTracker.deleteMeal(id);
    await refresh();
  }

  async function handleAddWeight() {
    const w = parseFloat(weightInput);
    if (!w) return;
    await window.foodTracker.addWeight({ date, weight_kg: w });
    setWeightInput('');
    setShowWeight(false);
  }

  const mealsByCategory = (cat: Category) => meals.filter((m) => m.category === cat);

  return (
    <div className="widget">
      <div className="drag-bar">
        <span>{date}</span>
        <div className="drag-bar-actions">
          <button className="link-btn" onClick={() => setShowWeight((s) => !s)}>
            ⚖ Weight
          </button>
          <button className="link-btn" onClick={() => setShowSettings((s) => !s)}>
            ⚙
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="settings-panel">
          <label className="settings-toggle">
            <input type="checkbox" checked={useFdc} onChange={handleToggleFdc} />
            Use USDA FoodData Central lookup
          </label>
          <div className="settings-key-row">
            <input
              type="password"
              placeholder="FDC API key"
              value={fdcApiKey}
              onChange={(e) => setFdcApiKey(e.target.value)}
            />
            <button onClick={handleSaveFdcKey}>Save</button>
          </div>
        </div>
      )}

      {showWeight && (
        <div className="weight-row">
          <input
            type="number"
            placeholder="kg"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
          />
          <button onClick={handleAddWeight}>Log</button>
        </div>
      )}

      <div className="tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={cat === activeCategory ? 'tab active' : 'tab'}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="add-row">
        <input
          placeholder={`Add to ${activeCategory}... e.g. "2 eggs, 1 toast"`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button onClick={handleAdd} disabled={loading}>
          {loading ? '...' : 'Add'}
        </button>
      </div>

      <div className="meal-list">
        {mealsByCategory(activeCategory).map((m) => (
          <div key={m.id} className="meal-item">
            <div className="meal-desc">{m.description}</div>
            <div className="meal-macros">
              {Math.round(m.calories ?? 0)} kcal · P{Math.round(m.protein ?? 0)} · C
              {Math.round(m.carbs ?? 0)} · F{Math.round(m.fat ?? 0)}
            </div>
            <button className="del-btn" onClick={() => handleDelete(m.id)}>
              ×
            </button>
          </div>
        ))}
        {mealsByCategory(activeCategory).length === 0 && <div className="empty">No entries yet</div>}
      </div>

      <div className="totals">
        <div className="totals-title">Today's Total</div>
        <div className="totals-grid">
          <div>{Math.round(totals.calories)} kcal</div>
          <div>P {Math.round(totals.protein)}g</div>
          <div>C {Math.round(totals.carbs)}g</div>
          <div>F {Math.round(totals.fat)}g</div>
        </div>
      </div>
    </div>
  );
}

export default App;
