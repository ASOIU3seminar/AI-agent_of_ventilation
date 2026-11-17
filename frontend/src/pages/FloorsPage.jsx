import React from 'react';
import { Sliders, Plus, Building2, Trash2 } from 'lucide-react';
import { calcNetHeight } from '../utils/elevations.js';
import { ElevationFormulaCard } from './ElevationFormulaCard.jsx';

export function FloorsPage({
  floors,
  activeFloorId,
  onSelectFloor,
  onUpdateFloor,
  onAddFloorAbove,
  onAddFloorBelow,
  onDeleteFloor
}) {
  const activeFloor = floors.find(f => f.id === activeFloorId) || floors[0];

  return (
    <div className="p-6 space-y-6">
      {/* Карточка поэтапного добавления уровня */}
      <div className="p-6 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              Менеджер отметок и высот этажей (СП 60.13330)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Высота этажа Δh задается напрямую из проектного чертежа PDF либо по разности высотных отметок. Вычислять или вводить толщину перекрытия не требуется.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onAddFloorAbove}
              className="px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold flex items-center gap-2 transition-all shadow"
            >
              <Plus className="w-4 h-4" /> + Добавить этаж выше
            </button>
            <button
              onClick={onAddFloorBelow}
              className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-2 transition-all shadow"
            >
              <Plus className="w-4 h-4" /> - Добавить подземный этаж
            </button>
          </div>
        </div>

        {/* Интерактивная формула чистой высоты */}
        <ElevationFormulaCard activeFloor={activeFloor} />
      </div>

      {/* Таблица созданных этажей здания */}
      <div className="p-6 rounded-2xl bg-[#0b192c] border border-[#1e3a5f]">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            Список этажей здания ({floors.length} уровней)
          </h4>
          <span className="text-xs text-slate-400">
            Редактируйте чистую высоту Δh или отметки — объем V = S × Δh и воздухообмен пересчитаются мгновенно
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-[#1e3a5f]">
                <th className="py-3 px-3">Статус</th>
                <th className="py-3 px-3">Наименование уровня</th>
                <th className="py-3 px-3">Отметка пола H_bot (м)</th>
                <th className="py-3 px-3">Отметка верха H_top (м)</th>
                <th className="py-3 px-3">Чистая высота Δh (м)</th>
                <th className="py-3 px-3 text-right">Управление</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3a5f]/60">
              {floors.map((f) => {
                const netH = calcNetHeight(f);
                const isSelected = f.id === activeFloorId;

                return (
                  <tr key={f.id} className={isSelected ? 'bg-emerald-500/10' : 'hover:bg-slate-800/40'}>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => onSelectFloor(f.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                            : 'bg-[#040d1a] text-slate-300 border border-[#1e3a5f] hover:border-emerald-500/50'
                        }`}
                      >
                        {isSelected ? '✓ Выбран' : 'Выбрать'}
                      </button>
                    </td>

                    <td className="py-3 px-3">
                      <input
                        value={f.name}
                        onChange={(e) => onUpdateFloor(f.id, 'name', e.target.value)}
                        className="w-full bg-[#040d1a] border border-[#1e3a5f] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-400"
                      />
                    </td>

                    <td className="py-3 px-3">
                      <input
                        type="number"
                        step="0.05"
                        value={f.elevationBottom}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          onUpdateFloor(f.id, 'elevationBottom', val);
                          // Auto update top and clean height
                          const delta = Math.abs(f.elevationTop - val);
                          if (delta > 0 && !f.heightLocked) {
                            onUpdateFloor(f.id, 'height', +delta.toFixed(3));
                          }
                        }}
                        className="w-28 bg-[#040d1a] border border-[#1e3a5f] rounded-lg px-2 py-1.5 text-xs font-mono text-sky-300 outline-none focus:border-emerald-400"
                      />
                    </td>

                    <td className="py-3 px-3">
                      <input
                        type="number"
                        step="0.05"
                        value={f.elevationTop}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          onUpdateFloor(f.id, 'elevationTop', val);
                          const delta = Math.abs(val - f.elevationBottom);
                          if (delta > 0 && !f.heightLocked) {
                            onUpdateFloor(f.id, 'height', +delta.toFixed(3));
                          }
                        }}
                        className="w-28 bg-[#040d1a] border border-[#1e3a5f] rounded-lg px-2 py-1.5 text-xs font-mono text-sky-300 outline-none focus:border-emerald-400"
                      />
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.05"
                          min="2.0"
                          max="12.0"
                          value={f.height || netH}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 3.0;
                            onUpdateFloor(f.id, 'height', val);
                            onUpdateFloor(f.id, 'heightLocked', true);
                          }}
                          className="w-24 bg-[#040d1a] border border-emerald-500/50 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-emerald-300 outline-none focus:border-emerald-400"
                        />
                        <span className="text-xs text-slate-400">м</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onDeleteFloor(f.id)}
                        disabled={floors.length <= 1}
                        title={floors.length <= 1 ? 'Нельзя удалить единственный этаж' : 'Удалить уровень'}
                        className={`p-1.5 rounded-lg border transition-all ${
                          floors.length <= 1
                            ? 'opacity-30 cursor-not-allowed border-slate-700 text-slate-500'
                            : 'border-red-500/40 text-red-400 hover:bg-red-500/20'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
