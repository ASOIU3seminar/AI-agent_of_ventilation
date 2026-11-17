import React from 'react';
import {
  Wind,
  Map as MapIcon,
  Sliders,
  Table2,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Cpu
} from 'lucide-react';

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  activeTab,
  onSelectTab,
  roomsCount,
  floorsCount,
  systemsCount,
  activeFloor,
  currentNetHeight
}) {
  return (
    <aside
      className={`${
        isCollapsed ? 'w-16' : 'w-56'
      } bg-[#0b192c] border-r border-[#1e3a5f] flex flex-col justify-between shrink-0 p-3 transition-all duration-200 select-none`}
    >
      <div>
        {/* Заголовок бренда */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1e3a5f]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-emerald-400 flex items-center justify-center font-black text-sm text-white shadow-md shadow-emerald-500/25 shrink-0">
              <Wind className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="leading-tight truncate">
                <div className="font-extrabold text-xs bg-gradient-to-r from-blue-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent truncate">
                  AI Ventilation
                </div>
                <div className="text-[10px] text-slate-400 truncate">СП 60 • ХОВС • ГОСТ</div>
              </div>
            )}
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            title={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Кнопки инженерных модулей */}
        <div className="mt-3 space-y-1">
          {!isCollapsed && (
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
              Модули
            </div>
          )}

          <button
            onClick={() => onSelectTab('map')}
            title="2D-Карта (CAD SVG)"
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center p-2' : 'justify-between py-2 px-2.5'
            } rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'map'
                ? 'bg-gradient-to-r from-blue-600/35 to-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-emerald-400 shrink-0" />
              {!isCollapsed && <span>2D-План этажа</span>}
            </span>
            {!isCollapsed && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold font-mono">
                {roomsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('floors')}
            title="Этажи и Отметки (Δh)"
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center p-2' : 'justify-between py-2 px-2.5'
            } rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'floors'
                ? 'bg-gradient-to-r from-blue-600/35 to-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-400 shrink-0" />
              {!isCollapsed && <span>Этажи и Δh</span>}
            </span>
            {!isCollapsed && (
              <span className="px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-bold font-mono">
                {floorsCount} эт.
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('table')}
            title="Экспликация и СП"
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center p-2' : 'justify-between py-2 px-2.5'
            } rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'table'
                ? 'bg-gradient-to-r from-blue-600/35 to-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Table2 className="w-4 h-4 text-sky-400 shrink-0" />
              {!isCollapsed && <span>Экспликация СП</span>}
            </span>
            {!isCollapsed && (
              <span className="px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                ХОВС
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('estimate')}
            title="Смета ОВиК и Сеть"
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center p-2' : 'justify-between py-2 px-2.5'
            } rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'estimate'
                ? 'bg-gradient-to-r from-blue-600/35 to-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-blue-400 shrink-0" />
              {!isCollapsed && <span>Смета ОВиК</span>}
            </span>
            {!isCollapsed && (
              <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold font-mono">
                {systemsCount} с.
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Компактный информационный индикатор */}
      {!isCollapsed && (
        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/30 text-[11px] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-emerald-400">
            <Cpu className="w-3.5 h-3.5" /> Нормы СП
          </div>
          <div className="text-slate-300 truncate">{activeFloor?.name}</div>
          <div className="text-[10px] text-sky-300 font-mono">
            Δh = {currentNetHeight} м (плита {activeFloor?.slabThickness} м)
          </div>
        </div>
      )}
    </aside>
  );
}
