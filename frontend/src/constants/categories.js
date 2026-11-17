// Классификатор и цветовая палитра категорий помещений СП 60.13330 / СП 118.13330
export const ROOM_CATEGORIES = {
  parking: {
    id: 'parking',
    label: 'Автостоянка / Паркинг',
    color: '#f59e0b', // Amber
    fill: 'rgba(245, 158, 11, 0.22)',
    border: '#f59e0b',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    tag: 'П-Паркинг / В-Паркинг'
  },
  bathroom: {
    id: 'bathroom',
    label: 'Санузлы и Душевые',
    color: '#06b6d4', // Cyan
    fill: 'rgba(6, 182, 212, 0.22)',
    border: '#06b6d4',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    tag: 'В-СУ'
  },
  cleaning: {
    id: 'cleaning',
    label: 'ПУИ / Уборочные',
    color: '#6366f1', // Indigo
    fill: 'rgba(99, 102, 241, 0.22)',
    border: '#6366f1',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    tag: 'В-СУ'
  },
  electrical: {
    id: 'electrical',
    label: 'Электрощитовая / СС',
    color: '#a855f7', // Purple
    fill: 'rgba(168, 85, 247, 0.22)',
    border: '#a855f7',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    tag: 'В1-Тех'
  },
  technical: {
    id: 'technical',
    label: 'ИТП / Насосная / КНС',
    color: '#f43f5e', // Rose
    fill: 'rgba(244, 63, 94, 0.22)',
    border: '#f43f5e',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    tag: 'П1 / В1'
  },
  ventilation: {
    id: 'ventilation',
    label: 'Венткамера / ОВиК',
    color: '#10b981', // Emerald
    fill: 'rgba(16, 185, 129, 0.22)',
    border: '#10b981',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    tag: 'П1 / В1'
  },
  common: {
    id: 'common',
    label: 'МОП / Коридоры / Тамбуры',
    color: '#0284c7', // Sky
    fill: 'rgba(2, 132, 199, 0.22)',
    border: '#0284c7',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    tag: 'П-МОП'
  },
  office: {
    id: 'office',
    label: 'Офис / Рабочее помещение',
    color: '#3b82f6', // Blue
    fill: 'rgba(59, 130, 246, 0.22)',
    border: '#3b82f6',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    tag: 'П1 / В1'
  },
  storage: {
    id: 'storage',
    label: 'Склад / Кладовая',
    color: '#64748b', // Slate
    fill: 'rgba(100, 116, 139, 0.22)',
    border: '#64748b',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    tag: 'П1 / В1'
  }
};

export function getRoomCategory(room) {
  const lower = ((room.rawName || '') + ' ' + (room.normalizedType || '')).toLowerCase();

  if (lower.includes('автостоянк') || lower.includes('паркинг') || lower.includes('автомобил') || lower.includes('машино')) {
    return ROOM_CATEGORIES.parking;
  }
  if (lower.includes('санузел') || lower.includes('уборн') || lower.includes('туалет') || lower.includes('с/у') || lower.includes('душев')) {
    return ROOM_CATEGORIES.bathroom;
  }
  if (lower.includes('пуи') || lower.includes('уборочн') || lower.includes('уборка') || lower.includes('инвентар')) {
    return ROOM_CATEGORIES.cleaning;
  }
  if (lower.includes('электрощит') || lower.includes('грщ') || lower.includes('ибп') || lower.includes('асо') || lower.includes('сс') || lower.includes('связ') || lower.includes('кроссов')) {
    return ROOM_CATEGORIES.electrical;
  }
  if (lower.includes('итп') || lower.includes('тепловой') || lower.includes('насосн') || lower.includes('кнс') || lower.includes('водомер')) {
    return ROOM_CATEGORIES.technical;
  }
  if (lower.includes('венткамер') || lower.includes('холодильн') || lower.includes('кондиционир') || lower.includes('аугпт')) {
    return ROOM_CATEGORIES.ventilation;
  }
  if (lower.includes('тамбур') || lower.includes('лифтовой') || lower.includes('коридор') || lower.includes('моп') || lower.includes('вестибюл') || lower.includes('лестнич')) {
    return ROOM_CATEGORIES.common;
  }
  if (lower.includes('офис') || lower.includes('кабинет') || lower.includes('переговор') || lower.includes('диспетчер') || lower.includes('охрана')) {
    return ROOM_CATEGORIES.office;
  }
  if (lower.includes('кладов') || lower.includes('склад') || lower.includes('мусор') || lower.includes('хранен') || lower.includes('архив')) {
    return ROOM_CATEGORIES.storage;
  }
  return ROOM_CATEGORIES.storage;
}
