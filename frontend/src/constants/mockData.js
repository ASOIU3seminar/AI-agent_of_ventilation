// Генератор реалистичных тестовых комнат этажа по категориям СП
export function generateDemoRoomsForFloor(floor) {
  const code = floor?.code || '1';
  const isBasement = String(code).includes('-') || (floor?.elevationBottom || 0) < 0;

  if (isBasement) {
    return [
      { roomId: 'dm-1', number: '-02.C0.101', rawName: 'Подземная автостоянка (Машиноместа)', area: 860.5, fireCategory: 'В2' },
      { roomId: 'dm-2', number: '-02.C0.102', rawName: 'Рампа въезда-выезда автостоянки', area: 145.0, fireCategory: 'В2' },
      { roomId: 'dm-3', number: '-02.C0.103', rawName: 'ИТП (Индивидуальный тепловой пункт)', area: 68.4, fireCategory: 'Д' },
      { roomId: 'dm-4', number: '-02.C0.104', rawName: 'Насосная станция пожаротушения и АУГПТ', area: 54.2, fireCategory: 'Д' },
      { roomId: 'dm-5', number: '-02.C0.105', rawName: 'Главный распределительный щит (ГРЩ)', area: 42.0, fireCategory: 'В4' },
      { roomId: 'dm-6', number: '-02.C0.106', rawName: 'Венткамера приточных систем П1, П2', area: 58.0, fireCategory: 'Д' },
      { roomId: 'dm-7', number: '-02.C0.107', rawName: 'Венткамера вытяжных систем В1, В2', area: 48.5, fireCategory: 'Д' },
      { roomId: 'dm-8', number: '-02.C0.108', rawName: 'Санузел персонала автостоянки', area: 6.8, fireCategory: '-' },
      { roomId: 'dm-9', number: '-02.C0.109', rawName: 'Помещение уборочного инвентаря (ПУИ)', area: 5.4, fireCategory: '-' },
      { roomId: 'dm-10', number: '-02.C0.110', rawName: 'Тамбур-шлюз с подпором воздуха при пожаре', area: 12.0, fireCategory: '-' },
      { roomId: 'dm-11', number: '-02.C0.111', rawName: 'Лифтовый холл подземного этажа', area: 24.5, fireCategory: '-' },
      { roomId: 'dm-12', number: '-02.C0.112', rawName: 'Кладовая сезонного инвентаря', area: 34.0, fireCategory: 'В3' }
    ];
  }

  return [
    { roomId: 'dm-1', number: `${code}.01`, rawName: 'Главный вестибюль и зона ресепшн', area: 128.5, fireCategory: '-' },
    { roomId: 'dm-2', number: `${code}.02`, rawName: 'Офис открытого типа (Open Space)', area: 340.0, fireCategory: '-' },
    { roomId: 'dm-3', number: `${code}.03`, rawName: 'Кабинет руководителя с переговорной', area: 45.2, fireCategory: '-' },
    { roomId: 'dm-4', number: `${code}.04`, rawName: 'Переговорная комната на 12 человек', area: 32.0, fireCategory: '-' },
    { roomId: 'dm-5', number: `${code}.05`, rawName: 'Серверная комната и ИБП', area: 24.0, fireCategory: 'В4' },
    { roomId: 'dm-6', number: `${code}.06`, rawName: 'Санузел мужской на 3 прибора', area: 14.5, fireCategory: '-' },
    { roomId: 'dm-7', number: `${code}.07`, rawName: 'Санузел женский на 3 прибора', area: 14.5, fireCategory: '-' },
    { roomId: 'dm-8', number: `${code}.08`, rawName: 'Помещение уборочного инвентаря (ПУИ)', area: 4.8, fireCategory: '-' },
    { roomId: 'dm-9', number: `${code}.09`, rawName: 'Венткамера этажная (П1 / В1)', area: 36.0, fireCategory: 'Д' },
    { roomId: 'dm-10', number: `${code}.10`, rawName: 'Коридор распределительный и холл', area: 85.0, fireCategory: '-' },
    { roomId: 'dm-11', number: `${code}.11`, rawName: 'Тамбур главного входа с тепловой завесой', area: 18.0, fireCategory: '-' },
    { roomId: 'dm-12', number: `${code}.12`, rawName: 'Кухня-столовая для сотрудников', area: 28.5, fireCategory: '-' }
  ];
}
