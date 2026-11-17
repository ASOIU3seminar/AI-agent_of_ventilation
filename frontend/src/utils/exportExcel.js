// Экспорт ведомости ХОВС и сметы ОВиК в CSV / Excel по ГОСТ 21.602 / СП 60.13330
export function exportHovsToExcel({ activeFloor, currentNetHeight, rooms, estimate, fileName }) {
  let csv = '\uFEFFРАЗДЕЛ 1: ТАБЛИЦА ЭКСПЛИКАЦИИ, НОРМ СП И ФОРМУЛ РАСЧЕТА ВОЗДУХООБМЕНА (ХОВС ПО ГОСТ 21.602)\n';
  csv += `Активный этаж:;${activeFloor.name};Отметка уровня:;${activeFloor.elevationBottom ?? '-'} м;Чистая высота Δh:;${currentNetHeight} м\n\n`;
  csv += '№ Пом.;Наименование помещения;Категория СП;Площадь S (м2);Высота Δh (м);Объем V (м3);Нормативный документ (СП / ГОСТ);Методика расчета;Формула расчета воздухообмена;Приток Lпр (м3/ч);Вытяжка Lвыт (м3/ч);Дисбаланс ΔL;Система;Источник разметки\n';

  rooms.forEach(r => {
    const s = String(r.area).replace('.', ',');
    const h = String(r.height).replace('.', ',');
    const v = String(r.volume).replace('.', ',');
    const norm = r.normCode || 'СП 60.13330.2020';
    const method = r.calculationMethod || r.method || 'По кратности';
    const formula = r.calculationFormula || `Lпр = ${r.requiredSupplyAir} м3/ч; Lвыт = ${r.requiredExhaustAir} м3/ч`;
    const src = r.detectionSource || 'Экспликация PDF';

    csv += `"${r.number}";"${r.rawName}";"${r.normalizedType}";"${s}";"${h}";"${v}";"${norm}";"${method}";"${formula}";${r.requiredSupplyAir};${r.requiredExhaustAir};${r.balance};"${r.systemTag}";"${src}"\n`;
  });

  // Строка ИТОГО
  const totalS = rooms.reduce((acc, r) => acc + (r.area || 0), 0).toFixed(2).replace('.', ',');
  const totalV = rooms.reduce((acc, r) => acc + (r.volume || 0), 0).toFixed(2).replace('.', ',');
  const totalLpr = rooms.reduce((acc, r) => acc + (r.requiredSupplyAir || 0), 0);
  const totalLext = rooms.reduce((acc, r) => acc + (r.requiredExhaustAir || 0), 0);
  const totalBal = totalLpr - totalLext;

  csv += `"ИТОГО ПО ЭТАЖУ";"Все помещения этажа";"";"${totalS}";"${String(currentNetHeight).replace('.', ',')}";"${totalV}";"";"";"";${totalLpr};${totalLext};${totalBal};"";""\n`;

  if (estimate && estimate.systems && estimate.systems.length > 0) {
    csv += `\nРАЗДЕЛ 2: СПЕЦИФИКАЦИЯ СИСТЕМ ВЕНТИЛЯЦИИ (П и В)\n`;
    csv += 'Код системы;Назначение;Помещений;Расчетный расход L (+10%), м3/ч;Сечение магистрали F1 (м2);Площадь стали воздуховодов (м2);Толщина стали\n';
    estimate.systems.forEach(s => {
      csv += `"${s.code}";"${s.type}";${s.count};${s.flow};"${String(s.fMain).replace('.', ',')}";"${String(s.ductArea).replace('.', ',')}";"${s.metal}"\n`;
    });
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Ведомость_ХОВС_СП60_${fileName ? fileName.replace('.pdf', '') : 'ГОСТ21.602'}.csv`;
  a.click();
}
