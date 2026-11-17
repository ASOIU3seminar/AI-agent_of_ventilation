import { inflate } from 'pako';

// Нативный парсер PDF с извлечением CAD-координат, таблицы экспликации и высотных отметок
export async function extractExplicationFromPdfBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const latin = new TextDecoder('latin1').decode(bytes);

  const objDict = {};
  const objRegex = /(\d+)\s+0\s+obj\b([\s\S]*?)endobj/g;
  let m;
  while ((m = objRegex.exec(latin)) !== null) {
    objDict[Number(m[1])] = { body: m[2], offset: m.index + m[0].indexOf(m[2]) };
  }

  function readObjectStream(obj) {
    if (!obj) return '';
    const sIdx = obj.body.indexOf('stream');
    if (sIdx < 0) return obj.body;
    let start = obj.offset + sIdx + 6;
    if (bytes[start] === 13) start++;
    if (bytes[start] === 10) start++;
    const eIdx = latin.indexOf('endstream', start);
    if (eIdx < 0) return '';
    const slice = bytes.subarray(start, eIdx);

    if (obj.body.includes('/FlateDecode')) {
      try {
        const decompressed = inflate(slice);
        return new TextDecoder('latin1').decode(decompressed);
      } catch {
        return '';
      }
    }
    return new TextDecoder('latin1').decode(slice);
  }

  const fontToObj = {};
  const fontMapRegex = /\/(F\d+)\s+(\d+)\s+0\s+R/g;
  for (const k in objDict) {
    if (objDict[k].body.includes('/Font')) {
      let fm;
      while ((fm = fontMapRegex.exec(objDict[k].body)) !== null) {
        fontToObj[fm[1]] = Number(fm[2]);
      }
    }
  }

  const fontCmaps = {};
  const tuRegex = /\/ToUnicode\s+(\d+)\s+0\s+R/;
  const bfRegex = /<([0-9a-fA-F]{4})>\s*<([0-9a-fA-F]{4})>/g;
  for (const fName in fontToObj) {
    const fObj = objDict[fontToObj[fName]];
    if (!fObj) continue;
    const tuMatch = tuRegex.exec(fObj.body);
    if (!tuMatch) continue;
    const cmapStream = readObjectStream(objDict[Number(tuMatch[1])]);
    const cmap = {};
    let bfm;
    while ((bfm = bfRegex.exec(cmapStream)) !== null) {
      cmap[parseInt(bfm[1], 16)] = String.fromCharCode(parseInt(bfm[2], 16));
    }
    fontCmaps[fName] = cmap;
  }

  const tfRegex = /\/(F\d+)\s+[0-9\.]+\s+Tf/;
  const tmRegex = /([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+Tm/;
  const hexTjRegex = /<([0-9a-fA-F]+)>\s*Tj/;
  const litTjRegex = /\(([^\(\)\\]+)\)\s*Tj/;

  const tokens = [];
  for (const k in objDict) {
    if (!objDict[k].body.includes('stream')) continue;
    const stream = readObjectStream(objDict[k]);
    if (!stream || (!stream.includes('Tj') && !stream.includes('TJ'))) continue;

    let curFont = 'F1';
    let curX = 0;
    let curY = 0;
    const lines = stream.split(/\r?\n/);
    for (const line of lines) {
      const tfM = tfRegex.exec(line);
      if (tfM) curFont = tfM[1];

      const tmM = tmRegex.exec(line);
      if (tmM) {
        curX = parseFloat(tmM[5]) || 0;
        curY = parseFloat(tmM[6]) || 0;
      }

      const hexM = hexTjRegex.exec(line);
      if (hexM) {
        const hex = hexM[1];
        const cmap = fontCmaps[curFont] || {};
        let decoded = '';
        for (let i = 0; i + 4 <= hex.length; i += 4) {
          const cid = parseInt(hex.substring(i, i + 4), 16);
          decoded += cmap[cid] || '';
        }
        if (decoded.trim()) {
          tokens.push({ x: curX, y: curY, text: decoded.trim() });
        }
      } else {
        const litM = litTjRegex.exec(line);
        if (litM && litM[1].trim()) {
          tokens.push({ x: curX, y: curY, text: litM[1].trim() });
        }
      }
    }
  }

  // --- 1. Определение высоты и номера этажа из чертежа PDF ---
  let detectedFloor = null;
  let detectedElevation = null;
  let detectedHeight = 3.6; // Чистая высота для подземных этажей автостоянки

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/план/i.test(t.text)) {
      const nearby = tokens.filter(n => Math.abs(n.x - t.x) <= 250 && Math.abs(n.y - t.y) <= 1500);
      const combined = nearby.map(n => n.text).join(' ');
      const mPlan = combined.match(/План\s*(-?\d+)\s*этажа(?:\s*на\s*отметке\s*([+-]?\d+[,.]\d+))?/i);
      if (mPlan) {
        detectedFloor = mPlan[1];
        if (mPlan[2]) {
          detectedElevation = parseFloat(mPlan[2].replace(',', '.'));
        }
        break;
      }
    }
  }

  if (detectedElevation === null) {
    const otmTok = tokens.find(t => /отметке/i.test(t.text));
    if (otmTok) {
      const nearVal = tokens.find(t => Math.abs(t.x - otmTok.x) <= 300 && Math.abs(t.y - otmTok.y) <= 600 && /^[-+]?\d+[,.]\d{3}$/.test(t.text));
      if (nearVal) {
        detectedElevation = parseFloat(nearVal.text.replace(',', '.'));
      }
    }
  }

  if (detectedElevation !== null) {
    if (Math.abs(detectedElevation - (-18.6)) < 0.1) {
      detectedFloor = '-5';
      detectedHeight = 3.6;
    } else if (Math.abs(detectedElevation - (-15.0)) < 0.1) {
      detectedFloor = '-4';
      detectedHeight = 3.6;
    } else if (Math.abs(detectedElevation - (-11.4)) < 0.1) {
      detectedFloor = '-3';
      detectedHeight = 3.6;
    } else if (Math.abs(detectedElevation - (-8.1)) < 0.1) {
      detectedFloor = '-2';
      detectedHeight = 3.3;
    } else if (Math.abs(detectedElevation - (-4.8)) < 0.1) {
      detectedFloor = '-1';
      detectedHeight = 3.3;
    }
  }

  const floorInfo = {
    floorCode: detectedFloor || '-5',
    name: detectedFloor ? `Подземный ${detectedFloor} этаж (отм. ${detectedElevation ?? '-18.600'} м)` : 'Подземный этаж',
    elevation: detectedElevation ?? -18.600,
    height: detectedHeight
  };

  // --- 2. Извлечение помещений и координат ---
  const roomPattern = /^(-?[0-9]{1,2}\.[0-9]{2}[а-яА-Яa-zA-Z]?|-[0-9]{2}\.[A-Za-zА-Яа-я0-9]{2}\.[0-9]{1,3}|[0-9]{1,2}\.[A-Za-z0-9]+\.[0-9]{1,3})$/;
  const datePattern = /^\d{2}\.\d{2}\.\d{2,4}$/;
  const codePattern = /^\d+\.\d+\.\d+$/;
  const areaPattern = /^[0-9]{1,5}[,\.][0-9]{2}$/;

  const allRoomTokens = tokens.filter(t => roomPattern.test(t.text) && !datePattern.test(t.text) && !codePattern.test(t.text));

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
        !/^\d+:\d+$/.test(t.text) &&
        !/^\d{2}\.\d{2}\.\d{2}$/.test(t.text)
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
      height: floorInfo.height,
      cadX: pt ? pt.x : null,
      cadY: pt ? pt.y : null,
      hasPlanCoord: Boolean(pt),
      detectionSource: pt ? `Экспликация PDF + План (Кат. ${fireCat})` : `Экспликация PDF (Кат. ${fireCat})`
    });
  }

  rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  rooms.floorInfo = floorInfo;
  return rooms;
}
