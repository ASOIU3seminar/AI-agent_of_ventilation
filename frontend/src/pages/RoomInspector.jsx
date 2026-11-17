import React from 'react';
import { ShieldCheck } from 'lucide-react';

export function RoomInspector({
  selectedRoom,
  onUpdateRoom,
  onAiValidate,
  onGoToEstimate,
  grandTotal
}) {
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
                Δh (м)
              </label>
              <input
                type="number"
                step="0.1"
                className="w-full bg-[#040d1a] border border-[#1e3a5f] rounded-xl px-2 py-1 text-xs text-white outline-none"
                value={selectedRoom.height}
                onChange={(e) => onUpdateRoom('height', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] text-sky-300 mb-1">
                V (м³)
              </label>
              <input
                disabled
                className="w-full bg-[#040d1a]/60 border border-[#1e3a5f] rounded-xl px-2 py-1 text-xs font-bold text-sky-300"
                value={selectedRoom.volume}
              />
            </div>
          </div>

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
