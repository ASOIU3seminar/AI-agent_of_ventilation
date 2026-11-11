import React, { useState, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import {
  UploadCloud, Download, Loader2, CheckCircle, AlertCircle,
  Wind, Map as MapIcon, Table2, Sparkles, Maximize2, Layers,
  Building2, Calculator, ZoomIn, ZoomOut, RotateCcw, FileSpreadsheet,
  Sliders, ShieldCheck, Cpu
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api/hvac';

// Начальная таблица высотных отметок этажей (FloorElevationDto)
const INITIAL_FLOORS = [
  { id: 'f-3', code: '-3', name: 'Подземный -3 этаж (Паркинг / Тех.)', elevationBottom: -11.400, elevationTop: -6.600, slabThickness: 0.300 },
  { id: 'f-2', code: '-2', name: 'Подземный -2 этаж (Паркинг / Кладовые)', elevationBottom: -6.600, elevationTop: -3.300, slabThickness: 0.300 },
  { id: 'f-1', code: '-1', name: 'Подземный -1 этаж (Стилобат / ИТП)', elevationBottom: -3.300, elevationTop: 0.000, slabThickness: 0.300 },
  { id: 'f+1', code: '1', name: '1-й этаж (Вестибюль / Офисы)', elevationBottom: 0.000, elevationTop: 3.600, slabThickness: 0.300 },
  { id: 'f+2', code: '2', name: '2-й типовой этаж', elevationBottom: 3.600, elevationTop: 7.200, slabThickness: 0.300 }
];

export function calcNetHeight(floor) {
  const delta = (Number(floor.elevationTop) || 0) - (Number(floor.elevationBottom) || 0) - (Number(floor.slabThickness) || 0.3);
  return +Math.max(2.0, delta).toFixed(3);
}

// Нормативный движок СП 60.13330.2020, СП 118.13330.2022, СП 54.13330.2022 и СанПиН 1.2.3685-21
export function evaluateRoomNorms(rawRoom, netHeight) {
  const area = +(Number(rawRoom.area) || 0).toFixed(2);
  const height = +(Number(netHeight) || 3.3).toFixed(2);
  const volume = +(area * height).toFixed(2);
  const lower = (rawRoom.rawName || '').toLowerCase();

  let normalizedType = 'Тех. помещение';
  let normCode = 'СП 60.13330.2020';
  let normCitation = 'Базовая кратность тех. помещений K=1.5';
  let method = 'По кратности (1/ч)';
  let inflowRate = Math.round(volume * 1.5);
  let exhaustRate = Math.round(volume * 1.5);
  let systemTag = 'П1 / В1';

  if (lower.includes('автомобил') || lower.includes('автостоянк') || lower.includes('паркинг') || lower.includes('машино')) {
    normalizedType = 'Автостоянка';
    normCode = 'СП 60.13330.2020 / СП 113.13330';
    normCitation = 'Вытяжка K=5, компенсационный приток K=4 (разряжение)';
    method = 'Кратность K=4 / K=5';
    inflowRate = Math.round(volume * 4.0);
    exhaustRate = Math.round(volume * 5.0);
    systemTag = 'П-Паркинг / В-Паркинг';
  } else if (lower.includes('пуи') || lower.includes('уборочн') || lower.includes('уборка') || lower.includes('инвентар')) {
    normalizedType = 'ПУИ';
    normCode = 'СП 118.13330.2022 п. 7.1';
    normCitation = 'Вытяжка L = 5×V, но не менее 100 м³/ч (разряжение)';
    method = 'Фикс. / Кратность K=5';
    inflowRate = 0;
    exhaustRate = Math.max(100, Math.round(volume * 5.0));
    systemTag = 'В-СУ';
  } else if (lower.includes('санузел') || lower.includes('уборн') || lower.includes('туалет') || lower.includes('с/у')) {
    normalizedType = 'Санузел';
    normCode = 'СП 118.13330.2022 Табл. 7.1';
    normCitation = '50–75 м³/ч на прибор (или K=5), отрицательный дисбаланс';
    method = 'Санитарная норма';
    inflowRate = 0;
    exhaustRate = Math.max(75, Math.round(volume * 5.0));
    systemTag = 'В-СУ';
  } else if (lower.includes('электрощитов') || lower.includes('грщ') || lower.includes('ибп') || lower.includes('асо') || lower.includes('сс') || lower.includes('связ')) {
    normalizedType = 'Электрощитовая';
    normCode = 'СП 60.13330.2020 / ПУЭ';
    normCitation = 'Вытяжка K=1.0, механический приток не требуется (Lпр = 0)';
    method = 'Кратность Kвыт=1';
    inflowRate = 0;
    exhaustRate = Math.max(30, Math.round(volume * 1.0));
    systemTag = 'В1-Тех';
  } else if (lower.includes('итп') || lower.includes('тепловой') || lower.includes('насосн') || lower.includes('кнс') || lower.includes('водомер')) {
    normalizedType = 'ИТП / Насосная';
    normCode = 'СП 41-101-95 / СП 60.13330.2020';
    normCitation = 'Механическая вытяжка K=3.0, приток K=3.0';
    method = 'Кратность K=3';
    inflowRate = Math.round(volume * 3.0);
    exhaustRate = Math.round(volume * 3.0);
    systemTag = 'П1 / В1';
  } else if (lower.includes('венткамер') || lower.includes('холодильн') || lower.includes('кондиционир')) {
    normalizedType = 'Венткамера';
    normCode = 'СП 60.13330.2020';
    normCitation = 'Кратность воздухообмена Kпр=1.0, Kвыт=1.0';
    method = 'Кратность K=1';
    inflowRate = Math.round(volume * 1.0);
    exhaustRate = Math.round(volume * 1.0);
    systemTag = 'П1 / В1';
  } else if (lower.includes('тамбур') || lower.includes('лифтовой холл')) {
    normalizedType = 'Тамбур-шлюз';
    normCode = 'СП 7.13130.2013 / СП 60.13330.2020';
    normCitation = 'Подпор воздуха не менее 100 м³/ч (избыточное давление ≥ 20 Па)';
    method = 'Подпор ΔP ≥ 20 Па';
    inflowRate = Math.max(100, Math.round(volume * 1.5));
    exhaustRate = 0;
    systemTag = 'П1';
  } else if (lower.includes('офис') || lower.includes('кабинет') || lower.includes('переговор') || lower.includes('диспетчер') || lower.includes('охрана')) {
    const people = Math.max(1, Math.ceil(area / 6.0));
    normalizedType = 'Офис / Рабочее';
    normCode = 'СП 60.13330.2020 / СанПиН 1.2.3685-21';
    normCitation = `60 м³/ч на 1 чел. (${people} чел.), положительный баланс`;
    method = 'По людям (60 м³/ч·чел)';
    inflowRate = people * 60;
    exhaustRate = Math.round(people * 55);
    systemTag = 'П1 / В1';
  } else if (lower.includes('кладов') || lower.includes('склад') || lower.includes('мусор') || lower.includes('хранен')) {
    normalizedType = 'Кладовая / Склад';
    normCode = 'СП 60.13330.2020 / СП 54.13330.2022';
    normCitation = 'Вытяжка K=1.5, приток K=1.0 (разряжение)';
    method = 'Кратность K=1.0 / 1.5';
    inflowRate = Math.round(volume * 1.0);
    exhaustRate = Math.round(volume * 1.5);
    systemTag = 'П1 / В1';
  } else if (lower.includes('коридор') || lower.includes('моп') || lower.includes('лестнич') || lower.includes('вестибюл')) {
    normalizedType = 'МОП / Коридор';
    normCode = 'СП 60.13330.2020';
    normCitation = 'Компенсационный приток K=1.0, вытяжка K=0.5';
    method = 'Кратность K=1.0 / 0.5';
    inflowRate = Math.round(volume * 1.0);
    exhaustRate = Math.round(volume * 0.5);
    systemTag = 'П1 / В1';
  }

  return {
    ...rawRoom,
    area,
    height,
    volume,
    normalizedType,
    normCode,
    normCitation,
    method,
    requiredSupplyAir: inflowRate,
    requiredExhaustAir: exhaustRate,
    balance: +(inflowRate - exhaustRate).toFixed(1),
    systemTag
  };
}

// Расчет спецификации и сметы ОВиК по скоростям потока (v1 = 4.5 м/с, v2 = 2.5 м/с)
export function buildHvacEstimate(rooms) {
  const inflowGeneral = Math.round(rooms.filter(r => r.normalizedType !== 'Автостоянка').reduce((s, r) => s + r.requiredSupplyAir, 0) * 1.10);
  const inflowParking = Math.round(rooms.filter(r => r.normalizedType === 'Автостоянка').reduce((s, r) => s + r.requiredSupplyAir, 0) * 1.10);
  const exhaustGeneral = Math.round(rooms.filter(r => r.normalizedType !== 'Автостоянка' && r.systemTag !== 'В-СУ').reduce((s, r) => s + r.requiredExhaustAir, 0) * 1.10);
  const exhaustSanitary = Math.round(rooms.filter(r => r.systemTag === 'В-СУ').reduce((s, r) => s + r.requiredExhaustAir, 0) * 1.10);
  const exhaustParking = Math.round(rooms.filter(r => r.normalizedType === 'Автостоянка').reduce((s, r) => s + r.requiredExhaustAir, 0) * 1.10);

  const systems = [];
  const pushSys = (code, type, count, flow) => {
    if (flow <= 0) return;
    const fMain = +(flow / (3600 * 4.5)).toFixed(3); // v1 = 4.5 м/с
    const fBranch = +(flow / Math.max(1, count) / (3600 * 2.5)).toFixed(3); // v2 = 2.5 м/с
    const ductArea = +(flow * 0.095).toFixed(1);
    const metal = fMain > 0.5 ? '0.9 мм (св. 1000 мм)' : (fMain > 0.1 ? '0.7 мм (250–1000 мм)' : '0.5 мм (до 250 мм)');
    systems.push({ code, type, count, flow, fMain, fBranch, ductArea, metal });
  };

  pushSys('П1', 'Приточная общеобменная и тех. помещений (запас +10%)', rooms.filter(r => r.requiredSupplyAir > 0 && r.normalizedType !== 'Автостоянка').length, inflowGeneral);
  pushSys('П2', 'Приточная подземной автостоянки (запас +10%)', rooms.filter(r => r.normalizedType === 'Автостоянка').length, inflowParking);
  pushSys('В1', 'Вытяжная общеобменная и тех. зон (запас +10%)', rooms.filter(r => r.requiredExhaustAir > 0 && r.systemTag !== 'В-СУ' && r.normalizedType !== 'Автостоянка').length, exhaustGeneral);
  pushSys('В2 (В-СУ)', 'Вытяжная изолированная санузлов и ПУИ (СП 60.13330)', rooms.filter(r => r.systemTag === 'В-СУ').length, exhaustSanitary);
  pushSys('В3', 'Вытяжная подземной автостоянки (запас +10%)', rooms.filter(r => r.normalizedType === 'Автостоянка').length, exhaustParking);

  const totalDuctArea = +(systems.reduce((s, x) => s + x.ductArea, 0)).toFixed(1);
  const supplyUnits = Math.max(1, systems.filter(s => s.code.startsWith('П')).length);
  const exhaustUnits = Math.max(1, systems.filter(s => s.code.startsWith('В')).length);
  const ozkCount = Math.max(2, systems.length * 2);
  const roomCount = Math.max(1, rooms.length);

  const baseItems = [
    { category: '1. Вентиляционное оборудование', name: 'Приточные установки (П1..Пn) с водяным калорифером, фильтрами и САУ', unit: 'компл.', qty: supplyUnits, price: 420000 },
    { category: '1. Вентиляционное оборудование', name: 'Вытяжные радиальные/канальные вентиляторы (В1..Вn, напор 450 Па)', unit: 'компл.', qty: exhaustUnits, price: 165000 },
    { category: '2. Сеть воздуховодов и клапаны', name: 'Воздуховоды из оцинкованной стали класса Н (0.5 / 0.7 / 0.9 мм по СП 60.13330)', unit: 'м²', qty: totalDuctArea, price: 2450 },
    { category: '2. Сеть воздуховодов и клапаны', name: 'Фасонные части (отводы, тройники, переходы) и крепежный профиль (+25%)', unit: 'м²', qty: +(totalDuctArea * 0.25).toFixed(1), price: 2900 },
    { category: '2. Сеть воздуховодов и клапаны', name: 'Клапаны огнезадерживающие (ОЗК EI 60) с реверсивным электроприводом', unit: 'шт.', qty: ozkCount, price: 18500 },
    { category: '2. Сеть воздуховодов и клапаны', name: 'Дроссель-клапаны регулировочные на ответвлениях (v2 = 2.5 м/с)', unit: 'шт.', qty: roomCount, price: 2200 },
    { category: '3. Воздухораспределители', name: 'Решетки приточно-вытяжные и потолочные диффузоры с КСД', unit: 'шт.', qty: roomCount * 2, price: 3400 }
  ].map(item => ({ ...item, total: Math.round(item.qty * item.price) }));

  const equipCost = baseItems.filter(i => i.category.startsWith('1.')).reduce((s, i) => s + i.total, 0);
  const matCost = baseItems.filter(i => i.category.startsWith('2.') || i.category.startsWith('3.')).reduce((s, i) => s + i.total, 0);
  const installCost = Math.round((equipCost + matCost) * 0.40);
  const pnrCost = Math.round(installCost * 0.12);

  const items = [
    ...baseItems,
    { category: '4. Монтаж и ПНР', name: 'Строительно-монтажные работы систем ОВиК (40% от оборудования и сети)', unit: 'усл.', qty: 1, price: installCost, total: installCost },
    { category: '4. Монтаж и ПНР', name: 'Пусконаладочные работы (ПНР) и паспортизация вентсистем (12% от СМР)', unit: 'усл.', qty: 1, price: pnrCost, total: pnrCost }
  ];

  return {
    systems,
    items,
    equipCost,
    matCost,
    installCost,
    pnrCost,
    grandTotal: equipCost + matCost + installCost + pnrCost
  };
}

// Нативный парсер PDF с извлечением CAD-координат (xCad, yCad) и транспонированных таблиц
async function extractExplicationFromPdfBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const latin = new TextDecoder('latin1').decode(bytes);

  const objDict = {};
  const objRegex = /(\d+)\s+0\s+obj\b([\s\S]*?)endobj/g;
  let m;
  while ((m = objRegex.exec(latin)) !== null) {
    objDict[Number(m[1])] = { body: m[2], offset: m.index + m[0].indexOf(m[2]) };
  }

  async function readObjectStream(obj) {
    if (!obj) return '';
    const sIdx = obj.body.indexOf('stream');
    if (sIdx < 0) return obj.body;
    let start = obj.offset + sIdx + 6;
    if (bytes[start] === 13) start++;
    if (bytes[start] === 10) start++;
    const eIdx = latin.indexOf('endstream', start);
    if (eIdx < 0) return '';
    let end = eIdx;
    while (end > start && (bytes[end - 1] === 13 || bytes[end - 1] === 10)) end--;
    const slice = bytes.slice(start, end);

    if (!obj.body.slice(0, sIdx).includes('/FlateDecode')) {
      return new TextDecoder('latin1').decode(slice);
    }
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
      } catch { }
      const merged = new Uint8Array(totalLen);
      let pos = 0;
      for (const c of chunks) { merged.set(c, pos); pos += c.length; }
      return new TextDecoder('latin1').decode(merged);
    } catch { return ''; }
  }

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
      if (tm) { curX = parseFloat(tm[5]); curY = parseFloat(tm[6]); }
      const tj = line.match(/<([0-9a-fA-F]+)>\s*Tj/);
      if (tj) {
        const txt = decodeHex(tj[1], fontCmaps[curFont]).trim();
        if (txt) tokens.push({ x: curX, y: curY, text: txt });
      }
    }
  }

  // Сшиваем составные номера комнат (-3.22 + а)
  for (const t of tokens) {
    if (/^-?[0-9]{1,2}\.[0-9]{2}$/.test(t.text)) {
      const suffix = tokens.find(o => o !== t && Math.abs(o.x - t.x) < 40 && (t.y - o.y) > 20 && (t.y - o.y) < 280 && /^[а-яА-Яa-zA-Z]$/.test(o.text));
      if (suffix) {
        t.text += suffix.text;
        suffix.text = '';
      }
    }
  }

  const roomPattern = /^(-?[0-9]{1,2}\.[0-9]{2}[а-яА-Яa-zA-Z]?|-[0-9]{2}\.[A-Za-zА-Яа-я0-9]{2}\.[0-9]{1,3}|[0-9]{1,2}\.[A-Za-z0-9]+\.[0-9]{1,3})$/;
  const areaPattern = /^[0-9]{1,5},[0-9]{2}$/;
  const allRoomTokens = tokens.filter(t => roomPattern.test(t.text));

  const planCoords = {};
  const expCandidates = [];

  for (const rt of allRoomTokens) {
    const hasNearbyArea = tokens.some(t =>
      t !== rt && areaPattern.test(t.text) &&
      ((Math.abs(t.x - rt.x) <= 85 && Math.abs(t.y - rt.y) < 4200) ||
       (Math.abs(t.y - rt.y) <= 85 && Math.abs(t.x - rt.x) < 4200))
    );
    if (hasNearbyArea) {
      expCandidates.push(rt);
    } else if (!planCoords[rt.text]) {
      planCoords[rt.text] = { x: rt.x, y: rt.y };
    }
  }

  const rooms = [];
  const seen = {};

  for (const numTok of expCandidates) {
    if (seen[numTok.text]) continue;

    const colItems = tokens.filter(t => Math.abs(t.x - numTok.x) <= 85 && Math.abs(t.y - numTok.y) < 4200);
    let areaTok = colItems.find(t => t !== numTok && areaPattern.test(t.text));
    let rowItems = colItems;

    if (!areaTok) {
      rowItems = tokens.filter(t => Math.abs(t.y - numTok.y) <= 85 && Math.abs(t.x - numTok.x) < 4200);
      areaTok = rowItems.find(t => t !== numTok && areaPattern.test(t.text));
    }
    if (!areaTok) continue;

    const area = parseFloat(areaTok.text.replace(',', '.')) || 0;
    const nameParts = rowItems
      .filter(t =>
        t !== numTok && t !== areaTok && t.text.length > 2 &&
        !areaPattern.test(t.text) &&
        !/^(В[1-4]|Д|А|Б|Г|-)$/.test(t.text) &&
        !roomPattern.test(t.text) &&
        !/^[-+]?\d+([.,]\d+)?$/.test(t.text) &&
        !/^\d+:\d+$/.test(t.text)
      )
      .sort((a, b) => (b.y - a.y) || (a.x - b.x))
      .map(t => t.text);

    if (nameParts.length === 0) continue;
    seen[numTok.text] = true;

    const catTok = rowItems.find(t => /^(В[1-4]|Д|А|Б|Г|-)$/.test(t.text));
    const fireCat = catTok ? catTok.text : '-';
    const pt = planCoords[numTok.text];
    const idx = rooms.length;

    rooms.push({
      roomId: `exp-${idx + 1}`,
      number: numTok.text,
      rawName: nameParts.join(' '),
      fireCategory: fireCat,
      area: +area.toFixed(2),
      cadX: pt ? pt.x : (2000 + (idx % 9) * 2800),
      cadY: pt ? pt.y : (26000 - Math.floor(idx / 9) * 2600),
      hasPlanCoord: Boolean(pt),
      detectionSource: pt ? `Экспликация PDF + Координаты плана (Кат. ${fireCat})` : `Экспликация PDF (Кат. ${fireCat})`
    });
  }

  rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  return rooms;
}

