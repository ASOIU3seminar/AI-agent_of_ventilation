import React, { useState, useMemo } from 'react';
import axios from 'axios';

// Компоненты разметки и KPI
import { Sidebar } from './components/layout/Sidebar.jsx';
import { Header } from './components/layout/Header.jsx';
import { KpiCards } from './components/kpi/KpiCards.jsx';
import { AlertBanner } from './components/common/AlertBanner.jsx';

// Страницы инженерных модулей
import { MapPage } from './pages/MapPage.jsx';
import { FloorsPage } from './pages/FloorsPage.jsx';
import { ExplicationPage } from './pages/ExplicationPage.jsx';
import { EstimatePage } from './pages/EstimatePage.jsx';

// Утилиты и нормативный движок
import { calcNetHeight } from './utils/elevations.js';
import { evaluateRoomNorms } from './utils/normsEngine.js';
import { buildHvacEstimate } from './utils/estimateCalc.js';
import { extractExplicationFromPdfBuffer } from './utils/pdfParser.js';
import { exportHovsToExcel } from './utils/exportExcel.js';
import { generateDemoRoomsForFloor } from './constants/mockData.js';

const API_BASE = 'http://localhost:5000/api/hvac';

export function App() {
  const [cadFile, setCadFile] = useState(null);
  const [activeTab, setActiveTab] = useState('map');

  // Поэтапное управление этажами: начинаем с чистого перечня отметок без плит
  const [floors, setFloors] = useState([
    { id: 'f-1', code: '1', name: '1-й этаж (Вестибюль / Офисы)', elevationBottom: 0.000, elevationTop: 3.600, height: 3.600 }
  ]);
  const [activeFloorId, setActiveFloorId] = useState('f-1');

  // Сворачивание сайдбара
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Комнаты и выбор
  const [rawRooms, setRawRooms] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // Статусные сообщения
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const activeFloor = floors.find(f => f.id === activeFloorId) || floors[0];
  const currentNetHeight = calcNetHeight(activeFloor);

  // Реактивный пересчет комнат при изменении высот этажа
  const rooms = useMemo(() => {
    return rawRooms.map(r => evaluateRoomNorms(r, r.customHeight || currentNetHeight));
  }, [rawRooms, currentNetHeight]);

  const estimate = useMemo(() => buildHvacEstimate(rooms), [rooms]);

  // Управление этажами
  const handleUpdateFloor = (floorId, field, value) => {
    setFloors(prev => prev.map(f => (f.id === floorId ? { ...f, [field]: value } : f)));
  };

  const handleAddFloorAbove = () => {
    const sorted = [...floors].sort((a, b) => b.elevationTop - a.elevationTop);
    const topFloor = sorted[0];
    const bot = topFloor ? topFloor.elevationTop : 0;
    const top = +(bot + 3.3).toFixed(3);
    const nextNum = floors.length + 1;

    const newFloor = {
      id: `f-${Date.now()}`,
      code: String(nextNum),
      name: `${nextNum}-й этаж`,
      elevationBottom: bot,
      elevationTop: top,
      height: 3.300
    };
    setFloors(prev => [...prev, newFloor]);
    setActiveFloorId(newFloor.id);
    setSuccessMsg(`Добавлен уровень «${newFloor.name}» (отм. ${bot} .. +${top} м, чистая высота Δh = ${newFloor.height} м).`);
  };

  const handleAddFloorBelow = () => {
    const sorted = [...floors].sort((a, b) => a.elevationBottom - b.elevationBottom);
    const botFloor = sorted[0];
    const top = botFloor ? botFloor.elevationBottom : 0;
    const bot = +(top - 3.6).toFixed(3);
    const countUnderground = floors.filter(f => f.elevationBottom < 0).length + 1;

    const newFloor = {
      id: `f-b-${Date.now()}`,
      code: `-${countUnderground}`,
      name: `Подземный -${countUnderground} этаж (Паркинг)`,
      elevationBottom: bot,
      elevationTop: top,
      height: 3.600
    };
    setFloors(prev => [newFloor, ...prev]);
    setActiveFloorId(newFloor.id);
    setSuccessMsg(`Добавлен подземный уровень «${newFloor.name}» (отм. ${bot} .. ${top} м, чистая высота Δh = ${newFloor.height} м).`);
  };

  const handleDeleteFloor = (floorId) => {
    if (floors.length <= 1) {
      setError('Нельзя удалить единственный оставшийся этаж здания!');
      return;
    }
    const filtered = floors.filter(f => f.id !== floorId);
    setFloors(filtered);
    if (activeFloorId === floorId) {
      setActiveFloorId(filtered[0].id);
    }
    setSuccessMsg('Уровень здания удален.');
  };

  // Загрузка демо-плана
  const handleLoadDemoRooms = () => {
    const demo = generateDemoRoomsForFloor(activeFloor);
    setRawRooms(demo);
    setSelectedId(demo[0].roomId);
    setSuccessMsg(`Загружен демонстрационный план этажа «${activeFloor.name}» (${demo.length} помещений).`);
  };

  // Загрузка PDF чертежа
  const handlePdfSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCadFile(file);
    setError('');
    setSuccessMsg('');

    try {
      const buffer = await file.arrayBuffer();
      const extracted = await extractExplicationFromPdfBuffer(buffer);
      const floorInfo = extracted.floorInfo;

      if (floorInfo) {
        setFloors(prev => {
          const existing = prev.find(f => f.code === floorInfo.floorCode || Math.abs(f.elevationBottom - floorInfo.elevation) < 0.2);
          if (existing) {
            return prev.map(f => f.id === existing.id ? { ...f, height: floorInfo.height, name: floorInfo.name, elevationBottom: floorInfo.elevation } : f);
          }
          const newF = {
            id: `floor-${floorInfo.floorCode}`,
            code: floorInfo.floorCode,
            name: floorInfo.name,
            elevationBottom: floorInfo.elevation,
            elevationTop: +(floorInfo.elevation + floorInfo.height).toFixed(3),
            height: floorInfo.height
          };
          return [newF, ...prev];
        });
        setActiveFloorId(`floor-${floorInfo.floorCode}`);
      }

      if (extracted && extracted.length > 0) {
        setRawRooms(extracted);
        setSelectedId(extracted[0].roomId);
        setSuccessMsg(`Успешно загружен архитектурный чертеж «${file.name}» (${floorInfo?.name || 'План этажа'}). Извлечено ${extracted.length} помещений. Чистая высота этажа Δh = ${floorInfo?.height || 3.6} м (из проекта PDF без вычета плит).`);
      } else {
        const fd = new FormData();
        fd.append('cadFile', file);
        try {
          const res = await axios.post(`${API_BASE}/analyze`, fd, { timeout: 6000 });
          const backendRooms = res.data?.rooms || [];
          if (backendRooms.length > 0) {
            setRawRooms(backendRooms);
            setSelectedId(backendRooms[0].roomId);
            setSuccessMsg(`Распознано через CAD-экстрактор: ${backendRooms.length} комнат.`);
            return;
          }
        } catch {}

        const demo = generateDemoRoomsForFloor(activeFloor);
        setRawRooms(demo);
        setSelectedId(demo[0].roomId);
        setSuccessMsg(`В загруженном файле не найдена таблица экспликации — загружен типовой план (${demo.length} комнат).`);
      }
    } catch (err) {
      console.error('PDF Parse Error:', err);
      setError(`Ошибка парсинга PDF: ${err.message}`);
    }
  };

  const handleUpdateRoom = (roomId, field, value) => {
    setRawRooms(prev =>
      prev.map(r => {
        if (r.roomId !== roomId) return r;
        if (field === 'height') return { ...r, height: value, customHeight: value, isOverridden: true };
        if (field === 'rawName') return { ...r, rawName: value, normalizedType: value };
        if (field === 'area') return { ...r, area: parseFloat(value) || r.area };
        if (field === 'peopleCount') return { ...r, peopleCount: parseInt(value, 10) || 0 };
        if (field === 'hasNaturalVentilation') return { ...r, hasNaturalVentilation: Boolean(value) };
        if (field === 'ceilingHeightOverride') return { ...r, ceilingHeightOverride: parseFloat(value) || r.height };
        return { ...r, [field]: value };
      })
    );
  };

  const handleAiValidateRoom = (roomId) => {
    const target = rooms.find(r => r.roomId === roomId);
    if (!target) return;
    setSuccessMsg(
      `ИИ-валидация № ${target.number} («${target.rawName}»): норматив ${target.normCode}. Формула: ${target.calculationFormula}. Приток ${target.requiredSupplyAir} м³/ч, вытяжка ${target.requiredExhaustAir} м³/ч.`
    );
  };

  const handleBalanceAir = () => {
    const sup = rooms.reduce((s, r) => s + r.requiredSupplyAir, 0);
    const exh = rooms.reduce((s, r) => s + r.requiredExhaustAir, 0);
    setSuccessMsg(`Сводный баланс этажа проверен по СП 60.13330: Приток ${sup} м³/ч, Вытяжка ${exh} м³/ч (ΔL = ${sup - exh} м³/ч).`);
  };

  const handleExportExcel = () => {
    if (rooms.length === 0) {
      setError('Сначала загрузите PDF-план или сформируйте перечень помещений!');
      return;
    }
    exportHovsToExcel({
      activeFloor,
      currentNetHeight,
      rooms,
      estimate,
      fileName: cadFile?.name
    });
    setSuccessMsg('Полная ведомость ХОВС (с ссылками на СП/ГОСТ и формулами расчета) выгружена в Excel!');
  };

  const totalArea = rooms.reduce((s, r) => s + r.area, 0).toFixed(2);
  const totalVol = rooms.reduce((s, r) => s + r.volume, 0).toFixed(1);
  const totalSupply = rooms.reduce((s, r) => s + r.requiredSupplyAir, 0);
  const totalExhaust = rooms.reduce((s, r) => s + r.requiredExhaustAir, 0);

  return (
    <div className="min-h-screen flex w-full bg-[#040d1a] text-slate-100 font-sans">
      {/* 1. Компактный модульный сайдбар */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        roomsCount={rooms.length}
        floorsCount={floors.length}
        systemsCount={estimate.systems.length}
        activeFloor={activeFloor}
        currentNetHeight={currentNetHeight}
      />

      {/* 2. Основная рабочая область */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          activeFloorId={activeFloorId}
          onSelectFloorId={setActiveFloorId}
          floors={floors}
          currentNetHeight={currentNetHeight}
          cadFile={cadFile}
          onPdfSelect={handlePdfSelect}
          onLoadDemoRooms={handleLoadDemoRooms}
          onExportExcel={handleExportExcel}
          hasRooms={rooms.length > 0}
        />

        <AlertBanner error={error} successMsg={successMsg} />

        <KpiCards
          roomsCount={rooms.length}
          currentNetHeight={currentNetHeight}
          totalArea={totalArea}
          totalVol={totalVol}
          totalSupply={totalSupply}
          totalExhaust={totalExhaust}
          grandTotal={estimate.grandTotal}
        />

        {/* ВКЛАДКА 1: 2D-ПЛАН И КАРТА ПОМЕЩЕНИЙ */}
        {activeTab === 'map' && (
          <MapPage
            rooms={rooms}
            selectedId={selectedId}
            onSelectRoom={setSelectedId}
            activeFloor={activeFloor}
            currentNetHeight={currentNetHeight}
            onUpdateRoom={handleUpdateRoom}
            onAiValidate={handleAiValidateRoom}
            onGoToEstimate={() => setActiveTab('estimate')}
            grandTotal={estimate.grandTotal}
          />
        )}

        {/* ВКЛАДКА 2: ПОЭТАПНЫЙ КОНСТРУКТОР ЭТАЖЕЙ */}
        {activeTab === 'floors' && (
          <FloorsPage
            floors={floors}
            activeFloorId={activeFloorId}
            onSelectFloor={setActiveFloorId}
            onUpdateFloor={handleUpdateFloor}
            onAddFloorAbove={handleAddFloorAbove}
            onAddFloorBelow={handleAddFloorBelow}
            onDeleteFloor={handleDeleteFloor}
          />
        )}

        {/* ВКЛАДКА 3: ЭКСПЛИКАЦИЯ И НОРМАТИВНЫЙ БАЛАНС */}
        {activeTab === 'table' && (
          <ExplicationPage
            rooms={rooms}
            currentNetHeight={currentNetHeight}
            totalArea={totalArea}
            totalVol={totalVol}
            totalSupply={totalSupply}
            totalExhaust={totalExhaust}
            onSelectRoom={(id) => { setSelectedId(id); setActiveTab('map'); }}
            onAiValidate={handleAiValidateRoom}
            onBalanceAir={handleBalanceAir}
          />
        )}

        {/* ВКЛАДКА 4: СМЕТА ОВиК */}
        {activeTab === 'estimate' && (
          <EstimatePage
            estimate={estimate}
            onExportExcel={handleExportExcel}
          />
        )}
      </main>
    </div>
  );
}

export default App;
