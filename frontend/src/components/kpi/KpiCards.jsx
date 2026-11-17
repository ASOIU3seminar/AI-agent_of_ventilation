import React from 'react';
import {
  Building2,
  Maximize2,
  Wind,
  Calculator
} from 'lucide-react';

export function KpiCards({
  roomsCount,
  currentNetHeight,
  totalArea,
  totalVol,
  totalSupply,
  totalExhaust,
  grandTotal
}) {
  return (
    <div className="grid grid-cols-4 gap-3 px-6 pt-3 shrink-0">
      <div className="p-3 rounded-xl bg-[#0b192c] border border-[#1e3a5f] border-l-4 border-l-blue-500 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-slate-400">Помещений / Высота</div>
          <div className="text-base font-extrabold text-white mt-0.5">
            {roomsCount} шт. • {currentNetHeight} м
          </div>
        </div>
        <Building2 className="w-6 h-6 text-blue-400 opacity-80" />
      </div>

      <div className="p-3 rounded-xl bg-[#0b192c] border border-[#1e3a5f] border-l-4 border-l-emerald-500 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-slate-400">Площадь / Объем</div>
          <div className="text-base font-extrabold text-emerald-400 mt-0.5">
            {totalArea} м² • {totalVol} м³
          </div>
        </div>
        <Maximize2 className="w-6 h-6 text-emerald-400 opacity-80" />
      </div>

      <div className="p-3 rounded-xl bg-[#0b192c] border border-[#1e3a5f] border-l-4 border-l-sky-500 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-slate-400">Приток / Вытяжка</div>
          <div className="text-base font-extrabold text-sky-400 mt-0.5">
            {totalSupply} / {totalExhaust} м³/ч
          </div>
        </div>
        <Wind className="w-6 h-6 text-sky-400 opacity-80" />
      </div>

      <div className="p-3 rounded-xl bg-[#0b192c] border border-[#1e3a5f] border-l-4 border-l-teal-400 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-slate-400">Смета ОВиК (Итого)</div>
          <div className="text-base font-extrabold text-teal-300 mt-0.5">
            {grandTotal.toLocaleString('ru-RU')} ₽
          </div>
        </div>
        <Calculator className="w-6 h-6 text-teal-400 opacity-80" />
      </div>
    </div>
  );
}
