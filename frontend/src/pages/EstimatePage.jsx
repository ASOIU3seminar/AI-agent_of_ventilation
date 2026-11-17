import React from 'react';
import { Wind, FileSpreadsheet } from 'lucide-react';

export function EstimatePage({ estimate, onExportExcel }) {
  return (
    <div className="p-6 space-y-6">
      {/* Сводная таблица систем вентиляции */}
      <div className="p-6 rounded-2xl bg-[#0b192c] border border-[#1e3a5f]">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wind className="w-5 h-5 text-emerald-400" />
              Автоматическая группировка систем вентиляции (П и В) и аэродинамика
            </h3>
            <p className="text-xs text-slate-400">
              Магистральные воздуховоды: v₁ = 4.5 м/с, ответвления: v₂ = 2.5 м/с (с запасом +10% по СП 60.13330)
            </p>
          </div>
          <button
            onClick={onExportExcel}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" /> Выгрузить смету и ХОВС в Excel
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-[#1e3a5f]">
                <th className="py-2.5 px-3">Система</th>
                <th className="py-2.5 px-3">Назначение системы</th>
                <th className="py-2.5 px-3">Помещений</th>
                <th className="py-2.5 px-3">Расход L (+10%), м³/ч</th>
                <th className="py-2.5 px-3">Сечение магистрали F₁, м²</th>
                <th className="py-2.5 px-3">Площадь стали S, м²</th>
                <th className="py-2.5 px-3">Толщина стали (СП 60)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3a5f]/60">
              {estimate.systems.map((s) => (
                <tr key={s.code} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-extrabold text-emerald-400">{s.code}</td>
                  <td className="py-2.5 px-3 text-white font-medium">{s.type}</td>
                  <td className="py-2.5 px-3">{s.count} шт.</td>
                  <td className="py-2.5 px-3 font-bold text-sky-400">{s.flow.toLocaleString('ru-RU')} м³/ч</td>
                  <td className="py-2.5 px-3 font-mono">{s.fMain} м²</td>
                  <td className="py-2.5 px-3 font-bold text-white">{s.ductArea} м²</td>
                  <td className="py-2.5 px-3 text-xs text-slate-300">{s.metal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Детальная сметная ведомость ОВиК */}
      <div className="p-6 rounded-2xl bg-[#0b192c] border border-[#1e3a5f]">
        <h3 className="text-lg font-bold text-white mb-4">
          Сметная ведомость стоимости оборудования, воздуховодов, ОЗК, монтажа и ПНР
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-[#1e3a5f]">
                <th className="py-2.5 px-3">Раздел сметы</th>
                <th className="py-2.5 px-3">Наименование позиции</th>
                <th className="py-2.5 px-3">Ед. изм.</th>
                <th className="py-2.5 px-3">Кол-во</th>
                <th className="py-2.5 px-3">Цена за ед., ₽</th>
                <th className="py-2.5 px-3">Сумма, ₽</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3a5f]/60">
              {estimate.items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 text-xs text-emerald-300 font-semibold">{item.category}</td>
                  <td className="py-2.5 px-3 text-white">{item.name}</td>
                  <td className="py-2.5 px-3 text-slate-400">{item.unit}</td>
                  <td className="py-2.5 px-3 font-bold text-white">{item.qty}</td>
                  <td className="py-2.5 px-3 text-slate-300">{item.price.toLocaleString('ru-RU')} ₽</td>
                  <td className="py-2.5 px-3 font-extrabold text-sky-300">{item.total.toLocaleString('ru-RU')} ₽</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-emerald-500/50 bg-emerald-500/10 font-extrabold text-base">
                <td colSpan={5} className="py-3 px-3 text-right text-white">
                  ИТОГО ПО СМЕТЕ ОВиК (Оборудование + Сеть + СМР + ПНР):
                </td>
                <td className="py-3 px-3 text-emerald-400">
                  {estimate.grandTotal.toLocaleString('ru-RU')} ₽
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
