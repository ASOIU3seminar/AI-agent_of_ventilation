// Расчет чистой высоты этажа по СП 60.13330 (прямой ввод из проекта/чертежа или по разности отметок)
export function calcNetHeight(floor) {
  if (!floor) return 3.3;
  // Если чистая высота задана напрямую (из чертежа PDF или введена пользователем)
  if (floor.height !== undefined && floor.height !== null && Number(floor.height) > 0) {
    return +Number(floor.height).toFixed(3);
  }
  const top = Number(floor.elevationTop) || 0;
  const bottom = Number(floor.elevationBottom) || 0;
  const delta = Math.abs(top - bottom);
  return +Math.max(2.0, delta > 0 ? delta : 3.3).toFixed(3);
}
