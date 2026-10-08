const fs = require('fs');

const FOOD_KEYWORDS = {
  салат: ['салат', 'salad', 'боул', 'bowl', 'цезарь', 'caesar', 'рукола', 'айсберг'],
  суп: ['суп', 'soup', 'рамen', 'ramen', 'том ям', 'tom yam', 'лапша', 'бульон'],
  пицца: ['pizza', 'пицца', 'pepperoni', 'маргарита', 'margherita'],
  паста: ['pasta', 'паста', 'фетучини', 'fettuccine', 'спагетти', 'spaghetti', 'болоньезе'],
  стейк: ['steak', 'стейк', 'рибай', 'ribeye', 'тибон', 't-bone', 'strip', 'медальон'],
  рыба: ['fish', 'рыба', 'семга', 'salmon', 'форель', 'trout', 'дорадо', 'dorado'],
  креветки: ['shrimp', 'кревет', 'prawn'],
  картофель: ['fries', 'фри', 'potato', 'картоф', 'пюре'],
  курица: ['chicken', 'куриц', 'крыл', 'wing', 'nugget', 'нагет'],
  десерт: ['dessert', 'dessert', 'cake', 'торт', 'чизкейк', 'cheesecake', 'тирамису', 'tiramisu', 'вафл', 'waffle'],
  напиток: ['cocktail', 'коктейл', 'wine', 'вино', 'beer', 'пиво', 'tea', 'чай', 'lemonade', 'лимонад', 'smoothie', 'смузи'],
  закуска: ['appetizer', 'закуск', 'cheese', 'сыр', 'кольца', 'ring', 'garlic', 'чеснок'],
};

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalize(text).split(' ').filter(Boolean);
}

function scoreItemAgainstTags(item, tags, filename) {
  const corpus = normalize([
    item.name,
    item.description,
    item.subcat,
    item.category_name,
    filename,
    ...(tags || []),
  ].filter(Boolean).join(' '));

  let score = 0;
  const nameNorm = normalize(item.name);
  const nameParts = tokenize(item.name).filter(p => p.length >= 4);

  nameParts.forEach(part => {
    if (corpus.includes(part)) score += 3;
  });

  if (normalize(filename).includes(nameNorm.slice(0, 8))) score += 5;

  const descTokens = tokenize(item.description || '').filter(t => t.length >= 5);
  descTokens.slice(0, 6).forEach(token => {
    if (corpus.includes(token)) score += 1;
  });

  return score;
}

function pickBestMatch(items, tags, filename, excludeIds = new Set()) {
  const pool = items.filter(i => !excludeIds.has(i.id));
  let best = null;
  let bestScore = 0;

  pool.forEach(item => {
    const score = scoreItemAgainstTags(item, tags, filename);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  });

  const confidence = Math.min(0.95, bestScore / 15);
  return { item: best, confidence, score: bestScore };
}

function pickForUnmatched(itemsWithoutImages, usedIds) {
  return itemsWithoutImages.find(i => !usedIds.has(i.id)) || null;
}

module.exports = { normalize, pickBestMatch, pickForUnmatched, FOOD_KEYWORDS };