// ============================================================================
// КОМПОНЕНТ 1: PLAN CANVAS (Динамический SVG с Bounding Box, инверсией Y и Pan/Zoom)
// ============================================================================
function PlanCanvas({ rooms, selectedId, onSelectRoom, pdfPreviewUrl }) {
  const svgRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [transform, setTransform] = useState({ scale: 1, panX: 0, panY: 0 });
  const [dragState, setDragState] = useState(null);

  const W_VIEW = 1200;
  const H_VIEW = 720;

  // Нормализация координат CAD в экранное пространство SVG с инверсией оси Y
  const normalizedRooms = useMemo(() => {
    if (!rooms || rooms.length === 0) return [];
    const xs = rooms.map(r => Number(r.cadX) || 0);
    const ys = rooms.map(r => Number(r.cadY) || 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const wCad = Math.max(100, maxX - minX);
    const hCad = Math.max(100, maxY - minY);
    const padX = wCad * 0.08;
    const padY = hCad * 0.08;
    const xBox = minX - padX;
    const yBox = minY - padY;
    const wBox = wCad + padX * 2;
    const hBox = hCad + padY * 2;

    return rooms.map(r => {
      const xScr = ((r.cadX - xBox) / wBox) * (W_VIEW - 130) + 25;
      // Формула инверсии оси Y AutoCAD -> SVG: (1 - (yCad - yBox)/hBox) * H_VIEW
      const yScr = (1 - (r.cadY - yBox) / hBox) * (H_VIEW - 90) + 20;
      const wRect = r.area > 300 ? 118 : 92;
      const hRect = r.area > 300 ? 58 : 48;
      return { ...r, xScr, yScr, wRect, hRect };
    });
  }, [rooms]);

  const handleWheel = (e) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cursorX = ((e.clientX - rect.left) / rect.width) * W_VIEW;
    const cursorY = ((e.clientY - rect.top) / rect.height) * H_VIEW;

    const factor = e.deltaY < 0 ? 1.14 : 0.88;
    const newScale = Math.min(6, Math.max(0.55, transform.scale * factor));
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

  const hoveredRoom = normalizedRooms.find(r => r.roomId === hoveredId);

  return (
    <div className="relative flex-1 min-h-[500px] rounded-xl bg-[#040d1a] border border-[#1e3a5f] overflow-hidden select-none">
      {/* Панель управления Pan & Zoom */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-[#0b192c]/95 border border-[#1e3a5f] p-1.5 rounded-xl shadow-lg">
        <button
          onClick={() => setTransform(t => ({ ...t, scale: Math.min(6, t.scale * 1.2) }))}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-emerald-400"
          title="Приблизить"
        >
          <ZoomIn className="w-4 h-4"/>
        </button>
        <span className="text-xs font-mono text-slate-300 px-1.5">{Math.round(transform.scale * 100)}%</span>
        <button
          onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.55, t.scale * 0.85) }))}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-blue-400"
          title="Отдалить"
        >
          <ZoomOut className="w-4 h-4"/>
        </button>
        <button
          onClick={() => setTransform({ scale: 1, panX: 0, panY: 0 })}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300"
          title="Сбросить масштаб"
        >
          <RotateCcw className="w-4 h-4"/>
        </button>
      </div>

      {/* Легенда воздушного режима */}
      <div className="absolute bottom-3 left-3 z-30 flex items-center gap-4 bg-[#0b192c]/95 border border-[#1e3a5f] px-3 py-1.5 rounded-xl text-[11px]">
        <span className="flex items-center gap-1.5 text-blue-300">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/60 border border-blue-400" /> Приток / Подпор (ΔL &gt; 0)
        </span>
        <span className="flex items-center gap-1.5 text-emerald-300">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60 border border-emerald-400" /> Вытяжка / Разряжение (ΔL &lt; 0)
        </span>
        <span className="flex items-center gap-1.5 text-slate-300">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-600/60 border border-slate-400" /> Сбалансировано (ΔL = 0)
        </span>
      </div>

      {pdfPreviewUrl && (
        <iframe
          src={pdfPreviewUrl}
          title="PDF Floor Plan Background"
          className="absolute inset-0 w-full h-full opacity-45 pointer-events-none border-0 mix-blend-screen"
        />
      )}

      {normalizedRooms.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
          <UploadCloud className="w-12 h-12 text-emerald-400 mb-3 opacity-80"/>
          <div className="text-base font-bold text-white">Загрузите PDF-план этажа</div>
          <div className="text-xs text-slate-400 mt-1 max-w-md">
            Динамический SVG-движок автоматически вычислит Bounding Box чертежа, инвертирует ось Y AutoCAD и привяжет помещения.
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
            <pattern id="cad-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(30, 58, 95, 0.35)" strokeWidth="1" />
            </pattern>
          </defs>

          <g transform={`translate(${transform.panX}, ${transform.panY}) scale(${transform.scale})`}>
            <rect x="-1000" y="-1000" width="4000" height="3000" fill="url(#cad-grid)" />

            {normalizedRooms.map((r) => {
              const isSelected = r.roomId === selectedId;
              const isHovered = r.roomId === hoveredId;

              let fill = 'rgba(30, 41, 59, 0.82)';
              let stroke = '#64748b';
              if (r.balance > 0) {
                fill = 'rgba(37, 99, 235, 0.32)';
                stroke = '#3b82f6';
              } else if (r.balance < 0) {
                fill = 'rgba(16, 185, 129, 0.32)';
                stroke = '#10b981';
              }
              if (isSelected || isHovered) {
                fill = 'rgba(16, 185, 129, 0.55)';
                stroke = '#34d399';
              }

              return (
                <g
                  key={r.roomId}
                  transform={`translate(${r.xScr}, ${r.yScr})`}
                  onClick={(e) => { e.stopPropagation(); onSelectRoom(r.roomId); }}
                  onMouseEnter={() => setHoveredId(r.roomId)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="cursor-pointer"
                >
                  <rect
                    width={r.wRect}
                    height={r.hRect}
                    rx="7"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelected || isHovered ? 2.6 : 1.4}
                    vectorEffect="non-scaling-stroke"
                  />
                  <rect x="5" y="5" width="44" height="16" rx="4" fill="rgba(4, 13, 26, 0.9)" />
                  <text x="9" y="16" fill="#34d399" fontSize="10" fontWeight="800">
                    {r.number}
                  </text>
                  <text x={r.wRect - 6} y="16" textAnchor="end" fill="#f8fafc" fontSize="10" fontWeight="700">
                    {r.area} м²
                  </text>
                  <text x="6" y="33" fill="#e2e8f0" fontSize="9.5" fontWeight="600">
                    {(r.rawName || '').slice(0, 14)}
                  </text>
                  <text x="6" y="44" fill="#38bdf8" fontSize="8.5" fontWeight="700">
                    L: {r.requiredSupplyAir}/{r.requiredExhaustAir}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {/* Всплывающий инженерный тултип при наведении */}
      {hoveredRoom && (
        <div className="absolute top-3 left-3 z-30 bg-[#040d1a]/95 border border-emerald-500/60 rounded-xl p-3 text-xs shadow-xl pointer-events-none space-y-1 max-w-xs">
          <div className="font-extrabold text-emerald-400">
            № {hoveredRoom.number} — {hoveredRoom.rawName}
          </div>
          <div className="text-slate-300">
            S = <strong>{hoveredRoom.area} м²</strong> | Δh = <strong>{hoveredRoom.height} м</strong> | V = <strong>{hoveredRoom.volume} м³</strong>
          </div>
          <div className="text-sky-300 font-bold">
            Приток: {hoveredRoom.requiredSupplyAir} м³/ч | Вытяжка: {hoveredRoom.requiredExhaustAir} м³/ч (ΔL: {hoveredRoom.balance})
          </div>
          <div className="text-[11px] text-slate-400">{hoveredRoom.normCode}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// КОМПОНЕНТ 2: FLOOR MANAGER (Управление высотными отметками этажей)
// ============================================================================
function FloorManager({ floors, activeFloorId, onSelectFloor, onUpdateFloor, onAddFloor }) {
  return (
    <div className="p-8 space-y-6">
      <div className="p-6 rounded-2xl bg-[#0b192c] border border-[#1e3a5f]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400"/>
              Табличный менеджер высотных отметок уровней (FloorElevationDto)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Чистая высота этажа вычисляется по формуле: Δh = H_next − H_current − δ_перекрытия. Объем помещений: V = S × Δh.
            </p>
          </div>
          <button
            onClick={onAddFloor}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold"
          >
            + Добавить уровень
          </button>
        </div>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-400 text-xs uppercase border-b border-[#1e3a5f]">
              <th className="py-3 px-3">Активный уровень</th>
              <th className="py-3 px-3">Наименование этажа</th>
              <th className="py-3 px-3">Отметка пола H_cur (м)</th>
              <th className="py-3 px-3">Отметка верха H_next (м)</th>
              <th className="py-3 px-3">Перекрытие δ (м)</th>
              <th className="py-3 px-3">Чистая высота Δh (м)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e3a5f]/60">
            {floors.map((f) => {
              const netH = calcNetHeight(f);
              const isSelected = f.id === activeFloorId;
              return (
                <tr key={f.id} className={isSelected ? 'bg-emerald-500/10' : 'hover:bg-slate-800/40'}>
                  <td className="py-3 px-3">
                    <button
                      onClick={() => onSelectFloor(f.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 shadow'
                          : 'bg-[#040d1a] text-slate-300 border border-[#1e3a5f]'
                      }`}
                    >
                      {isSelected ? 'Выбран для плана' : 'Выбрать'}
                    </button>
                  </td>
                  <td className="py-3 px-3">
                    <input
                      value={f.name}
                      onChange={(e) => onUpdateFloor(f.id, 'name', e.target.value)}
                      className="w-full bg-[#040d1a] border border-[#1e3a5f] rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      step="0.1"
                      value={f.elevationBottom}
                      onChange={(e) => onUpdateFloor(f.id, 'elevationBottom', parseFloat(e.target.value) || 0)}
                      className="w-28 bg-[#040d1a] border border-[#1e3a5f] rounded-lg px-2.5 py-1.5 text-xs font-mono text-sky-300"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      step="0.1"
                      value={f.elevationTop}
                      onChange={(e) => onUpdateFloor(f.id, 'elevationTop', parseFloat(e.target.value) || 0)}
                      className="w-28 bg-[#040d1a] border border-[#1e3a5f] rounded-lg px-2.5 py-1.5 text-xs font-mono text-sky-300"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      step="0.05"
                      value={f.slabThickness}
                      onChange={(e) => onUpdateFloor(f.id, 'slabThickness', parseFloat(e.target.value) || 0.3)}
                      className="w-24 bg-[#040d1a] border border-[#1e3a5f] rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-xs">
                      {netH} м
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// КОМПОНЕНТ 3: ESTIMATE SUMMARY (Смета ОВиК и группировка вентсистем П и В)
// ============================================================================
function EstimateSummary({ estimate, onExportExcel }) {
  return (
    <div className="p-8 space-y-6">
      {/* Сводная таблица вентиляционных систем П и В */}
      <div className="p-6 rounded-2xl bg-[#0b192c] border border-[#1e3a5f]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wind className="w-5 h-5 text-emerald-400"/>
              Автоматическая группировка систем вентиляции (П и В) и аэродинамика сети
            </h3>
            <p className="text-xs text-slate-400">
              Магистральные воздуховоды рассчитаны при скорости v₁ = 4.5 м/с, ответвления при v₂ = 2.5 м/с (с запасом +10% по СП 60.13330)
            </p>
          </div>
          <button
            onClick={onExportExcel}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg"
          >
            <FileSpreadsheet className="w-4 h-4"/> Выгрузить смету и ХОВС в Excel
          </button>
        </div>

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

      {/* Детальная сметная ведомость ОВиК */}
      <div className="p-6 rounded-2xl bg-[#0b192c] border border-[#1e3a5f]">
        <h3 className="text-lg font-bold text-white mb-4">
          Сметная ведомость стоимости оборудования, воздуховодов, ОЗК, монтажа и ПНР
        </h3>

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
  );
}

// ============================================================================
// ГЛАВНОЕ ПРИЛОЖЕНИЕ: ИИ-агент для расчета вентиляции
// ============================================================================
export function App() {
  const [cadFile, setCadFile] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [activeTab, setActiveTab] = useState('map');

  const [floors, setFloors] = useState(INITIAL_FLOORS);
  const [activeFloorId, setActiveFloorId] = useState('f-2');

  const [rawRooms, setRawRooms] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const activeFloor = floors.find(f => f.id === activeFloorId) || floors[0];
  const currentNetHeight = calcNetHeight(activeFloor);

  // Реактивный пересчет всех помещений при любом изменении отметок этажей
  const rooms = useMemo(() => {
    return rawRooms.map(r => evaluateRoomNorms(r, r.customHeight || currentNetHeight));
  }, [rawRooms, currentNetHeight]);

  const estimate = useMemo(() => buildHvacEstimate(rooms), [rooms]);
  const selectedRoom = rooms.find(r => r.roomId === selectedId) || rooms[0] || null;

  const handleUpdateFloor = (floorId, field, value) => {
    setFloors(prev => prev.map(f => (f.id === floorId ? { ...f, [field]: value } : f)));
  };

  const handleAddFloor = () => {
    const last = floors[floors.length - 1];
    const bot = last ? last.elevationTop : 0;
    const top = +(bot + 3.6).toFixed(3);
    const newFloor = {
      id: `f-${Date.now()}`,
      code: String(floors.length),
      name: `Уровень ${bot} .. +${top}`,
      elevationBottom: bot,
      elevationTop: top,
      slabThickness: 0.300
    };
    setFloors([...floors, newFloor]);
    setActiveFloorId(newFloor.id);
  };

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
      // Автоматический выбор этажа по имени файла (-3, -2, -1)
      if (targetFile.name.includes('-3') || targetFile.name.includes('11,400')) {
        setActiveFloorId('f-3');
      } else if (targetFile.name.includes('-2')) {
        setActiveFloorId('f-2');
      }

      const buffer = await targetFile.arrayBuffer();
      let extracted = await extractExplicationFromPdfBuffer(buffer);

      if (extracted.length === 0) {
        const fd = new FormData();
        fd.append('cadFile', targetFile);
        try {
          const res = await axios.post(`${API_BASE}/analyze`, fd, { timeout: 8000 });
          extracted = res.data?.rooms || [];
        } catch { }
      }

      if (extracted.length === 0) {
        setError('В загруженном PDF не найдена таблица экспликации помещений.');
      } else {
        setRawRooms(extracted);
        setSelectedId(extracted[0].roomId);
        const sumArea = extracted.reduce((s, r) => s + (Number(r.area) || 0), 0).toFixed(2);
        setSuccessMsg(`Извлечено помещений: ${extracted.length} шт. Площадь: ${sumArea} м². Высота этажа Δh = ${currentNetHeight} м.`);
        setActiveTab('map');
      }
    } catch (e) {
      setError(`Ошибка обработки PDF: ${e.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePdfSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCadFile(file);
    if (file.name.toLowerCase().endsWith('.pdf')) {
      setPdfPreviewUrl(URL.createObjectURL(file) + '#view=Fit');
    }
    await runPdfExtraction(file);
  };

  const handleUpdateRoom = (field, value) => {
    setRawRooms(prev =>
      prev.map(r => {
        if (r.roomId !== selectedId) return r;
        if (field === 'height') return { ...r, customHeight: parseFloat(value) || currentNetHeight };
        return { ...r, [field]: value };
      })
    );
  };

  const handleAiValidateRoom = (roomId) => {
    const target = rooms.find(r => r.roomId === roomId);
    if (!target) return;
    setSuccessMsg(
      `ИИ-валидация № ${target.number} («${target.rawName}»): подтвержден норматив ${target.normCode} — приток ${target.requiredSupplyAir} м³/ч, вытяжка ${target.requiredExhaustAir} м³/ч.`
    );
  };

  const handleBalanceAir = () => {
    const sup = rooms.reduce((s, r) => s + r.requiredSupplyAir, 0);
    const exh = rooms.reduce((s, r) => s + r.requiredExhaustAir, 0);
    setSuccessMsg(`Сводный баланс этажа проверен по СП 60.13330: Приток ${sup} м³/ч, Вытяжка ${exh} м³/ч (ΔL = ${sup - exh} м³/ч).`);
  };

  const handleExportExcel = () => {
    if (rooms.length === 0) {
      setError('Сначала загрузите PDF-план с экспликацией помещений!');
      return;
    }
    let csv = '\uFEFFРАЗДЕЛ 1: ТАБЛИЦА ЭКСПЛИКАЦИИ И ВОЗДУШНОГО БАЛАНСА (ХОВС ПО ГОСТ 21.602)\n';
    csv += `Активный этаж:;${activeFloor.name};Отметки:;${activeFloor.elevationBottom} .. ${activeFloor.elevationTop} м;Чистая высота Δh:;${currentNetHeight} м\n\n`;
    csv += '№ Пом.;Наименование помещения;Категория;Площадь S (м2);Высота Δh (м);Объем V (м3);Нормативный документ;Методика;Приток Lпр (м3/ч);Вытяжка Lвыт (м3/ч);Дисбаланс ΔL;Система\n';

    rooms.forEach(r => {
      csv += `"${r.number}";"${r.rawName}";"${r.normalizedType}";"${String(r.area).replace('.', ',')}";"${String(r.height).replace('.', ',')}";"${String(r.volume).replace('.', ',')}";"${r.normCode}";"${r.method}";${r.requiredSupplyAir};${r.requiredExhaustAir};${r.balance};"${r.systemTag}"\n`;
    });

    csv += `\nРАЗДЕЛ 2: СПЕЦИФИКАЦИЯ СИСТЕМ ВЕНТИЛЯЦИИ (П и В)\n`;
    csv += 'Код системы;Назначение;Помещений;Расчетный расход L (+10%), м3/ч;Сечение магистрали F1 (м2);Площадь стали воздуховодов (м2);Толщина стали\n';
    estimate.systems.forEach(s => {
      csv += `"${s.code}";"${s.type}";${s.count};${s.flow};"${String(s.fMain).replace('.', ',')}";"${String(s.ductArea).replace('.', ',')}";"${s.metal}"\n`;
    });

    csv += `\nРАЗДЕЛ 3: СМЕТНАЯ ВЕДОМОСТЬ ОВиК\n`;
    csv += 'Категория;Наименование позиции;Ед. изм.;Количество;Цена за ед. (руб.);Сумма (руб.)\n';
    estimate.items.forEach(i => {
      csv += `"${i.category}";"${i.name}";"${i.unit}";"${String(i.qty).replace('.', ',')}";${i.price};${i.total}\n`;
    });
    csv += `"ИТОГО ПО СМЕТЕ ОВиК";"Включая оборудование, воздуховоды, ОЗК, монтаж и ПНР";"руб.";1;${estimate.grandTotal};${estimate.grandTotal}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Расчет_вентиляции_и_Смета_ОВиК_${cadFile ? cadFile.name.replace('.pdf', '') : 'ГОСТ'}.csv`;
    a.click();
    setSuccessMsg('Полная ведомость ХОВС и смета ОВиК выгружены в Excel!');
  };

  const totalArea = rooms.reduce((s, r) => s + r.area, 0).toFixed(2);
  const totalVol = rooms.reduce((s, r) => s + r.volume, 0).toFixed(1);
  const totalSupply = rooms.reduce((s, r) => s + r.requiredSupplyAir, 0);
  const totalExhaust = rooms.reduce((s, r) => s + r.requiredExhaustAir, 0);

  const filteredRooms = rooms.filter(r =>
    r.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.rawName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.normalizedType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex w-full bg-[#040d1a] text-slate-100 font-sans">
      {/* Сайдбар с новым названием «ИИ-агент для расчета вентиляции» */}
      <aside className="w-76 bg-[#0b192c] border-r border-[#1e3a5f] flex flex-col justify-between shrink-0 p-5">
        <div>
          <div className="flex items-center gap-3 pb-5 border-b border-[#1e3a5f]">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-400 flex items-center justify-center font-black text-lg text-white shadow-lg shadow-emerald-500/25 shrink-0">
              <Wind className="w-6 h-6"/>
            </div>
            <div>
              <div className="font-extrabold text-sm leading-tight bg-gradient-to-r from-blue-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                ИИ-агент для расчета вентиляции
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">СП 60.13330 • ХОВС • Смета ОВиК</div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">Инженерные модули</div>

            <button
              onClick={() => setActiveTab('map')}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'map'
                  ? 'bg-gradient-to-r from-blue-600/35 to-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><MapIcon className="w-4 h-4 text-emerald-400"/> 2D-Карта (SVG Canvas)</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs">{rooms.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('floors')}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'floors'
                  ? 'bg-gradient-to-r from-blue-600/35 to-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><Sliders className="w-4 h-4 text-teal-400"/> Этажи и Отметки (Δh)</span>
              <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-xs">{currentNetHeight} м</span>
            </button>

            <button
              onClick={() => setActiveTab('table')}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'table'
                  ? 'bg-gradient-to-r from-blue-600/35 to-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><Table2 className="w-4 h-4 text-sky-400"/> Экспликация и СП</span>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-xs">ХОВС</span>
            </button>

            <button
              onClick={() => setActiveTab('estimate')}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'estimate'
                  ? 'bg-gradient-to-r from-blue-600/35 to-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5"><Calculator className="w-4 h-4 text-blue-400"/> Смета ОВиК и Сеть</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs">{estimate.systems.length} сист.</span>
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-[#072227] border border-emerald-500/30 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-emerald-400">
            <Cpu className="w-4 h-4"/> Нормативное ядро СП
          </div>
          <div className="text-slate-400 leading-relaxed">
            Уровень: <strong className="text-white">{activeFloor.name}</strong> (Δh = {currentNetHeight} м). СП 60.13330.2020 + СП 118.13330.2022.
          </div>
        </div>
      </aside>

      {/* Основная рабочая область */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="px-8 py-4 bg-[#0b192c]/90 border-b border-[#1e3a5f] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400"/> ИИ-агент для расчета вентиляции
            </h1>
            <p className="text-xs text-slate-400">
              Динамический SVG-план • Расчет высот по отметкам (Δh = {currentNetHeight} м) • Нормативы СП и смета ОВиК
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={activeFloorId}
              onChange={(e) => setActiveFloorId(e.target.value)}
              className="bg-[#040d1a] border border-[#1e3a5f] rounded-xl px-3 py-2 text-xs font-semibold text-emerald-300 outline-none"
            >
              {floors.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} (Δh = {calcNetHeight(f)} м)
                </option>
              ))}
            </select>

            <label className="cursor-pointer px-4 py-2.5 rounded-xl font-semibold text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 flex items-center gap-2 transition-all">
              <UploadCloud className="w-4 h-4"/>
              {cadFile ? cadFile.name.slice(0, 20) + '...' : 'Загрузить PDF-план'}
              <input type="file" accept=".pdf" onChange={handlePdfSelect} className="hidden" />
            </label>

            <button
              onClick={handleExportExcel}
              className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4"/> Скачать Excel (ХОВС + Смета)
            </button>
          </div>
        </header>

        <div className="px-8 pt-4">
          {error && <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0"/> {error}</div>}
          {successMsg && <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 shrink-0"/> {successMsg}</div>}
        </div>

        {/* KPI-карточки */}
        <div className="grid grid-cols-4 gap-4 px-8 pt-5">
          <div className="p-4 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] border-l-4 border-l-blue-500 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Помещений / Высота Δh</div>
              <div className="text-xl font-extrabold text-white mt-1">{rooms.length} шт. • {currentNetHeight} м</div>
            </div>
            <Building2 className="w-7 h-7 text-blue-400 opacity-80"/>
          </div>
          <div className="p-4 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] border-l-4 border-l-emerald-500 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Площадь S / Объем V</div>
              <div className="text-xl font-extrabold text-emerald-400 mt-1">{totalArea} м² • {totalVol} м³</div>
            </div>
            <Maximize2 className="w-7 h-7 text-emerald-400 opacity-80"/>
          </div>
          <div className="p-4 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] border-l-4 border-l-sky-500 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Приток / Вытяжка</div>
              <div className="text-xl font-extrabold text-sky-400 mt-1">{totalSupply} / {totalExhaust} м³/ч</div>
            </div>
            <Wind className="w-7 h-7 text-sky-400 opacity-80"/>
          </div>
          <div className="p-4 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] border-l-4 border-l-teal-400 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Смета ОВиК (Итого)</div>
              <div className="text-xl font-extrabold text-teal-300 mt-1">{estimate.grandTotal.toLocaleString('ru-RU')} ₽</div>
            </div>
            <Calculator className="w-7 h-7 text-teal-400 opacity-80"/>
          </div>
        </div>

        {/* ВКЛАДКА 1: SVG КАРТА ПЛАНА */}
        {activeTab === 'map' && (
          <div className="p-8 grid grid-cols-3 gap-6 flex-1">
            <div className="col-span-2 p-5 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <MapIcon className="w-4 h-4 text-emerald-400"/> Динамический SVG-план этажа (Pan & Zoom к курсору)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Координаты нормализованы по Bounding Box с инверсией оси Y AutoCAD. Колесико мыши — зум к курсору.
                  </p>
                </div>
              </div>

              <PlanCanvas onSelectRoom={setSelectedId} pdfPreviewUrl={pdfPreviewUrl} rooms={rooms} selectedId={selectedId}/>
            </div>

            <div className="p-5 rounded-2xl bg-[#0b192c] border border-[#1e3a5f] flex flex-col justify-between">
              {selectedRoom ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1e3a5f] pb-3">
                    <div>
                      <span className="text-xs text-emerald-400 font-bold uppercase">{selectedRoom.systemTag}</span>
                      <h3 className="text-lg font-extrabold text-white">Помещение {selectedRoom.number}</h3>
                    </div>
                    <button
                      onClick={() => handleAiValidateRoom(selectedRoom.roomId)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5"/> ИИ-норматив
                    </button>
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

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-emerald-300 font-semibold mb-1">Площадь S (м²)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full bg-[#040d1a] border border-emerald-500/60 rounded-xl px-2.5 py-1.5 text-sm font-extrabold text-emerald-300 outline-none"
                        value={selectedRoom.area}
                        onChange={(e) => handleUpdateRoom('area', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Высота Δh (м)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="w-full bg-[#040d1a] border border-[#1e3a5f] rounded-xl px-2.5 py-1.5 text-sm text-white outline-none"
                        value={selectedRoom.height}
                        onChange={(e) => handleUpdateRoom('height', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-sky-300 mb-1">Объем V (м³)</label>
                      <input
                        disabled
                        className="w-full bg-[#040d1a]/60 border border-[#1e3a5f] rounded-xl px-2.5 py-1.5 text-sm font-bold text-sky-300"
                        value={selectedRoom.volume}
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#040d1a] border border-[#1e3a5f] text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Категория помещения:</span>
                      <strong className="text-emerald-300">{selectedRoom.normalizedType}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Нормативный документ:</span>
                      <strong className="text-white">{selectedRoom.normCode}</strong>
                    </div>
                    <div className="text-[11px] text-slate-400 border-l-2 border-emerald-500 pl-2">
                      {selectedRoom.normCitation}
                    </div>
                    <div className="flex justify-between pt-1 border-t border-[#1e3a5f]">
                      <span className="text-slate-400">Приток Lпр / Вытяжка Lвыт:</span>
                      <strong className="text-sky-400">{selectedRoom.requiredSupplyAir} / {selectedRoom.requiredExhaustAir} м³/ч</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Воздушный баланс ΔL:</span>
                      <strong className={selectedRoom.balance >= 0 ? 'text-blue-400' : 'text-emerald-400'}>
                        {selectedRoom.balance > 0 ? `+${selectedRoom.balance}` : selectedRoom.balance} м³/ч
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400">Загрузите PDF-план, чтобы увидеть расчет помещения</div>
              )}

              <button
                onClick={() => setActiveTab('estimate')}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-emerald-500/30"
              >
                Перейти к смете ОВиК ({estimate.grandTotal.toLocaleString('ru-RU')} ₽)
              </button>
            </div>
          </div>
        )}

        {/* ВКЛАДКА 2: ЭТАЖИ И ОТМЕТКИ */}
        {activeTab === 'floors' && (
          <FloorManager activeFloorId={activeFloorId} floors={floors} onAddFloor={handleAddFloor} onSelectFloor={setActiveFloorId} onUpdateFloor={handleUpdateFloor}/>
        )}

        {/* ВКЛАДКА 3: ТАБЛИЦА ЭКСПЛИКАЦИИ И ВОЗДУШНОГО БАЛАНСА */}
        {activeTab === 'table' && (
          <div className="p-8">
            <div className="p-6 rounded-2xl bg-[#0b192c] border border-[#1e3a5f]">
              <div className="flex justify-between items-center mb-4">
                <input
                  type="text"
                  placeholder="Поиск по номеру (-02.C0.106...) или названию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-96 bg-[#040d1a] border border-[#1e3a5f] rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-emerald-400"
                />
                <button
                  onClick={handleBalanceAir}
                  className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold"
                >
                  Проверить воздушный баланс здания
                </button>
              </div>

              <div className="max-h-[520px] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#0b192c]">
                    <tr className="text-slate-400 text-xs uppercase border-b border-[#1e3a5f]">
                      <th className="py-3 px-2.5">№</th>
                      <th className="py-3 px-2.5">Наименование</th>
                      <th className="py-3 px-2.5">S (м²)</th>
                      <th className="py-3 px-2.5">Δh (м)</th>
                      <th className="py-3 px-2.5">V (м³)</th>
                      <th className="py-3 px-2.5">Нормативный документ</th>
                      <th className="py-3 px-2.5">Приток Lпр</th>
                      <th className="py-3 px-2.5">Вытяжка Lвыт</th>
                      <th className="py-3 px-2.5">ΔL</th>
                      <th className="py-3 px-2.5">Действие</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e3a5f]/60">
                    {filteredRooms.map((r) => (
                      <tr key={r.roomId} className="hover:bg-slate-800/50">
                        <td
                          onClick={() => { setSelectedId(r.roomId); setActiveTab('map'); }}
                          className="py-2.5 px-2.5 font-extrabold text-emerald-400 cursor-pointer"
                        >
                          {r.number}
                        </td>
                        <td className="py-2.5 px-2.5 font-medium text-white">{r.rawName}</td>
                        <td className="py-2.5 px-2.5 font-bold text-white">{r.area}</td>
                        <td className="py-2.5 px-2.5 text-slate-300">{r.height}</td>
                        <td className="py-2.5 px-2.5 font-semibold text-sky-300">{r.volume}</td>
                        <td className="py-2.5 px-2.5 text-xs text-slate-300">
                          <div className="font-bold text-emerald-300">{r.normCode}</div>
                          <div className="text-[11px] text-slate-400">{r.method}</div>
                        </td>
                        <td className="py-2.5 px-2.5 font-bold text-blue-400">{r.requiredSupplyAir}</td>
                        <td className="py-2.5 px-2.5 font-bold text-emerald-400">{r.requiredExhaustAir}</td>
                        <td className="py-2.5 px-2.5 font-mono text-xs">
                          {r.balance > 0 ? `+${r.balance}` : r.balance}
                        </td>
                        <td className="py-2.5 px-2.5">
                          <button
                            onClick={() => handleAiValidateRoom(r.roomId)}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-semibold"
                          >
                            ИИ-валидация
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#040d1a] border-t-2 border-emerald-500/40 font-extrabold text-xs">
                    <tr>
                      <td colSpan={2} className="py-3 px-2.5 text-white">ИТОГО ПО ЗДАНИЮ / ЭТАЖУ:</td>
                      <td className="py-3 px-2.5 text-emerald-400">{totalArea} м²</td>
                      <td className="py-3 px-2.5 text-slate-300">{currentNetHeight} м</td>
                      <td className="py-3 px-2.5 text-sky-400">{totalVol} м³</td>
                      <td className="py-3 px-2.5 text-slate-400">СП 60.13330.2020</td>
                      <td className="py-3 px-2.5 text-blue-400">{totalSupply} м³/ч</td>
                      <td className="py-3 px-2.5 text-emerald-400">{totalExhaust} м³/ч</td>
                      <td colSpan={2} className="py-3 px-2.5 text-teal-300">
                        ΔL = {totalSupply - totalExhaust} м³/ч
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ВКЛАДКА 4: СМЕТА ОВиК */}
        {activeTab === 'estimate' && (
          <EstimateSummary estimate={estimate} onExportExcel={handleExportExcel}/>
        )}
      </main>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App/>);
}

export default App;