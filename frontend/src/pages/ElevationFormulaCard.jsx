import React from 'react';
import { calcNetHeight } from '../utils/elevations.js';

export function ElevationFormulaCard({ activeFloor }) {
  const netH = calcNetHeight(activeFloor);

  return (
    <div className="p-4 rounded-xl bg-[#040d1a] border border-emerald-500/40 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-lg">
          Δh
        </div>
        <div>
          <div className="text-xs font-bold text-emerald-300">
            Определение чистой высоты этажа (СП 60.13330):
          </div>
          <div className="text-sm font-mono text-white mt-0.5">
            Δh = |H_top − H_bottom| (напрямую из PDF без вычета толщины плиты)
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="text-center">
          <div className="text-slate-400">Активный уровень</div>
          <div className="font-extrabold text-white text-sm mt-0.5">{activeFloor?.name}</div>
        </div>
        <div className="text-center font-mono">
          <div className="text-slate-400">Отметка пола H_bot</div>
          <div className="font-bold text-sky-300 text-sm mt-0.5">
            {activeFloor?.elevationBottom ?? 0} м
          </div>
        </div>
        <div className="text-center font-mono">
          <div className="text-slate-400">Отметка верха H_top</div>
          <div className="font-bold text-sky-300 text-sm mt-0.5">
            {activeFloor?.elevationTop ?? 3.6} м
          </div>
        </div>
        <div className="text-center bg-emerald-500/20 px-3.5 py-1.5 rounded-xl border border-emerald-500/40 font-mono">
          <div className="text-emerald-300 font-bold">Чистая высота Δh</div>
          <div className="font-extrabold text-emerald-400 text-base">{netH} м</div>
        </div>
      </div>
    </div>
  );
}
