import React, { useState } from 'react';
import { getRoomCategory } from '../constants/categories.js';

export function ExplicationPage({
  rooms,
  currentNetHeight,
  totalArea,
  totalVol,
  totalSupply,
  totalExhaust,
  onSelectRoom,
  onAiValidate,
  onBalanceAir
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRooms = rooms.filter(r =>
    r.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.rawName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.normalizedType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="p-6 rounded-2xl bg-[#0b192c] border border-[#1e3a5f]">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="Поиск по номеру или названию помещения..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-80 bg-[#040d1a] border border-[#1e3a5f] rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-400"
          />
          <button
            onClick={onBalanceAir}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold hover:bg-emerald-500/30 transition-all"
          >
            Проверить воздушный баланс этажа
          </button>
        </div>

        <div className="max-h-[560px] overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-[#0b192c] z-10 shadow-sm">
              <tr className="text-slate-400 text-xs uppercase border-b border-[#1e3a5f]">
                <th className="py-2.5 px-2.5">№</th>
                <th className="py-2.5 px-2.5">Наименование</th>
                <th className="py-2.5 px-2.5">Категория СП</th>
                <th className="py-2.5 px-2.5">S (м²)</th>
                <th className="py-2.5 px-2.5">H (м)</th>
                <th className="py-2.5 px-2.5">V (м³)</th>
                <th className="py-2.5 px-2.5">Люди / Сан. приборы</th>
                <th className="py-2.5 px-2.5">Норматив (СП / ГОСТ)</th>
                <th className="py-2.5 px-2.5">Формула расчета воздухообмена</th>
                <th className="py-2.5 px-2.5">Приток Lпр</th>
                <th className="py-2.5 px-2.5">Вытяжка Lвыт</th>
                <th className="py-2.5 px-2.5">ΔL</th>
                <th className="py-2.5 px-2.5">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3a5f]/60">
              {filteredRooms.map((r) => {
                const cat = getRoomCategory(r);

                // Отображение людей или сан. приборов
                let occupantBadge = '—';
                if (r.toilets > 0 || r.urinals > 0 || r.showers > 0 || r.sinks > 0) {
                  const parts = [];
                  if (r.toilets > 0) parts.push(`${r.toilets} унит.`);
                  if (r.urinals > 0) parts.push(`${r.urinals} писс.`);
                  if (r.showers > 0) parts.push(`${r.showers} душ.`);
                  if (r.sinks > 0) parts.push(`${r.sinks} умыв.`);
                  occupantBadge = parts.join(', ');
                } else if (r.peopleCount > 0) {
                  occupantBadge = `${r.peopleCount} чел. ${r.hasNaturalVentilation ? '(окна)' : ''}`;
                }

                return (
                  <tr key={r.roomId} className="hover:bg-slate-800/50">
                    <td
                      onClick={() => onSelectRoom(r.roomId)}
                      className="py-2 px-2.5 font-extrabold text-emerald-400 cursor-pointer hover:underline"
                    >
                      {r.number}
                    </td>
                    <td className="py-2 px-2.5 font-medium text-white max-w-xs truncate" title={r.rawName}>
                      {r.rawName}
                    </td>
                    <td className="py-2 px-2.5">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: cat.fill, color: cat.color, border: `1px solid ${cat.border}` }}
                      >
                        {r.normalizedType}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 font-bold text-white">{r.area}</td>
                    <td className="py-2 px-2.5 text-slate-300 font-mono">{r.height}</td>
                    <td className="py-2 px-2.5 font-semibold text-sky-300 font-mono">{r.volume}</td>
                    <td className="py-2 px-2.5 text-xs text-teal-300 font-mono">
                      {occupantBadge}
                    </td>
                    <td className="py-2 px-2.5 text-xs text-slate-300 font-mono">
                      {r.normCode || 'СП 60.13330.2020'}
                    </td>
                    <td className="py-2 px-2.5 text-xs font-mono text-amber-300 max-w-md truncate" title={r.calculationFormula}>
                      {r.calculationFormula || `Lпр=${r.requiredSupplyAir}; Lвыт=${r.requiredExhaustAir}`}
                    </td>
                    <td className="py-2 px-2.5 font-bold text-blue-400 font-mono">{r.requiredSupplyAir}</td>
                    <td className="py-2 px-2.5 font-bold text-emerald-400 font-mono">{r.requiredExhaustAir}</td>
                    <td className="py-2 px-2.5 font-mono text-xs">
                      {r.balance > 0 ? (
                        <span className="text-blue-400">+{r.balance}</span>
                      ) : r.balance < 0 ? (
                        <span className="text-amber-400">{r.balance}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-2 px-2.5">
                      <button
                        onClick={() => onAiValidate(r.roomId)}
                        className="px-2 py-0.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-semibold transition-all"
                      >
                        Валидация
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-[#040d1a] border-t-2 border-emerald-500/40 font-extrabold text-xs sticky bottom-0">
              <tr>
                <td colSpan={3} className="py-2.5 px-2.5 text-white">ИТОГО ПО ЭТАЖУ:</td>
                <td className="py-2.5 px-2.5 text-emerald-400">{totalArea} м²</td>
                <td className="py-2.5 px-2.5 text-slate-300">{currentNetHeight} м</td>
                <td className="py-2.5 px-2.5 text-sky-400">{totalVol} м³</td>
                <td colSpan={3} className="py-2.5 px-2.5 text-slate-400">По нормам СП 60.13330 / СП 118.13330 / ГОСТ 21.602</td>
                <td className="py-2.5 px-2.5 text-blue-400">{totalSupply} м³/ч</td>
                <td className="py-2.5 px-2.5 text-emerald-400">{totalExhaust} м³/ч</td>
                <td colSpan={2} className="py-2.5 px-2.5 text-teal-300">
                  ΔL = {totalSupply - totalExhaust} м³/ч
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
