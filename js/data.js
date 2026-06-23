const MENU = [
  ...Array(15).fill(null).map((_, i) => ({ id: `b${i}`, cat: 'Завтраки' })),
  ...Array(10).fill(null).map((_, i) => ({ id: `ha${i}`, cat: 'Холодные закуски' })),
  ...Array(10).fill(null).map((_, i) => ({ id: `ga${i}`, cat: 'Горячие закуски' })),
  ...Array(10).fill(null).map((_, i) => ({ id: `s${i}`, cat: 'Супы' })),
  ...Array(11).fill(null).map((_, i) => ({ id: `sl${i}`, cat: 'Салаты' })),
  ...Array(10).fill(null).map((_, i) => ({ id: `p${i}`, cat: 'Пицца' })),
  ...Array(10).fill(null).map((_, i) => ({ id: `pa${i}`, cat: 'Паста' })),
  ...Array(12).fill(null).map((_, i) => ({ id: `m${i}`, cat: 'Основные блюда' })),
  ...Array(10).fill(null).map((_, i) => ({ id: `g${i}`, cat: 'Гарниры' })),
  ...Array(8).fill(null).map((_, i) => ({ id: `br${i}`, cat: 'Бургеры' })),
  ...Array(10).fill(null).map((_, i) => ({ id: `r${i}`, cat: 'Роллы и суши' })),
  ...Array(12).fill(null).map((_, i) => ({ id: `d${i}`, cat: 'Десерты' })),
  ...Array(13).fill(null).map((_, i) => ({ id: `k${i}`, cat: 'Кофе и чай' })),
  ...Array(10).fill(null).map((_, i) => ({ id: `na${i}`, cat: 'Безалкогольные' })),
  ...Array(13).fill(null).map((_, i) => ({ id: `al${i}`, cat: 'Алкогольные' })),
  ...Array(12).fill(null).map((_, i) => ({ id: `hk${i}`, cat: 'Кальяны' })),
  ...Array(6).fill(null).map((_, i) => ({ id: `det${i}`, cat: 'Детское меню' })),
];

MENU.forEach((item, idx) => {
  item.uid = `item-${idx}`;
});
