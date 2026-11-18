import React from 'react';
import { ShieldCheck, Users, Bath, Wind } from 'lucide-react';

export function RoomInspector({
  selectedRoom,
  onUpdateRoom,
  onAiValidate,
  onGoToEstimate,
  grandTotal
}) {
  const isSanitary = selectedRoom && (
    selectedRoom.normalizedType === 'Санузел' ||
    selectedRoom.normalizedType === 'Душевая' ||
    (selectedRoom.rawName || '').toLowerCase().includes('санузел') ||
    (selectedRoom.rawName || '').toLowerCase().includes('уборн') ||
    (selectedRoom.rawName || '').toLowerCase().includes('туалет') ||
    (selectedRoom.rawName || '').toLowerCase().includes('душ')
  );

  const isOffice = selectedRoom && (
    selectedRoom.normalizedType?.includes('Офис') ||
    selectedRoom.normalizedType?.includes('Рабочее') ||
    (selectedRoom.rawName || '').toLowerCase().includes('офис') ||
    (selectedRoom.rawName || '').toLowerCase().includes('кабинет') ||
    (selectedRoom.rawName || '').toLowerCase().includes('переговор') ||
    (selectedRoom.rawName || '').toLowerCase().includes('пост') ||
    (selectedRoom.rawName || '').toLowerCase().includes('охрана')
  );

  return (
    <div className="col-span-3 p-4 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] flex flex-col justify-between overflow-y-auto">
      {selectedRoom ? (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between border-b border-[#1e3a5f] pb-2.5">
            <div>
              <span className="text-[10px] text-emerald-400 font-bold uppercase">
                {selectedRoom.systemTag}
              </span>
              <h3 className="text-base font-extrabold text-white">
                Помещение {selectedRoom.number}
              </h3>
            </div>
            <button
              onClick={() => onAiValidate(selectedRoom.roomId)}
              className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 hover:bg-emerald-500/30 transition-all"
            >
              <ShieldCheck className="w-3 h-3" /> Норматив
            </button>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Наименование (экспликация)
            </label>
            <textarea
              rows={2}
              className="w-full bg-[#040d1a] border border-[#1e3a5f] rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
              value={selectedRoom.rawName}
              onChange={(e) => onUpdateRoom('rawName', e.target.value)}
            />
          </div>

          {/* Геометрия помещения и высота */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-emerald-300 font-semibold mb-1">
                S (м²)
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full bg-[#040d1a] border border-emerald-500/60 rounded-xl px-2 py-1 text-xs font-extrabold text-emerald-300 outline-none"
                value={selectedRoom.area}
                onChange={(e) => onUpdateRoom('area', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">
                Высота H (м)
              </label>
              <input
                type="number"
                step="0.1"
                className="w-full bg-[#040d1a] border border-[#1e3a5f] rounded-xl px-2 py-1 text-xs text-white outline-none"
                value={selectedRoom.height}
                onChange={(e) => onUpdateRoom('height', parseFloat(e.target.value) || 3.3)}
              />
            </div>
            <div>
              <label className="block text-[10px] text-sky-300 mb-1">
                Объем V (м³)
              </label>
              <input
                disabled
                className="w-full bg-[#040d1a]/60 border border-[#1e3a5f] rounded-xl px-2 py-1 text-xs font-bold text-sky-300"
                value={selectedRoom.volume}
              />
            </div>
          </div>

          {/* Специальный блок: Расчет санузлов по сан. приборам (СП 118.13330 / СП 44.13330) */}
          {isSanitary && (
            <div className="p-3 rounded-xl bg-[#040d1a] border border-teal-500/40 text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-teal-300 font-bold text-[11px]">
                <Bath className="w-3.5 h-3.5" /> Расчет по сан. приборам (СП 118 / СП 44)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400">Унитазы (50 м³/ч):</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full mt-0.5 bg-slate-900 border border-[#1e3a5f] rounded-lg px-2 py-1 text-xs text-white font-mono"
                    value={selectedRoom.toilets ?? 1}
                    onChange={(e) => onUpdateRoom('toilets', parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">Писсуары (25 м³/ч):</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full mt-0.5 bg-slate-900 border border-[#1e3a5f] rounded-lg px-2 py-1 text-xs text-white font-mono"
                    value={selectedRoom.urinals ?? 0}
                    onChange={(e) => onUpdateRoom('urinals', parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">Душевые сетки (75 м³/ч):</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full mt-0.5 bg-slate-900 border border-[#1e3a5f] rounded-lg px-2 py-1 text-xs text-white font-mono"
                    value={selectedRoom.showers ?? 0}
                    onChange={(e) => onUpdateRoom('showers', parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">Раковины (20 м³/ч):</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full mt-0.5 bg-slate-900 border border-[#1e3a5f] rounded-lg px-2 py-1 text-xs text-white font-mono"
                    value={selectedRoom.sinks ?? 0}
                    onChange={(e) => onUpdateRoom('sinks', parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Специальный блок: Расчет офисов строго по людям (СП 60.13330 / СанПиН) */}
          {isOffice && (
            <div className="p-3 rounded-xl bg-[#040d1a] border border-blue-500/40 text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-blue-300 font-bold text-[11px]">
                <Users className="w-3.5 h-3.5" /> Расчет по людям (СП 60 / СанПиН)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400">Сотрудники N (чел):</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full mt-0.5 bg-slate-900 border border-[#1e3a5f] rounded-lg px-2 py-1 text-xs text-white font-mono font-bold"
                    value={selectedRoom.peopleCount || Math.max(1, Math.ceil(selectedRoom.area / 6.0))}
                    onChange={(e) => onUpdateRoom('peopleCount', parseInt(e.target.value, 10) || 1)}
                  />
                  <span className="text-[9px] text-slate-500">По СанПиН: 6 м²/чел</span>
                </div>
                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-300 mt-2">
                    <input
                      type="checkbox"
                      checked={!!selectedRoom.hasNaturalVentilation}
                      onChange={(e) => onUpdateRoom('hasNaturalVentilation', e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span>Окна (40 м³/ч вместо 60)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Карточка категории и норматива */}
          <div className="p-3 rounded-xl bg-[#040d1a] border border-[#1e3a5f] text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-[11px]">Категория:</span>
              <strong className="text-emerald-300 font-bold">{selectedRoom.normalizedType}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-[11px]">СП / Норматив:</span>
              <strong className="text-white text-[11px]">{selectedRoom.normCode}</strong>
            </div>
            <div className="text-[10px] text-slate-400 border-l-2 border-emerald-500 pl-1.5 py-0.5">
              {selectedRoom.normCitation}
            </div>
            <div className="text-[10px] font-mono text-amber-300 bg-slate-900/80 p-1.5 rounded border border-slate-800">
              {selectedRoom.calculationFormula}
            </div>
            <div className="flex justify-between pt-1 border-t border-[#1e3a5f]/60 text-[11px]">
              <span className="text-slate-400">Приток Lпр / Вытяжка Lвыт:</span>
              <strong className="text-sky-400 font-bold font-mono">
                {selectedRoom.requiredSupplyAir} / {selectedRoom.requiredExhaustAir} м³/ч
              </strong>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Дисбаланс ΔL:</span>
              <strong className={selectedRoom.balance >= 0 ? 'text-blue-400' : 'text-emerald-400'}>
                {selectedRoom.balance > 0 ? `+${selectedRoom.balance}` : selectedRoom.balance} м³/ч
              </strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-400 text-center py-8">
          Выберите помещение на плане для просмотра и редактирования параметров
        </div>
      )}

      <button
        onClick={onGoToEstimate}
        className="w-full mt-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-emerald-500/30 transition-all"
      >
        Смета ОВиК ({grandTotal.toLocaleString('ru-RU')} ₽)
      </button>
    </div>
  );
}
