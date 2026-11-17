import React, { useRef, useState, useMemo } from 'react';
import {
  Compass,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Building2,
  UploadCloud
} from 'lucide-react';
import { getRoomCategory } from '../constants/categories.js';

export function PlanCanvas({
  rooms,
  selectedId,
  onSelectRoom,
  activeFloor,
  currentNetHeight,
  activeCategoryFilter
}) {
  const svgRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [transform, setTransform] = useState({ scale: 1, panX: 0, panY: 0 });
  const [dragState, setDragState] = useState(null);

  // Слои чертежа
  const [showAxes, setShowAxes] = useState(true);
  const [showWalls, setShowWalls] = useState(true);
  const [showAirFlows, setShowAirFlows] = useState(true);
  const [showShafts, setShowShafts] = useState(true);

  const W_VIEW = 1400;
  const H_VIEW = 800;

  // Архитектурные границы этажа
  const FLOOR_BOX = {
    x: 140,
    y: 110,
    w: 1120,
    h: 580
  };

  // Строительные оси здания по ГОСТ 21.101
  const AXES_X = [
    { name: '1', pos: 140 },
    { name: '2', pos: 300 },
    { name: '3', pos: 460 },
    { name: '4', pos: 620 },
    { name: '5', pos: 780 },
    { name: '6', pos: 940 },
    { name: '7', pos: 1100 },
    { name: '8', pos: 1260 }
  ];

  const AXES_Y = [
    { name: 'А', pos: 110 },
    { name: 'Б', pos: 255 },
    { name: 'В', pos: 400 },
    { name: 'Г', pos: 545 },
    { name: 'Д', pos: 690 }
  ];

  // Инженерные шахты здания
  const SHAFTS = [
    { id: 'sh-p1', name: 'ШП-1', desc: 'Приточная шахта', x: 620, y: 360, w: 55, h: 40, type: 'supply' },
    { id: 'sh-v1', name: 'ШВ-1', desc: 'Вытяжная общая', x: 685, y: 360, w: 55, h: 40, type: 'exhaust' },
    { id: 'sh-vsu', name: 'ШВ-СУ', desc: 'Вытяжка санузлов', x: 1040, y: 130, w: 45, h: 35, type: 'exhaust' }
  ];

  // Умная привязка и масштабирование помещений к архитектурной сетке этажа
  const placedRooms = useMemo(() => {
    if (!rooms || rooms.length === 0) return [];

    const validCadRooms = rooms.filter(r => r.cadX !== null && r.cadX !== undefined && !isNaN(r.cadX));
    const hasRealCoords = validCadRooms.length >= Math.min(3, rooms.length * 0.4);

    if (hasRealCoords) {
      const xs = validCadRooms.map(r => Number(r.cadX));
      const ys = validCadRooms.map(r => Number(r.cadY));
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const spanX = Math.max(100, maxX - minX);
      const spanY = Math.max(100, maxY - minY);

      return rooms.map((r, i) => {
        const cat = getRoomCategory(r);
        const cadX = r.cadX !== null ? r.cadX : minX + (i % 6) * (spanX / 6);
        const cadY = r.cadY !== null ? r.cadY : minY + Math.floor(i / 6) * (spanY / 4);

        const normX = (cadX - minX) / spanX;
        const normY = (cadY - minY) / spanY;

        const xScr = FLOOR_BOX.x + 30 + normX * (FLOOR_BOX.w - 180);
        const yScr = FLOOR_BOX.y + 30 + (1 - normY) * (FLOOR_BOX.h - 140);

        const baseDim = Math.sqrt(Math.max(4, r.area));
        const wRect = Math.min(220, Math.max(90, Math.round(baseDim * 7.5)));
        const hRect = Math.min(130, Math.max(62, Math.round(baseDim * 5.2)));

        return { ...r, cat, xScr, yScr, wRect, hRect };
      });
    }

    let parkingSlot = 0;
    let techSlot = 0;
    let bathSlot = 0;
    let officeSlot = 0;
    let otherSlot = 0;

    return rooms.map((r) => {
      const cat = getRoomCategory(r);
      let xScr = FLOOR_BOX.x + 40;
      let yScr = FLOOR_BOX.y + 40;
      let wRect = 110;
      let hRect = 72;

      const baseScale = Math.sqrt(Math.max(4, r.area));

      if (cat.id === 'parking') {
        const col = parkingSlot % 2;
        const row = Math.floor(parkingSlot / 2);
        xScr = FLOOR_BOX.x + 30 + col * 280;
        yScr = FLOOR_BOX.y + 30 + row * 190;
        wRect = Math.min(260, Math.max(140, Math.round(baseScale * 6.5)));
        hRect = Math.min(180, Math.max(90, Math.round(baseScale * 4.8)));
        parkingSlot++;
      } else if (cat.id === 'bathroom' || cat.id === 'cleaning') {
        const col = bathSlot % 3;
        const row = Math.floor(bathSlot / 3);
        xScr = FLOOR_BOX.x + 760 + col * 110;
        yScr = FLOOR_BOX.y + 30 + row * 85;
        wRect = Math.min(105, Math.max(82, Math.round(baseScale * 14)));
        hRect = Math.min(78, Math.max(62, Math.round(baseScale * 11)));
        bathSlot++;
      } else if (cat.id === 'electrical' || cat.id === 'technical' || cat.id === 'ventilation') {
        const col = techSlot % 3;
        const row = Math.floor(techSlot / 3);
        xScr = FLOOR_BOX.x + 380 + col * 135;
        yScr = FLOOR_BOX.y + 330 + row * 95;
        wRect = Math.min(130, Math.max(95, Math.round(baseScale * 10)));
        hRect = Math.min(88, Math.max(65, Math.round(baseScale * 7.5)));
        techSlot++;
      } else if (cat.id === 'office') {
        const col = officeSlot % 4;
        const row = Math.floor(officeSlot / 4);
        xScr = FLOOR_BOX.x + 280 + col * 130;
        yScr = FLOOR_BOX.y + 30 + row * 95;
        wRect = Math.min(125, Math.max(92, Math.round(baseScale * 9)));
        hRect = Math.min(85, Math.max(64, Math.round(baseScale * 7)));
        officeSlot++;
      } else {
        const col = otherSlot % 4;
        const row = Math.floor(otherSlot / 4);
        xScr = FLOOR_BOX.x + 640 + col * 115;
        yScr = FLOOR_BOX.y + 210 + row * 90;
        wRect = Math.min(115, Math.max(88, Math.round(baseScale * 8.5)));
        hRect = Math.min(80, Math.max(62, Math.round(baseScale * 6.5)));
        otherSlot++;
      }

      xScr = Math.max(FLOOR_BOX.x + 20, Math.min(FLOOR_BOX.x + FLOOR_BOX.w - wRect - 20, xScr));
      yScr = Math.max(FLOOR_BOX.y + 20, Math.min(FLOOR_BOX.y + FLOOR_BOX.h - hRect - 20, yScr));

      return { ...r, cat, xScr, yScr, wRect, hRect };
    });
  }, [rooms]);

  // Зум и панорамирование
  const handleWheel = (e) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cursorX = ((e.clientX - rect.left) / rect.width) * W_VIEW;
    const cursorY = ((e.clientY - rect.top) / rect.height) * H_VIEW;

    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const newScale = Math.min(6, Math.max(0.5, transform.scale * factor));
    const ratio = newScale / transform.scale;

    const newPanX = cursorX - (cursorX - transform.panX) * ratio;
    const newPanY = cursorY - (cursorY - transform.panY) * ratio;

    setTransform({ scale: newScale, panX: newPanX, panY: newPanY });
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    setDragState({ startX: e.clientX, startY: e.clientY, origPanX: transform.panX, origPanY: transform.panY });
  };

  const handlePointerMove = (e) => {
    if (!dragState || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragState.startX) / rect.width) * W_VIEW;
    const dy = ((e.clientY - dragState.startY) / rect.height) * H_VIEW;
    setTransform(prev => ({ ...prev, panX: dragState.origPanX + dx, panY: dragState.origPanY + dy }));
  };

  const handlePointerUp = () => setDragState(null);

  const hoveredRoom = placedRooms.find(r => r.roomId === hoveredId);

  return (
    <div className="relative flex-1 min-h-[560px] rounded-2xl bg-[#040d1a] border border-[#1e3a5f] overflow-hidden select-none flex flex-col">
      {/* Верхняя инженерная панель управления слоями и масштабом */}
      <div className="z-30 flex flex-wrap items-center justify-between gap-2 bg-[#0b192c]/95 border-b border-[#1e3a5f] px-3.5 py-2">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-bold text-slate-300 mr-1 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            Слои CAD:
          </span>
          <button
            onClick={() => setShowAxes(!showAxes)}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-all ${
              showAxes ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-slate-800/40 text-slate-400 border-slate-700/60'
            }`}
          >
            Оси 1..8 / А..Д
          </button>
          <button
            onClick={() => setShowWalls(!showWalls)}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-all ${
              showWalls ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800/40 text-slate-400 border-slate-700/60'
            }`}
          >
            Несущие стены
          </button>
          <button
            onClick={() => setShowShafts(!showShafts)}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-all ${
              showShafts ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-slate-800/40 text-slate-400 border-slate-700/60'
            }`}
          >
            Вентшахты ШП/ШВ
          </button>
          <button
            onClick={() => setShowAirFlows(!showAirFlows)}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-all ${
              showAirFlows ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-800/40 text-slate-400 border-slate-700/60'
            }`}
          >
            Стрелки перетоков
          </button>
        </div>

        {/* Зум-контролы */}
        <div className="flex items-center gap-1 bg-[#040d1a] border border-[#1e3a5f] p-1 rounded-xl">
          <button
            onClick={() => setTransform(t => ({ ...t, scale: Math.min(6, t.scale * 1.2) }))}
            className="p-1 rounded-lg hover:bg-slate-800 text-emerald-400"
            title="Приблизить (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-slate-300 px-1.5">{Math.round(transform.scale * 100)}%</span>
          <button
            onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.5, t.scale * 0.85) }))}
            className="p-1 rounded-lg hover:bg-slate-800 text-blue-400"
            title="Отдалить (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setTransform({ scale: 1, panX: 0, panY: 0 })}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-300"
            title="Сбросить центрирование"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG холст плана */}
      <div className="relative flex-1">
        {placedRooms.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <UploadCloud className="w-12 h-12 text-emerald-400 mb-3 opacity-80" />
            <div className="text-base font-bold text-white">План этажа не загружен</div>
            <div className="text-xs text-slate-400 mt-1 max-w-md">
              Загрузите PDF чертеж экспликации этажа или нажмите «Загрузить демо-план», чтобы увидеть размещение комнат на осях.
            </div>
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W_VIEW} ${H_VIEW}`}
            preserveAspectRatio="xMidYMid meet"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="w-full h-full cursor-grab active:cursor-grabbing relative z-10"
          >
            <defs>
              <pattern id="cad-grid-fine" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(30, 58, 95, 0.22)" strokeWidth="0.8" />
              </pattern>
              <pattern id="cad-grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(30, 58, 95, 0.55)" strokeWidth="1.2" />
              </pattern>
              <marker id="arrow-supply" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M 0 0 L 6 3 L 0 6 z" fill="#38bdf8" />
              </marker>
              <marker id="arrow-exhaust" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M 0 0 L 6 3 L 0 6 z" fill="#34d399" />
              </marker>
            </defs>

            <g transform={`translate(${transform.panX}, ${transform.panY}) scale(${transform.scale})`}>
              <rect x="-1000" y="-1000" width="4000" height="3000" fill="url(#cad-grid-fine)" />
              <rect x="-1000" y="-1000" width="4000" height="3000" fill="url(#cad-grid-major)" />

              {/* НЕСУЩИЕ СТЕНЫ И КОНТУР */}
              {showWalls && (
                <g id="architectural-shell">
                  <rect
                    x={FLOOR_BOX.x}
                    y={FLOOR_BOX.y}
                    width={FLOOR_BOX.w}
                    height={FLOOR_BOX.h}
                    rx="12"
                    fill="rgba(8, 22, 42, 0.85)"
                    stroke="#1e3a5f"
                    strokeWidth="3.5"
                  />
                  <rect
                    x={FLOOR_BOX.x + 8}
                    y={FLOOR_BOX.y + 8}
                    width={FLOOR_BOX.w - 16}
                    height={FLOOR_BOX.h - 16}
                    rx="8"
                    fill="none"
                    stroke="rgba(56, 189, 248, 0.25)"
                    strokeWidth="1.5"
                    strokeDasharray="8 4"
                  />
                  <rect
                    x={FLOOR_BOX.x + 240}
                    y={FLOOR_BOX.y + 260}
                    width={FLOOR_BOX.w - 480}
                    height="60"
                    rx="6"
                    fill="rgba(2, 132, 199, 0.08)"
                    stroke="rgba(56, 189, 248, 0.35)"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={FLOOR_BOX.x + FLOOR_BOX.w / 2}
                    y={FLOOR_BOX.y + 296}
                    textAnchor="middle"
                    fill="rgba(148, 163, 184, 0.5)"
                    fontSize="11"
                    fontWeight="700"
                    letterSpacing="3"
                  >
                    ЦЕНТРАЛЬНЫЙ КОРИДОР / РАСПРЕДЕЛИТЕЛЬНЫЙ ХОЛЛ
                  </text>

                  {AXES_X.map(ax =>
                    AXES_Y.map(ay => (
                      <rect
                        key={`col-${ax.name}-${ay.name}`}
                        x={ax.pos - 5}
                        y={ay.pos - 5}
                        width="10"
                        height="10"
                        fill="#0ea5e9"
                        opacity="0.6"
                      />
                    ))
                  )}
                </g>
              )}

              {/* СТРОИТЕЛЬНЫЕ ОСИ И МАРКИ (ГОСТ 21.101) */}
              {showAxes && (
                <g id="structural-axes">
                  {AXES_X.map(ax => (
                    <g key={`axis-x-${ax.name}`}>
                      <line
                        x1={ax.pos}
                        y1={FLOOR_BOX.y - 45}
                        x2={ax.pos}
                        y2={FLOOR_BOX.y + FLOOR_BOX.h + 45}
                        stroke="rgba(239, 68, 68, 0.45)"
                        strokeWidth="1.2"
                        strokeDasharray="16 4 4 4"
                      />
                      <circle cx={ax.pos} cy={FLOOR_BOX.y - 55} r="14" fill="#0b192c" stroke="#ef4444" strokeWidth="1.5" />
                      <text x={ax.pos} y={FLOOR_BOX.y - 50} textAnchor="middle" fill="#fca5a5" fontSize="12" fontWeight="800">
                        {ax.name}
                      </text>
                      <circle cx={ax.pos} cy={FLOOR_BOX.y + FLOOR_BOX.h + 55} r="14" fill="#0b192c" stroke="#ef4444" strokeWidth="1.5" />
                      <text x={ax.pos} y={FLOOR_BOX.y + FLOOR_BOX.h + 60} textAnchor="middle" fill="#fca5a5" fontSize="12" fontWeight="800">
                        {ax.name}
                      </text>
                    </g>
                  ))}

                  {AXES_Y.map(ay => (
                    <g key={`axis-y-${ay.name}`}>
                      <line
                        x1={FLOOR_BOX.x - 45}
                        y1={ay.pos}
                        x2={FLOOR_BOX.x + FLOOR_BOX.w + 45}
                        y2={ay.pos}
                        stroke="rgba(239, 68, 68, 0.45)"
                        strokeWidth="1.2"
                        strokeDasharray="16 4 4 4"
                      />
                      <circle cx={FLOOR_BOX.x - 55} cy={ay.pos} r="14" fill="#0b192c" stroke="#ef4444" strokeWidth="1.5" />
                      <text x={FLOOR_BOX.x - 55} y={ay.pos + 4.5} textAnchor="middle" fill="#fca5a5" fontSize="12" fontWeight="800">
                        {ay.name}
                      </text>
                      <circle cx={FLOOR_BOX.x + FLOOR_BOX.w + 55} cy={ay.pos} r="14" fill="#0b192c" stroke="#ef4444" strokeWidth="1.5" />
                      <text x={FLOOR_BOX.x + FLOOR_BOX.w + 55} y={ay.pos + 4.5} textAnchor="middle" fill="#fca5a5" fontSize="12" fontWeight="800">
                        {ay.name}
                      </text>
                    </g>
                  ))}
                </g>
              )}

              {/* ШАХТЫ */}
              {showShafts && (
                <g id="hvac-shafts">
                  {SHAFTS.map(sh => (
                    <g key={sh.id} transform={`translate(${sh.x}, ${sh.y})`}>
                      <rect
                        width={sh.w}
                        height={sh.h}
                        fill={sh.type === 'supply' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(16, 185, 129, 0.25)'}
                        stroke={sh.type === 'supply' ? '#38bdf8' : '#34d399'}
                        strokeWidth="2"
                        strokeDasharray="3 2"
                      />
                      <line x1="0" y1="0" x2={sh.w} y2={sh.h} stroke={sh.type === 'supply' ? '#38bdf8' : '#34d399'} strokeWidth="1.2" opacity="0.6" />
                      <line x1={sh.w} y1="0" x2="0" y2={sh.h} stroke={sh.type === 'supply' ? '#38bdf8' : '#34d399'} strokeWidth="1.2" opacity="0.6" />
                      <rect x="2" y="-18" width={sh.w - 4} height="15" rx="3" fill="#040d1a" stroke={sh.type === 'supply' ? '#38bdf8' : '#34d399'} strokeWidth="1" />
                      <text x={sh.w / 2} y="-7" textAnchor="middle" fill="#ffffff" fontSize="9.5" fontWeight="800">
                        {sh.name}
                      </text>
                    </g>
                  ))}
                </g>
              )}

              {/* ПОМЕЩЕНИЯ */}
              <g id="rooms-layer">
                {placedRooms.map((r) => {
                  const isSelected = r.roomId === selectedId;
                  const isHovered = r.roomId === hoveredId;
                  const cat = r.cat;

                  const isDimmed = activeCategoryFilter && activeCategoryFilter !== cat.id;

                  const fill = isSelected || isHovered
                    ? cat.color + '45'
                    : isDimmed
                    ? 'rgba(15, 23, 42, 0.45)'
                    : cat.fill;

                  const stroke = isSelected
                    ? '#ffffff'
                    : isHovered
                    ? '#34d399'
                    : isDimmed
                    ? '#334155'
                    : cat.border;

                  const strokeWidth = isSelected ? 3 : isHovered ? 2.4 : 1.4;

                  return (
                    <g
                      key={r.roomId}
                      transform={`translate(${r.xScr}, ${r.yScr})`}
                      onClick={(e) => { e.stopPropagation(); onSelectRoom(r.roomId); }}
                      onMouseEnter={() => setHoveredId(r.roomId)}
                      onMouseLeave={() => setHoveredId(null)}
                      className="cursor-pointer transition-all duration-150"
                      opacity={isDimmed ? 0.35 : 1}
                    >
                      <rect
                        width={r.wRect}
                        height={r.hRect}
                        rx="8"
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        filter={isSelected ? 'drop-shadow(0 0 10px rgba(56, 189, 248, 0.6))' : 'none'}
                      />

                      <path
                        d={`M 1 7 Q 1 1 7 1 L ${r.wRect - 7} 1 Q ${r.wRect - 1} 1 ${r.wRect - 1} 7 L ${r.wRect - 1} 7 L 1 7 Z`}
                        fill={cat.color}
                        opacity={isDimmed ? 0.3 : 0.85}
                      />

                      <rect x="5" y="11" width="48" height="17" rx="4" fill="rgba(4, 13, 26, 0.92)" stroke={cat.border} strokeWidth="0.8" />
                      <text x="8" y="23" fill="#ffffff" fontSize="9.5" fontWeight="800">
                        {r.number}
                      </text>

                      <text x={r.wRect - 6} y="23" textAnchor="end" fill="#f8fafc" fontSize="10" fontWeight="800">
                        {r.area} м²
                      </text>

                      <text x="6" y="42" fill="#e2e8f0" fontSize="9.5" fontWeight="600">
                        {(r.rawName || '').slice(0, Math.floor(r.wRect / 8.5))}
                      </text>

                      <text x="6" y="55" fill={cat.color} fontSize="8.5" fontWeight="700">
                        {cat.label.split('/')[0].trim()}
                      </text>

                      <g transform={`translate(6, ${r.hRect - 10})`}>
                        <text fill="#38bdf8" fontSize="8.5" fontWeight="700">
                          П: {r.requiredSupplyAir}
                        </text>
                        <text x="48" fill="#34d399" fontSize="8.5" fontWeight="700">
                          В: {r.requiredExhaustAir}
                        </text>
                      </g>

                      {showAirFlows && !isDimmed && (
                        <g>
                          {r.requiredSupplyAir > 0 && (
                            <line
                              x1="8"
                              y1={r.hRect / 2}
                              x2="22"
                              y2={r.hRect / 2}
                              stroke="#38bdf8"
                              strokeWidth="1.8"
                              markerEnd="url(#arrow-supply)"
                            />
                          )}
                          {r.requiredExhaustAir > 0 && (
                            <line
                              x1={r.wRect - 22}
                              y1={r.hRect / 2}
                              x2={r.wRect - 8}
                              y2={r.hRect / 2}
                              stroke="#34d399"
                              strokeWidth="1.8"
                              markerEnd="url(#arrow-exhaust)"
                            />
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}

        {/* Индикатор текущего этажа */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-[#0b192c]/95 border border-[#1e3a5f] px-3 py-1.5 rounded-xl shadow-lg text-xs">
          <Building2 className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white">{activeFloor?.name}</span>
          <span className="text-slate-400">•</span>
          <span className="text-sky-300 font-mono">
            Отм. {activeFloor?.elevationBottom} .. +{activeFloor?.elevationTop} м
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-emerald-300 font-extrabold font-mono">Δh = {currentNetHeight} м</span>
        </div>

        {/* Тултип при наведении */}
        {hoveredRoom && (
          <div className="absolute bottom-3 right-3 z-30 bg-[#040d1a]/95 border border-emerald-500/60 rounded-xl p-3.5 text-xs shadow-2xl pointer-events-none space-y-1.5 max-w-sm backdrop-blur">
            <div className="flex items-center justify-between gap-2 border-b border-[#1e3a5f] pb-1.5">
              <span className="font-extrabold text-emerald-300 text-sm">
                № {hoveredRoom.number}
              </span>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-extrabold"
                style={{
                  backgroundColor: hoveredRoom.cat.fill,
                  color: hoveredRoom.cat.color,
                  border: `1px solid ${hoveredRoom.cat.border}`
                }}
              >
                {hoveredRoom.cat.label}
              </span>
            </div>
            <div className="font-semibold text-white">
              {hoveredRoom.rawName}
            </div>
            <div className="text-slate-300 text-[11px] grid grid-cols-3 gap-1 pt-1">
              <div>S: <strong className="text-white">{hoveredRoom.area} м²</strong></div>
              <div>Δh: <strong className="text-white">{hoveredRoom.height} м</strong></div>
              <div>V: <strong className="text-sky-300">{hoveredRoom.volume} м³</strong></div>
            </div>
            <div className="pt-1 text-[11px] font-bold text-sky-300 border-t border-[#1e3a5f]/60">
              Приток: {hoveredRoom.requiredSupplyAir} м³/ч | Вытяжка: {hoveredRoom.requiredExhaustAir} м³/ч (ΔL: {hoveredRoom.balance})
            </div>
            <div className="text-[10px] text-slate-400">
              {hoveredRoom.normCode} — {hoveredRoom.normCitation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
