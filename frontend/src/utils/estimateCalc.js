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
    const fMain = +(flow / (3600 * 4.5)).toFixed(3);
    const fBranch = +(flow / Math.max(1, count) / (3600 * 2.5)).toFixed(3);
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

  const equipCost = baseItems.filter(i => i.category.startsWith('1')).reduce((s, i) => s + i.total, 0);
  const matCost = baseItems.filter(i => !i.category.startsWith('1')).reduce((s, i) => s + i.total, 0);
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
