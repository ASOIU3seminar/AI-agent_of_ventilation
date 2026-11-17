import React, { useMemo, useState } from 'react';
import { PlanCanvas } from './PlanCanvas.jsx';
import { CategoryLegend } from './CategoryLegend.jsx';
import { RoomInspector } from './RoomInspector.jsx';
import { getRoomCategory } from '../constants/categories.js';

export function MapPage({
  rooms,
  selectedId,
  onSelectRoom,
  activeFloor,
  currentNetHeight,
  onUpdateRoom,
  onAiValidate,
  onGoToEstimate,
  grandTotal
}) {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState(null);

  const selectedRoom = rooms.find(r => r.roomId === selectedId) || rooms[0] || null;

  // Активные категории помещений
  const activeCategories = useMemo(() => {
    const map = new Map();
    rooms.forEach(r => {
      const cat = getRoomCategory(r);
      if (!map.has(cat.id)) {
        map.set(cat.id, { ...cat, count: 0 });
      }
      map.get(cat.id).count++;
    });
    return Array.from(map.values());
  }, [rooms]);

  return (
    <div className="p-4 flex flex-col flex-1 gap-3">
      {/* Палитра-легенда категорий СП */}
      <CategoryLegend
        activeCategories={activeCategories}
        totalRoomsCount={rooms.length}
        activeCategoryFilter={activeCategoryFilter}
        onSelectCategoryFilter={setActiveCategoryFilter}
      />

      <div className="grid grid-cols-12 gap-4 flex-1">
        {/* Карта этажа (75% ширины экрана = 9 колонок) */}
        <div className="col-span-9 p-4 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] flex flex-col min-h-[580px]">
          <PlanCanvas
            rooms={rooms}
            selectedId={selectedId}
            onSelectRoom={onSelectRoom}
            activeFloor={activeFloor}
            currentNetHeight={currentNetHeight}
            activeCategoryFilter={activeCategoryFilter}
          />
        </div>

        {/* Боковой инспектор комнаты (25% = 3 колонки) */}
        <RoomInspector
          selectedRoom={selectedRoom}
          onUpdateRoom={onUpdateRoom}
          onAiValidate={onAiValidate}
          onGoToEstimate={onGoToEstimate}
          grandTotal={grandTotal}
        />
      </div>
    </div>
  );
}
