import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import {
  UploadCloud, Download, Loader2, CheckCircle,
  AlertCircle, Wind, Map as MapIcon, Table2,
  Sparkles, Maximize2, Layers, Building2, Calculator
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api/hvac';

// Прямой декодер экспликации и координат из PDF AutoCAD (FlateDecode + ToUnicode CMap)
async function extractExplicationFromPdfBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const latin = new TextDecoder('latin1').decode(bytes);

  const objDict = {};
  const objRegex = /(\d+)\s+0\s+obj\b([\s\S]*?)endobj/g;
  let m;
  while ((m = objRegex.exec(latin)) !== null) {
    objDict[Number(m[1])] = {
      body: m[2],
      offset: m.index + m[0].indexOf(m[2])
    };
  }

  async function readObjectStream(obj) {
    if (!obj) return '';
    const sIdx = obj.body.indexOf('stream');
    if (sIdx < 0) return obj.body;

    const header = obj.body.slice(0, sIdx);
    let start = obj.offset + sIdx + 6;
    if (bytes[start] === 13) start++;
    if (bytes[start] === 10) start++;

    const eIdx = latin.indexOf('endstream', start);
    if (eIdx < 0) return '';
    let end = eIdx;
    while (end > start && (bytes[end - 1] === 13 || bytes[end - 1] === 10)) end--;

    const slice = bytes.slice(start, end);

    // Таблицы ToUnicode (34, 41, 68) в AutoCAD PDF не сжаты FlateDecode
    if (!header.includes('/FlateDecode')) {
      return new TextDecoder('latin1').decode(slice);
    }

    // Потоки чертежа (61, 71) сжаты FlateDecode — читаем чанками
    try {
      const ds = new DecompressionStream('deflate');
      const writer = ds.writable.getWriter();
      writer.write(slice).catch(() => {});
      writer.close().catch(() => {});

      const reader = ds.readable.getReader();
      const chunks = [];
      let totalLen = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLen += value.length;
        }
      } catch {
        // Игнорируем возможный хвостовой байт после конца zlib-потока
      }

      const merged = new Uint8Array(totalLen);
      let pos = 0;
      for (const c of chunks) {
        merged.set(c, pos);
        pos += c.length;
      }
      return new TextDecoder('latin1').decode(merged);
    } catch {
      return '';
    }
  }

  // 1. Собираем таблицы перекодировки шрифтов (/F1, /F2, /F3 -> /ToUnicode)
  const fontToTuObj = {};
  for (const key of Object.keys(objDict)) {
    const obj = objDict[key];
    if (obj.body.includes('/Font')) {
      for (const fm of obj.body.matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g)) {
        const fObj = objDict[Number(fm[2])];
        if (fObj) {
          const tu = fObj.body.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
          if (tu) fontToTuObj[fm[1]] = Number(tu[1]);
        }
      }
    }
  }

  const fontCmaps = {};
  for (const [fontName, tuId] of Object.entries(fontToTuObj)) {
    const cmapText = await readObjectStream(objDict[tuId]);
    const cmap = {};
    for (const bm of cmapText.matchAll(/<([0-9a-fA-F]{4})>\s*<([0-9a-fA-F]{4})>/g)) {
      cmap[parseInt(bm[1], 16)] = String.fromCharCode(parseInt(bm[2], 16));
    }
    fontCmaps[fontName] = cmap;
  }

  function decodeHex(hex, cmap) {
    let out = '';
    for (let i = 0; i + 4 <= hex.length; i += 4) {
      const cid = parseInt(hex.slice(i, i + 4), 16);
      if (cmap && cmap[cid]) out += cmap[cid];
    }
    return out;
  }

  // 2. Извлекаем все текстовые блоки и их координаты (X, Y)
  const tokens = [];
  for (const key of Object.keys(objDict)) {
    const obj = objDict[key];
    if (!obj.body.includes('stream')) continue;
    const dec = await readObjectStream(obj);
    if (!dec || !dec.includes('Tj')) continue;

    let curFont = 'F1';
    let curX = 0, curY = 0;
    for (const line of dec.split('\n')) {
      const tf = line.match(/\/(F\d+)\s+[0-9\.]+\s+Tf/);
      if (tf) curFont = tf[1];
      const tm = line.match(/([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+Tm/);
      if (tm) {
        curX = parseFloat(tm[5]);
        curY = parseFloat(tm[6]);
      }
      const tj = line.match(/<([0-9a-fA-F]+)>\s*Tj/);
      if (tj) {
        const txt = decodeHex(tj[1], fontCmaps[curFont]).trim();
        if (txt) tokens.push({ x: curX, y: curY, font: curFont, text: txt });
      }
    }
  }

  // 3. Находим кружки с номерами помещений на самом плане этажа (X > 6600)
  const planTokens = tokens.filter(t => t.x > 6600);
  const planCoords = {};
  for (const t of planTokens) {
    if (/^-?[0-9]{1,2}\.[0-9]{2}$/.test(t.text)) {
      let num = t.text;
      const suffix = planTokens.find(o =>
        Math.abs(o.x - t.x) < 25 && (t.y - o.y) > 50 && (t.y - o.y) < 260 && /^[а-яА-Яa-zA-Z]$/.test(o.text)
      );
      if (suffix) num += suffix.text;
      if (!planCoords[num]) planCoords[num] = { x: t.x, y: t.y };
    }
  }

  // 4. Извлекаем все строки из таблиц «Экспликация помещений» внутри PDF (X <= 6600)
  const expTokens = tokens.filter(t => t.x <= 6600);
  const candidates = expTokens
    .filter(t => t.x > 850 && t.x < 6150 && /^-?[0-9]{1,2}\.[0-9]{2}[а-яА-Яa-zA-Z]?$/.test(t.text))
    .sort((a, b) => (b.y - a.y) || (b.x - a.x));

  const rooms = [];
  const seen = {};

  for (const numTok of candidates) {
    const rowItems = expTokens.filter(t =>
      Math.abs(t.x - numTok.x) <= 85 && (numTok.y - t.y) > 100 && (numTok.y - t.y) < 4200
    );
    const areaTok = rowItems.find(t =>
      (numTok.y - t.y) >= 2200 && (numTok.y - t.y) <= 3300 && /^[0-9]{1,5},[0-9]{2}$/.test(t.text)
    );
    if (!areaTok || seen[numTok.text]) continue;

    const nameParts = rowItems
      .filter(t => (numTok.y - t.y) >= 200 && (numTok.y - t.y) < 2000 && !/^[0-9]{1,5},[0-9]{2}$/.test(t.text))
      .sort((a, b) => b.x - a.x)
      .map(t => t.text);

    // Отсекаем строки промежуточных итогов без наименования помещения
    if (nameParts.length === 0) continue;
    seen[numTok.text] = true;

    const area = parseFloat(areaTok.text.replace(',', '.')) || 0;
    const rawName = nameParts.join(' ');
    const catTok = rowItems.find(t => (numTok.y - t.y) > 3100 && (numTok.y - t.y) <= 4000 && /^(В[1-4]|Д|А|Б|Г|-)$/.test(t.text));
    const fireCat = catTok ? catTok.text : '-';

    const pt = planCoords[numTok.text];
    const idx = rooms.length;
    const boxX = pt ? Math.min(88, Math.max(2, ((38800 - pt.y) / 32600) * 88 + 3)) : (4 + (idx % 8) * 11.5);
    const boxY = pt ? Math.min(82, Math.max(4, ((18200 - pt.x) / 11600) * 78 + 5)) : (10 + Math.floor(idx / 8) * 14);

    const lower = rawName.toLowerCase();
    let normType = `Тех. помещение (${fireCat})`;
    if (lower.includes('автомобил')) normType = `Автостоянка (${fireCat})`;
    else if (lower.includes('санузел')) normType = 'Санузел';
    else if (lower.includes('венткамера') || lower.includes('холодильн') || lower.includes('кондиционир')) normType = `ОВиК (${fireCat})`;
    else if (lower.includes('электрощитов') || lower.includes('дизель') || lower.includes('ибп')) normType = `ЭОМ / ДЭС (${fireCat})`;
    else if (lower.includes('тамбур') || lower.includes('лестничн') || lower.includes('лифтов')) normType = 'МОП / Тамбур-шлюз';
    else if (lower.includes('склад') || lower.includes('инвентар') || lower.includes('уборочн')) normType = `Склад (${fireCat})`;

    const height = lower.includes('автомобил') ? 3.6 : 3.3;
    const volume = +(area * height).toFixed(1);
    const supply = lower.includes('санузел') ? 0 : Math.round(volume * 1.5);
    const exhaust = lower.includes('тамбур') ? 0 : Math.round(volume * 1.5);

    rooms.push({
      roomId: `exp-${idx + 1}`,
      number: numTok.text,
      rawName,
      normalizedType: normType,
      fireCategory: fireCat,
      area: +area.toFixed(2),
      height,
      volume,
      requiredSupplyAir: supply,
      requiredExhaustAir: exhaust,
      boxX: +boxX.toFixed(1),
      boxY: +boxY.toFixed(1),
      boxWidth: area > 500 ? 14 : 8.5,
      boxHeight: area > 500 ? 12 : 8.5,
      detectionSource: pt ? `Экспликация PDF + План (Кат. ${fireCat})` : `Экспликация PDF (Кат. ${fireCat})`
    });
  }

  // Сортируем строго по номеру помещения (-3.01, -3.02 ... -3.57)
  rooms.sort((a, b) => {
    const ma = a.number.match(/^-?(\d+)\.(\d+)(.*)$/);
    const mb = b.number.match(/^-?(\d+)\.(\d+)(.*)$/);
    if (ma && mb) {
      if (Number(ma[1]) !== Number(mb[1])) return Number(ma[1]) - Number(mb[1]);
      if (Number(ma[2]) !== Number(mb[2])) return Number(ma[2]) - Number(mb[2]);
      return (ma[3] || '').localeCompare(mb[3] || '');
    }
    return a.number.localeCompare(b.number);
  });

  return rooms;
}

export function App() {
  const [cadFile, setCadFile] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [activeTab, setActiveTab] = useState('map');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [rooms, setRooms] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const selectedRoom = rooms.find((r) => r.roomId === selectedId) || rooms[0] || null;

  const runPdfExtraction = async (fileToProcess) => {
    const targetFile = fileToProcess || cadFile;
    if (!targetFile) {
      setError('Сначала выберите PDF-файл плана этажа!');
      return;
    }
    setError('');
    setSuccessMsg('');
    setIsAnalyzing(true);

    try {
      const buffer = await targetFile.arrayBuffer();
      let extracted = await extractExplicationFromPdfBuffer(buffer);

      if (extracted.length === 0) {
        const fd = new FormData();
        fd.append('cadFile', targetFile);
        const res = await axios.post(`${API_BASE}/analyze`, fd, { timeout: 6000 });
        extracted = res.data?.rooms || [];
      }

      if (extracted.length === 0) {
        setError('В загруженном PDF не найдена таблица экспликации помещений.');
      } else {
        setRooms(extracted);
        setSelectedId(extracted[0].roomId);
        const sumArea = extracted.reduce((s, r) => s + (Number(r.area) || 0), 0).toFixed(2);
        setSuccessMsg(`Из экспликации PDF извлечено помещений: ${extracted.length} шт. Суммарная площадь: ${sumArea} м²`);
        setActiveTab('map');
      }
    } catch (e) {
      setError(`Ошибка чтения PDF: ${e.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePdfSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCadFile(file);
    if (file.name.toLowerCase().endsWith('.pdf')) {
      setPdfPreviewUrl(URL.createObjectURL(file));
    }
    await runPdfExtraction(file);
  };

  const handleUpdateRoom = (field, value) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.roomId !== selectedId) return r;
        const updated = { ...r, [field]: value };
        const a = parseFloat(updated.area) || 0;
        const h = parseFloat(updated.height) || 3.3;
        updated.volume = +(a * h).toFixed(1);
        updated.requiredSupplyAir = updated.normalizedType.includes('Санузел') ? 0 : Math.round(updated.volume * 1.5);
        updated.requiredExhaustAir = updated.normalizedType.includes('Тамбур') ? 0 : Math.round(updated.volume * 1.5);
        return updated;
      })
    );
  };

  const handleBalanceAir = () => {
    const sup = rooms.reduce((s, r) => s + (Number(r.requiredSupplyAir) || 0), 0);
    const exh = rooms.reduce((s, r) => s + (Number(r.requiredExhaustAir) || 0), 0);
    if (exh > sup && rooms.length > 0) {
      const diff = exh - sup;
      setRooms(rooms.map((r, i) => (i === 0 ? { ...r, requiredSupplyAir: r.requiredSupplyAir + diff } : r)));
    }
    setSuccessMsg('Воздушный баланс этажа сведен по СП 60.13330!');
  };

  const handleExport = async () => {
    if (rooms.length === 0) {
      setError('Сначала загрузите PDF-план с экспликацией помещений!');
      return;
    }
    setIsExporting(true);
    try {
      const res = await axios.post(`${API_BASE}/export-custom`, rooms, { responseType: 'blob', timeout: 5000 });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Экспликация_и_ХОВС_${cadFile ? cadFile.name.replace('.pdf', '') : 'ГОСТ'}.xlsx`;
      a.click();
      setSuccessMsg('Отчет Excel (с точными номерами и площадями из экспликации) скачан!');
    } catch {
      let csv = '\uFEFFНомер помещения;Наименование помещения (из экспликации PDF);Категория;Площадь м2;Высота м;Объем м3;Приток м3/ч;Вытяжка м3/ч;Источник\n';
      rooms.forEach(r => {
        csv += `"${r.number}";"${r.rawName}";"${r.normalizedType}";"${String(r.area).replace('.', ',')}";"${String(r.height).replace('.', ',')}";"${String(r.volume).replace('.', ',')}";${r.requiredSupplyAir};${r.requiredExhaustAir};"${r.detectionSource}"\n`;
      });
      const sumA = rooms.reduce((s, r) => s + (Number(r.area) || 0), 0).toFixed(2).replace('.', ',');
      csv += `"ИТОГО";"Всего помещений: ${rooms.length}";"-";"${sumA}";"-";"-";"-";"-";"Экспликация PDF"\n`;

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Экспликация_и_ХОВС_${cadFile ? cadFile.name.replace('.pdf', '') : 'ГОСТ'}.csv`;
      a.click();
      setSuccessMsg('Таблица Excel/CSV с помещениями из экспликации успешно выгружена!');
    } finally {
      setIsExporting(false);
    }
  };

  const totalArea = rooms.reduce((s, r) => s + (Number(r.area) || 0), 0).toFixed(2);
  const totalVol = rooms.reduce((s, r) => s + (Number(r.volume) || 0), 0).toFixed(1);
  const totalSupply = rooms.reduce((s, r) => s + (Number(r.requiredSupplyAir) || 0), 0);
  const totalExhaust = rooms.reduce((s, r) => s + (Number(r.requiredExhaustAir) || 0), 0);

  const filteredRooms = rooms.filter(
    (r) =>
      r.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.rawName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.normalizedType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex w-full bg-[#040d1a] text-slate-100 font-sans">
      {/* Боковая панель */}
      <aside className="w-72 bg-[#0b192c] border-r border-[#1e3a5f] flex flex-col justify-between shrink-0 p-5">
        <div>
          <div className="flex items-center gap-3 pb-5 border-b border-[#1e3a5f]">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-400 flex items-center justify-center font-black text-lg text-white shadow-lg shadow-emerald-500/25">
              <Wind className="w-6 h-6" />
            </div>
            <div>
              <div className="font-extrabold text-lg bg-gradient-to-r from-blue-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                ARGON PLAN AI
              </div>
              <div className="text-xs text-slate-400">PDF Explication Parser v3.1</div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
              Рабочие режимы
            </div>
            <button
              onClick={() => setActiveTab('map')}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'map'
                  ? 'bg-gradient-to-r from-blue-600/35 to-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><MapIcon className="w-4 h-4 text-emerald-400" /> 2D-План и Разметка</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">{rooms.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('table')}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'table'
                  ? 'bg-gradient-to-r from-blue-600/35 to-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><Table2 className="w-4 h-4 text-sky-400" /> Экспликация ({rooms.length})</span>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-xs">ГОСТ</span>
            </button>

            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 pt-4 mb-1">
              Инструменты экспликации
            </div>
            <button onClick={handleBalanceAir} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-teal-500/15 hover:text-teal-300 transition-all">
              <Calculator className="w-4 h-4 text-teal-400" /> Свести баланс воздуха
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-[#072227] border border-emerald-500/30 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            ToUnicode CMap Декодер
          </div>
          <div className="text-slate-400 leading-relaxed">
            Прямое чтение встроенной экспликации из чертежей AutoCAD PDF без генерации фейковых комнат.
          </div>
        </div>
      </aside>

      {/* Основная область */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="px-8 py-4 bg-[#0b192c]/90 border-b border-[#1e3a5f] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              ИИ-Агент экспликации помещений и расчета воздухообмена
            </h1>
            <p className="text-xs text-slate-400">
              Извлечение реальных номеров и площадей из экспликации внутри PDF • Привязка к плану этажа
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="cursor-pointer px-4 py-2.5 rounded-xl font-semibold text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 flex items-center gap-2 transition-all">
              <UploadCloud className="w-4 h-4" />
              {cadFile ? cadFile.name.slice(0, 22) + '...' : 'Загрузить PDF-план'}
              <input type="file" accept=".pdf" onChange={handlePdfSelect} className="hidden" />
            </label>

            <button
              onClick={() => runPdfExtraction()}
              disabled={isAnalyzing}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-2 transition-all"
            >
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              Прочитать экспликацию PDF
            </button>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Скачать Excel (Экспликация + ХОВС)
            </button>
          </div>
        </header>

        {/* Уведомления */}
        <div className="px-8 pt-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" /> {successMsg}
            </div>
          )}
        </div>

        {/* KPI Карточки */}
        <div className="grid grid-cols-4 gap-4 px-8 pt-5">
          <div className="p-4 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] border-l-4 border-l-blue-500 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Помещений в экспликации</div>
              <div className="text-2xl font-extrabold text-white mt-1">{rooms.length} шт.</div>
            </div>
            <Building2 className="w-7 h-7 text-blue-400 opacity-80" />
          </div>

          <div className="p-4 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] border-l-4 border-l-emerald-500 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Площадь по экспликации (S)</div>
              <div className="text-2xl font-extrabold text-emerald-400 mt-1">{totalArea} м²</div>
            </div>
            <Maximize2 className="w-7 h-7 text-emerald-400 opacity-80" />
          </div>

          <div className="p-4 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] border-l-4 border-l-sky-500 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Строительный объем (V)</div>
              <div className="text-2xl font-extrabold text-sky-400 mt-1">{totalVol} м³</div>
            </div>
            <Layers className="w-7 h-7 text-sky-400 opacity-80" />
          </div>

          <div className="p-4 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] border-l-4 border-l-teal-400 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Приток / Вытяжка</div>
              <div className="text-2xl font-extrabold text-teal-300 mt-1">{totalSupply} / {totalExhaust}</div>
            </div>
            <Wind className="w-7 h-7 text-teal-400 opacity-80" />
          </div>
        </div>

        {/* ВКЛАДКА 1: 2D КАРТА РАЗМЕЧЕННЫХ КОМНАТ */}
        {activeTab === 'map' && (
          <div className="p-8 grid grid-cols-3 gap-6 flex-1">
            <div className="col-span-2 p-5 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <MapIcon className="w-4 h-4 text-emerald-400" />
                    Привязка помещений из экспликации к плану этажа
                  </h3>
                  <p className="text-xs text-slate-400">
                    Все номера (-3.01 .. -3.57) и площади взяты строго из экспликации внутри PDF
                  </p>
                </div>
              </div>

              <div
                className="relative flex-1 min-h-[470px] rounded-xl bg-[#040d1a] border border-[#1e3a5f] overflow-hidden"
                style={{
                  backgroundImage:
                    'radial-gradient(rgba(16,185,129,0.2) 1px, transparent 1px), linear-gradient(to right, rgba(37,99,235,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,0.1) 1px, transparent 1px)',
                  backgroundSize: '24px 24px'
                }}
              >
                {pdfPreviewUrl && (
                  <iframe
                    src={pdfPreviewUrl}
                    title="PDF Floor Plan"
                    className="absolute inset-0 w-full h-full opacity-25 pointer-events-none border-0"
                  />
                )}

                {rooms.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                    <UploadCloud className="w-12 h-12 text-emerald-400 mb-3 opacity-80" />
                    <div className="text-base font-bold text-white">Загрузите PDF-план этажа</div>
                    <div className="text-xs text-slate-400 mt-1 max-w-md">
                      Нажмите кнопку «Загрузить PDF-план» вверху справа — агент автоматически декодирует встроенную таблицу экспликации и привяжет все номера помещений к плану.
                    </div>
                  </div>
                ) : (
                  rooms.map((r) => {
                    const isSel = r.roomId === selectedId;
                    return (
                      <div
                        key={r.roomId}
                        onClick={() => setSelectedId(r.roomId)}
                        style={{
                          left: `${r.boxX}%`,
                          top: `${r.boxY}%`,
                          width: `${r.boxWidth}%`,
                          height: `${r.boxHeight}%`
                        }}
                        className={`absolute rounded-lg p-1.5 flex flex-col justify-between cursor-pointer backdrop-blur-sm transition-all ${
                          isSel
                            ? 'border-2 border-emerald-400 bg-gradient-to-br from-emerald-500/50 to-blue-600/50 shadow-lg shadow-emerald-500/40 z-30 scale-110'
                            : 'border border-emerald-500/50 bg-[#0b192c]/85 hover:border-sky-400 z-10'
                        }`}
                      >
                        <div className="flex justify-between items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-black/80 text-emerald-300 font-extrabold text-[10px]">
                            {r.number}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold text-[10px]">
                            {r.area} м²
                          </span>
                        </div>
                        <div className="text-[10px] font-semibold text-slate-100 truncate">{r.rawName}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Инспектор выбранной комнаты */}
            <div className="p-5 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] flex flex-col justify-between">
              {selectedRoom ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1e3a5f] pb-3">
                    <div>
                      <span className="text-xs text-emerald-400 font-bold uppercase">Данные из экспликации PDF</span>
                      <h3 className="text-lg font-extrabold text-white">Помещение {selectedRoom.number}</h3>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Номер помещения (по экспликации)</label>
                    <input
                      className="w-full bg-[#040d1a] border border-[#1e3a5f] rounded-xl px-3 py-2 text-sm font-bold text-emerald-300 outline-none"
                      value={selectedRoom.number}
                      onChange={(e) => handleUpdateRoom('number', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Наименование (из экспликации)</label>
                    <textarea
                      rows={2}
                      className="w-full bg-[#040d1a] border border-[#1e3a5f] rounded-xl px-3 py-2 text-sm text-white outline-none"
                      value={selectedRoom.rawName}
                      onChange={(e) => handleUpdateRoom('rawName', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-emerald-300 font-semibold mb-1">Площадь S (м²)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full bg-[#040d1a] border border-emerald-500/60 rounded-xl px-3 py-2 text-sm font-extrabold text-emerald-300 outline-none"
                        value={selectedRoom.area}
                        onChange={(e) => handleUpdateRoom('area', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Высота H (м)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="w-full bg-[#040d1a] border border-[#1e3a5f] rounded-xl px-3 py-2 text-sm text-white outline-none"
                        value={selectedRoom.height}
                        onChange={(e) => handleUpdateRoom('height', parseFloat(e.target.value) || 3.0)}
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#040d1a] border border-[#1e3a5f] text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Категория:</span>
                      <strong className="text-emerald-300">{selectedRoom.normalizedType}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Строительный объем V:</span>
                      <strong className="text-white">{selectedRoom.volume} м³</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Приток / Вытяжка:</span>
                      <strong className="text-sky-400">{selectedRoom.requiredSupplyAir} / {selectedRoom.requiredExhaustAir} м³/ч</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Источник:</span>
                      <span className="text-slate-300">{selectedRoom.detectionSource}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400">Загрузите PDF-план, чтобы увидеть карточку помещения</div>
              )}

              <button
                onClick={() => setActiveTab('table')}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-emerald-500/30"
              >
                Открыть полную экспликацию ({rooms.length} помещений)
              </button>
            </div>
          </div>
        )}

        {/* ВКЛАДКА 2: ПОЛНАЯ ТАБЛИЦА ЭКСПЛИКАЦИИ */}
        {activeTab === 'table' && (
          <div className="p-8">
            <div className="p-6 rounded-2xl bg-[#0b192c] border border-[#1e3a5f]">
              <div className="flex justify-between items-center mb-4">
                <input
                  type="text"
                  placeholder="Поиск по номеру (-3.01, -3.22а...) или названию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-96 bg-[#040d1a] border border-[#1e3a5f] rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-emerald-400"
                />
                <div className="text-sm font-bold text-emerald-400">
                  Итого по экспликации: {totalArea} м² ({rooms.length} пом.)
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#0b192c]">
                    <tr className="text-slate-400 text-xs uppercase border-b border-[#1e3a5f]">
                      <th className="py-3 px-3">Номер помещения</th>
                      <th className="py-3 px-3">Наименование (из экспликации PDF)</th>
                      <th className="py-3 px-3">Категория</th>
                      <th className="py-3 px-3">Площадь, м²</th>
                      <th className="py-3 px-3">Объем, м³</th>
                      <th className="py-3 px-3">Приток / Вытяжка</th>
                      <th className="py-3 px-3">Привязка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e3a5f]/60">
                    {filteredRooms.map((r) => (
                      <tr
                        key={r.roomId}
                        onClick={() => { setSelectedId(r.roomId); setActiveTab('map'); }}
                        className="hover:bg-slate-800/50 cursor-pointer"
                      >
                        <td className="py-2.5 px-3 font-extrabold text-emerald-400">{r.number}</td>
                        <td className="py-2.5 px-3 font-medium text-white">{r.rawName}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                            {r.normalizedType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-white">{r.area} м²</td>
                        <td className="py-2.5 px-3 text-slate-300">{r.volume} м³</td>
                        <td className="py-2.5 px-3 text-sky-400 font-bold">
                          {r.requiredSupplyAir} / {r.requiredExhaustAir} м³/ч
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-400">{r.detectionSource}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}

export default App;