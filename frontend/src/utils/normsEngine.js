// Нормативный движок СП 60.13330.2020, СП 118.13330.2022, СП 44.13330.2011, СанПиН 1.2.3685-21
export function evaluateRoomNorms(rawRoom, netHeight) {
  const area = +(Number(rawRoom.area) || 0).toFixed(2);
  const height = +(Number(rawRoom.height || netHeight) || 3.3).toFixed(2);
  const volume = +(area * height).toFixed(2);
  const lower = (rawRoom.rawName || '').toLowerCase();

  let normalizedType = 'Тех. помещение';
  let normCode = 'СП 60.13330.2020';
  let normCitation = 'Базовая кратность тех. помещений K=1.5';
  let calculationMethod = 'По кратности (K=1.5)';
  let inflowRate = Math.round(volume * 1.5);
  let exhaustRate = Math.round(volume * 1.5);
  let calculationFormula = `Lпр = 1.5 × ${volume} = ${inflowRate} м³/ч; Lвыт = 1.5 × ${volume} = ${exhaustRate} м³/ч`;
  let systemTag = 'П1 / В1';

  let peopleCount = rawRoom.peopleCount !== undefined ? rawRoom.peopleCount : 0;
  let hasNaturalVentilation = !!rawRoom.hasNaturalVentilation;
  let toilets = rawRoom.toilets !== undefined ? rawRoom.toilets : 0;
  let urinals = rawRoom.urinals !== undefined ? rawRoom.urinals : 0;
  let showers = rawRoom.showers !== undefined ? rawRoom.showers : 0;
  let sinks = rawRoom.sinks !== undefined ? rawRoom.sinks : 0;

  // 1. Автостоянка
  if (lower.includes('автомобил') || lower.includes('автостоянк') || lower.includes('паркинг') || lower.includes('машино')) {
    normalizedType = 'Автостоянка';
    normCode = 'СП 60.13330.2020 / СП 113.13330';
    normCitation = 'Вытяжка K=5, компенсационный приток K=4 (разрежение -20%)';
    calculationMethod = 'По кратности (Kпр=4.0, Kвыт=5.0)';
    inflowRate = Math.round(volume * 4.0);
    exhaustRate = Math.round(volume * 5.0);
    calculationFormula = `Lпр = 4.0 × ${volume} = ${inflowRate} м³/ч; Lвыт = 5.0 × ${volume} = ${exhaustRate} м³/ч (дисбаланс -20%)`;
    systemTag = 'П-Паркинг / В-Паркинг';
  }
  // 2. Санузел / Уборная / Душевая — расчет строго по сан. приборам (СП 118.13330.2022 табл. 7.1, СП 44.13330.2011)
  else if (lower.includes('санузел') || lower.includes('уборн') || lower.includes('туалет') || lower.includes('с/у') || lower.includes('душев')) {
    normalizedType = lower.includes('душ') ? 'Душевая' : 'Санузел';
    normCode = 'СП 118.13330.2022 табл. 7.1 / СП 44.13330';
    normCitation = '50 м³/ч на 1 унитаз, 25 м³/ч на 1 писсуар, 75 м³/ч на 1 душ.сетку (переток)';
    calculationMethod = 'По сан. приборам (СП 118.13330)';

    // Автоопределение приборов по площади/названию, если пользователь еще не задал их
    if (toilets === 0 && urinals === 0 && showers === 0 && sinks === 0) {
      if (lower.includes('душ')) {
        showers = Math.max(1, Math.round(area / 3.0));
      } else if (lower.includes('женск')) {
        toilets = Math.max(1, Math.round(area / 3.0));
      } else if (lower.includes('мужск')) {
        toilets = Math.max(1, Math.round(area / 4.0));
        urinals = Math.max(1, Math.round(area / 4.0));
      } else {
        toilets = 1;
        if (area >= 3.0) urinals = 1;
      }
    }

    inflowRate = 0;
    exhaustRate = (toilets * 50) + (urinals * 25) + (showers * 75) + (sinks * 20);
    if (exhaustRate < 50) exhaustRate = 50;

    const parts = [];
    if (toilets > 0) parts.Add ? null : parts.push(`${toilets} унит × 50`);
    if (urinals > 0) parts.push(`${urinals} писс × 25`);
    if (showers > 0) parts.push(`${showers} душ × 75`);
    if (sinks > 0) parts.push(`${sinks} умыв × 20`);

    calculationFormula = `Lвыт = ${parts.join(' + ')} = ${exhaustRate} м³/ч; Lпр = 0 (переток по СП 118.13330)`;
    systemTag = 'В-СУ';
  }
  // 3. Офисы / Кабинеты / Переговорные — расчет строго по людям (СП 60.13330.2020 п. 7.1 / СанПиН 1.2.3685-21)
  else if (lower.includes('офис') || lower.includes('кабинет') || lower.includes('переговор') || lower.includes('диспетчер') || lower.includes('охрана') || lower.includes('пост') || lower.includes('администр')) {
    normalizedType = 'Офис / Рабочее';
    normCode = 'СП 60.13330.2020 п. 7.1 / СанПиН 1.2.3685-21';

    if (peopleCount <= 0) {
      peopleCount = Math.max(1, Math.ceil(area / 6.0)); // норма 6 м2 на 1 раб. место по СанПиН
    }

    const rate = hasNaturalVentilation ? 40 : 60;
    normCitation = `Санитарная норма по людям: ${rate} м³/ч на 1 человека (${peopleCount} чел. по СанПиН 1.2.3685-21, 6 м²/чел)`;
    calculationMethod = `По числу людей (${peopleCount} чел × ${rate} м³/ч)`;

    inflowRate = peopleCount * rate;
    exhaustRate = inflowRate; // По балансу СП 60.13330.2020
    calculationFormula = `Lпр = ${peopleCount} чел × ${rate} = ${inflowRate} м³/ч; Lвыт = ${inflowRate} м³/ч (по балансу СП 60.13330 / СанПиН)`;
    systemTag = 'П1 / В1';
  }
  // 4. ПУИ / Уборочный инвентарь
  else if (lower.includes('пуи') || lower.includes('уборочн') || lower.includes('уборка') || lower.includes('инвентар')) {
    normalizedType = 'ПУИ / Инвентарь';
    normCode = 'СП 118.13330.2022 п. 7.2';
    normCitation = 'Вытяжка L = 5×V, но не менее 100 м³/ч (разрежение)';
    calculationMethod = 'По кратности K=5.0 (min 100 м³/ч)';
    inflowRate = 0;
    exhaustRate = Math.max(100, Math.round(volume * 5.0));
    calculationFormula = `Lвыт = max(100, 5.0 × ${volume}) = ${exhaustRate} м³/ч; Lпр = 0 (переток)`;
    systemTag = 'В-СУ';
  }
  // 5. Электрощитовые
  else if (lower.includes('электрощитов') || lower.includes('грщ') || lower.includes('ибп') || lower.includes('асо') || lower.includes('сс') || lower.includes('связ') || lower.includes('кроссов')) {
    normalizedType = 'Электрощитовая';
    normCode = 'СП 60.13330.2020 / ПУЭ';
    normCitation = 'Ассимиляция теплоизбытков: вытяжка K=1.0, мех. приток не требуется';
    calculationMethod = 'Ассимиляция теплоизбытков (K=1.0)';
    inflowRate = 0;
    exhaustRate = Math.max(30, Math.round(volume * 1.0));
    calculationFormula = `Lвыт = 1.0 × ${volume} = ${exhaustRate} м³/ч; Lпр = 0 (мех. приток не требуется)`;
    systemTag = 'В1-Тех';
  }
  // 6. ИТП / Насосная
  else if (lower.includes('итп') || lower.includes('тепловой') || lower.includes('насосн') || lower.includes('кнс') || lower.includes('водомер')) {
    normalizedType = 'ИТП / Насосная';
    normCode = 'СП 41-101-95 / СП 60.13330.2020';
    normCitation = 'Механическая вентиляция: приток K=3.0, вытяжка K=3.0';
    calculationMethod = 'По кратности (K=3.0)';
    inflowRate = Math.round(volume * 3.0);
    exhaustRate = Math.round(volume * 3.0);
    calculationFormula = `Lпр = 3.0 × ${volume} = ${inflowRate} м³/ч; Lвыт = 3.0 × ${volume} = ${exhaustRate} м³/ч`;
    systemTag = 'П1 / В1';
  }
  // 7. Венткамера
  else if (lower.includes('венткамер') || lower.includes('холодильн') || lower.includes('кондиционир') || lower.includes('аугпт')) {
    normalizedType = 'Венткамера';
    normCode = 'СП 60.13330.2020 п. 7.1';
    normCitation = 'Кратность воздухообмена: приток K=1.0, вытяжка K=1.0';
    calculationMethod = 'По кратности (K=1.0)';
    inflowRate = Math.round(volume * 1.0);
    exhaustRate = Math.round(volume * 1.0);
    calculationFormula = `Lпр = 1.0 × ${volume} = ${inflowRate} м³/ч; Lвыт = 1.0 × ${volume} = ${exhaustRate} м³/ч`;
    systemTag = 'П1 / В1';
  }
  // 8. Тамбур-шлюз
  else if (lower.includes('тамбур') || lower.includes('лифтовой холл')) {
    normalizedType = 'Тамбур-шлюз / Холл';
    normCode = 'СП 7.13130.2013 / СП 60.13330.2020';
    normCitation = 'Подпор воздуха: избыточное давление ≥ 20 Па (min 100 м³/ч)';
    calculationMethod = 'Подпор воздуха (ΔP ≥ 20 Па)';
    inflowRate = Math.max(100, Math.round(volume * 1.5));
    exhaustRate = 0;
    calculationFormula = `Lпр = max(100, 1.5 × ${volume}) = ${inflowRate} м³/ч; Lвыт = 0 (подпор ≥ 20 Па)`;
    systemTag = 'ПД-Подпор';
  }
  // 9. Кладовые / Склады
  else if (lower.includes('кладов') || lower.includes('склад') || lower.includes('мусор') || lower.includes('хранен') || lower.includes('архив')) {
    normalizedType = 'Кладовая / Склад';
    normCode = 'СП 60.13330.2020 / СП 54.13330.2022';
    normCitation = 'Кратность складских зон: вытяжка K=1.5, приток K=1.0';
    calculationMethod = 'По кратности (Kпр=1.0, Kвыт=1.5)';
    inflowRate = Math.round(volume * 1.0);
    exhaustRate = Math.round(volume * 1.5);
    calculationFormula = `Lпр = 1.0 × ${volume} = ${inflowRate} м³/ч; Lвыт = 1.5 × ${volume} = ${exhaustRate} м³/ч`;
    systemTag = 'П1 / В1';
  }
  // 10. Коридоры / МОП
  else if (lower.includes('коридор') || lower.includes('моп') || lower.includes('лестнич') || lower.includes('вестибюл')) {
    normalizedType = 'МОП / Коридор';
    normCode = 'СП 60.13330.2020';
    normCitation = 'Общеобменная вентиляция: приток K=1.0, вытяжка K=0.5';
    calculationMethod = 'По кратности (Kпр=1.0, Kвыт=0.5)';
    inflowRate = Math.round(volume * 1.0);
    exhaustRate = Math.round(volume * 0.5);
    calculationFormula = `Lпр = 1.0 × ${volume} = ${inflowRate} м³/ч; Lвыт = 0.5 × ${volume} = ${exhaustRate} м³/ч`;
    systemTag = 'П1 / В1';
  }

  return {
    ...rawRoom,
    area,
    height,
    volume,
    peopleCount,
    hasNaturalVentilation,
    toilets,
    urinals,
    showers,
    sinks,
    normalizedType,
    normCode,
    normCitation,
    calculationMethod,
    calculationFormula,
    requiredSupplyAir: inflowRate,
    requiredExhaustAir: exhaustRate,
    balance: +(inflowRate - exhaustRate).toFixed(1),
    systemTag
  };
}
