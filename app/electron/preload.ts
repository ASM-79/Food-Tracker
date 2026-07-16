import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('foodTracker', {
  getMealsForDate: (date: string) => ipcRenderer.invoke('meals:getForDate', date),
  getTotals: (date: string) => ipcRenderer.invoke('meals:getTotals', date),
  addMeal: (input: { date: string; category: string; description: string }) =>
    ipcRenderer.invoke('meals:add', input),
  updateMeal: (id: number, fields: any) => ipcRenderer.invoke('meals:update', id, fields),
  deleteMeal: (id: number) => ipcRenderer.invoke('meals:delete', id),
  addWeight: (input: { date: string; weight_kg: number; note?: string }) =>
    ipcRenderer.invoke('weight:add', input),
  getWeightHistory: (startDate?: string, endDate?: string) =>
    ipcRenderer.invoke('weight:history', startDate, endDate),
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
});
