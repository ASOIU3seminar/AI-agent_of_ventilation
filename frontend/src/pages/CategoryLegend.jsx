import React from 'react';

export function CategoryLegend({
  activeCategories,
  totalRoomsCount,
  activeCategoryFilter,
  onSelectCategoryFilter
}) {
  return (
    <div className="z-20 bg-[#0b192c]/90 border-b border-[#1e3a5f] px-3.5 py-1.5 flex flex-wrap items-center gap-2 text-[11px] overflow-x-auto">
      <span className="text-slate-400 font-bold shrink-0">Категории СП:</span>
      <button
        onClick={() => onSelectCategoryFilter(null)}
        className={`px-2 py-0.5 rounded-full border text-[10px] font-bold transition-all ${
          activeCategoryFilter === null
            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
            : 'bg-slate-800/40 text-slate-300 border-slate-700/60 hover:text-white'
        }`}
      >
        Все ({totalRoomsCount})
      </button>

      {activeCategories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelectCategoryFilter(activeCategoryFilter === cat.id ? null : cat.id)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold transition-all ${
            activeCategoryFilter === cat.id
              ? 'ring-2 ring-white text-white font-bold'
              : 'opacity-85 hover:opacity-100 text-slate-200'
          }`}
          style={{
            backgroundColor: cat.fill,
            borderColor: cat.border
          }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
          {cat.label} ({cat.count})
        </button>
      ))}
    </div>
  );
}
