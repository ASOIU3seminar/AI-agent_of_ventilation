import React from 'react';
import {
  Sparkles,
  Grid,
  UploadCloud,
  Download
} from 'lucide-react';
import { calcNetHeight } from '../../utils/elevations.js';

export function Header({
  activeFloorId,
  onSelectFloorId,
  floors,
  currentNetHeight,
  cadFile,
  onPdfSelect,
  onLoadDemoRooms,
  onExportExcel,
  hasRooms
}) {
  return (
    <header className="px-6 py-3 bg-[#0b192c]/90 border-b border-[#1e3a5f] flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div>
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          ИИ-агент для расчета вентиляции и ХОВС
        </h1>
        <p className="text-xs text-slate-400">
          Поэтапный ввод отметок (Δh = {currentNetHeight} м) • Зонирование и цветовая дифференциация помещений
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Селектор этажей */}
        <select
          value={activeFloorId}
          onChange={(e) => onSelectFloorId(e.target.value)}
          className="bg-[#040d1a] border border-[#1e3a5f] rounded-xl px-3 py-1.5 text-xs font-semibold text-emerald-300 outline-none focus:border-emerald-500"
        >
          {floors.map(f => (
            <option key={f.id} value={f.id}>
              {f.name} (Δh = {calcNetHeight(f)} м)
            </option>
          ))}
        </select>

        {/* Кнопка загрузки демо-плана */}
        {!hasRooms && (
          <button
            onClick={onLoadDemoRooms}
            className="px-3 py-1.5 rounded-xl font-semibold text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 transition-all"
          >
            <Grid className="w-3.5 h-3.5" /> Загрузить демо-план
          </button>
        )}

        {/* Загрузка PDF */}
        <label className="cursor-pointer px-3.5 py-1.5 rounded-xl font-semibold text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 flex items-center gap-1.5 transition-all">
          <UploadCloud className="w-3.5 h-3.5" />
          {cadFile ? cadFile.name.slice(0, 16) + '...' : 'Загрузить PDF-план'}
          <input type="file" accept=".pdf" onChange={onPdfSelect} className="hidden" />
        </label>

        {/* Выгрузка в Excel */}
        <button
          onClick={onExportExcel}
          className="px-4 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white shadow-md shadow-emerald-500/25 flex items-center gap-1.5 transition-all"
        >
          <Download className="w-3.5 h-3.5" /> Скачать Excel
        </button>
      </div>
    </header>
  );
}
