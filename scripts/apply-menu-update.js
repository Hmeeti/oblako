/**
 * Apply drinks prices/descriptions from canonical menu-update.txt onto js/data.js.
 * Only touches matching drink items (ids k/na/al). Does not invent volumes from
 * sticky section headers (those caused false 0.3L / 50ml bleed). Explicit
 * inline volumes on a name line (e.g. "Coca-Cola 1L") are still applied.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const UPDATE_PATHS = [
  '/cursor/stores/bc-455e3969-e3a0-4308-a123-cdaeb9604ff3/internal/menu-update.txt',
  path.join(ROOT, 'menu-update.txt'),
];

function loadUpdate() {
  for (const p of UPDATE_PATHS) {
    if (fs.existsSync(p)) return { text: fs.readFileSync(p, 'utf8'), source: p };
  }
  throw new Error('menu-update.txt not found');
}

function normName(s) {
  return String(s)
    .toLowerCase()
    .replace(/parton/g, 'patron')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .trim();
}

function finalizeDesc(s) {
  if (!s) return null;
  let t = s.replace(/\s+/g, ' ').trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?…]$/.test(t)) t += '.';
  return t;
}

function parseUpdate(text) {
  const lines = text.split(/\n/);
  const parsed = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i++].trim();
    if (!line) continue;

    const priceMatch = line.match(/^(.+?)\s+(\d{3,6})\s*$/);
    if (!priceMatch) continue;

    let name = priceMatch[1].replace(/\s*-\s*$/, '').trim();
    let volume = null;
    const volOnName = name.match(/^(.*?)\s+(0[.,]\d+|1L)\s*$/i);
    if (volOnName) {
      name = volOnName[1].trim();
      const v = volOnName[2].replace(',', '.');
      if (/^1L$/i.test(v)) volume = '1 л';
      else if (v === '0.25') volume = '0,25 л';
      else if (v === '0.33') volume = '0,33 л';
      else if (v === '0.640' || v === '0.64') volume = '0,64 л';
      else volume = `${String(v).replace('.', ',')} л`;
    }

    const item = { name, price: Number(priceMatch[2]), desc: null, volume };
    if (i < lines.length && lines[i].trim().startsWith('(')) {
      let desc = lines[i++].trim().slice(1);
      while (!desc.includes(')') && i < lines.length) {
        desc += ' ' + lines[i++].trim();
      }
      item.desc = finalizeDesc(desc.replace(/\)$/, ''));
    }
    parsed.push(item);
  }
  return parsed;
}

/** Stable id map for known drink names → avoid dessert "Шоколад" collision */
const NAME_TO_ID = {
  'сенча': 'k0',
  'жасмин': 'k1',
  'ассам черный чай': 'k2',
  'молочный улун': 'k3',
  'ташкентский чай': 'k4',
  'марокканский чай': 'k5',
  'имбирный чай': 'k6',
  'облепиха-абрикос': 'k7',
  'ягодный чай': 'k8',
  'тропический твист': 'k9',
  'лимон': 'k10',
  'апельсин': 'k11',
  'лайм': 'k12',
  'молоко': 'k13',
  'мёд': 'k14',
  'шоколад': 'k15',
  'сироп в ассортименте': 'k16',
  'тропический лимонад': 'na0',
  'лесные ягоды': 'na1',
  'персик-ананас': 'na2',
  'киви-яблоко': 'na3',
  'тропический смузи': 'na4',
  'ягодный детокс': 'na5',
  'зеленый детокс': 'na6',
  'персик-манго': 'na7',
  'банан с ягодами': 'na8',
  'ананас-кокос': 'na9',
  'итальянский шоколад': 'na10',
  'tassay': 'na11',
  'redbull в ассортименте': 'na12',
  'borjomi': 'na13',
  'coca-cola / fanta / sprite': 'na14',
  'coca-cola': 'na15',
  'schweppes в ассортименте': 'na16',
  'piko в ассортименте': 'na17',
  'genry toro': 'na18',
  'mojito classic': 'na19',
  'kyoto': 'na20',
  'aperol spritz n/a': 'na21',
  'eclipse': 'al0',
  'hemingway': 'al1',
  'soft-tour': 'al2',
  'cosmopolitan-1985': 'al3',
  'v-vento': 'al4',
  'daiquiri': 'al5',
  'long island iced tea': 'al6',
  'white russian': 'al7',
  'aperol spritz': 'al8',
  'bellini': 'al9',
  'gin-tonic': 'al10',
  'negroni': 'al11',
  'porn star': 'al12',
  'whiskey sour': 'al13',
  'mojito alc': 'al14',
  'grey goose': 'al15',
  'belvedere organic': 'al16',
  'absolut original': 'al17',
  'absolut elyx': 'al18',
  'onegin': 'al19',
  'koskenkorva': 'al20',
  'stolichnaya': 'al21',
  'kyzylzhar': 'al22',
  'архангельская': 'al23',
  'martini fiero': 'al24',
  'martini bianco': 'al25',
  'four roses original': 'al26',
  "jack daniel's": 'al27',
  'bacardi carta blanca': 'al28',
  'bacardi carta negra': 'al29',
  'bacardi spiced': 'al30',
  'oakheart original': 'al31',
  'patron silver': 'al32',
  'patron reposado': 'al33',
  'olmeca silver': 'al34',
  'olmeca gold': 'al35',
  'olmeca altos 100% agave': 'al36',
  'bombay sapphire': 'al37',
  'jagermeister': 'al38',
  'aperol': 'al39',
  'cointreau': 'al40',
  'baileys': 'al41',
  'kahlua': 'al42',
  'campari': 'al43',
  'san valentin white белое сухое': 'al44',
  'san valentin red красное сухое': 'al45',
  'крафтовое красное полусладкое': 'al46',
  'крафтовое белое полусладкое': 'al47',
  'nuala pinot noir красное сухое': 'al48',
  'nuala sauvignon blanc белое сухое': 'al49',
  'silk spice road красное сухое': 'al50',
  'silk spice white blend': 'al51',
  'canti chardonnay белое полусладкое': 'al52',
  'canti merlot veneto': 'al53',
  'киндзмараули красное полусладкое': 'al54',
  'саперави красное сухое': 'al55',
  'цинандали белое сухое': 'al56',
  'хванчкара': 'al57',
  'martini prosecco d.o.c': 'al58',
  'martini asti d.o.c.g': 'al59',
  'martini brut': 'al60',
  "lambrusco dell'emilia igt": 'al61',
  'yichang': 'al62',
  'прага': 'al63',
  'corona extra': 'al64',
  'tsingtao': 'al65',
  'tsingtao 0%': 'al66',
  'stella artois': 'al67',
  'stella artois 0%': 'al68',
  'guinness draught': 'al69',
  'miller': 'al70',
  'чечил': 'al71',
  'курт': 'al72',
  'фисташки': 'al73',
  'арахис': 'al74',
  'чипсы': 'al75',
};

function resolveId(name) {
  const key = normName(name);
  if (NAME_TO_ID[key]) return NAME_TO_ID[key];
  // soft variants
  if (NAME_TO_ID[key.replace(/\s+/g, '')]) return NAME_TO_ID[key.replace(/\s+/g, '')];
  return null;
}

function patchDataJs(dataJs, updatesById) {
  let changed = 0;
  let out = dataJs;

  for (const [id, upd] of Object.entries(updatesById)) {
    const re = new RegExp(`(\\{[^{}]*\\bid:\\s*'${id}'[^{}]*\\})`);
    const m = out.match(re);
    if (!m) {
      console.warn('block not found for', id);
      continue;
    }
    let block = m[1];
    const before = block;

    // price
    if (upd.price != null) {
      if (/price:\s*\d+/.test(block)) {
        block = block.replace(/price:\s*\d+/, `price: ${upd.price}`);
      } else {
        block = block.replace(/(name:\s*'[^']*')/, `$1, price: ${upd.price}`);
      }
    }

    // desc
    if (upd.desc) {
      const esc = upd.desc.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      if (/desc:\s*'([^'\\]|\\.)*'/.test(block)) {
        block = block.replace(/desc:\s*'([^'\\]|\\.)*'/, `desc: '${esc}'`);
      } else {
        block = block.replace(/\s*\}\s*$/, `, desc: '${esc}' }`);
      }
    }

    // explicit volume only
    if (upd.volume) {
      const esc = upd.volume.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      if (/volume:\s*'([^'\\]|\\.)*'/.test(block)) {
        block = block.replace(/volume:\s*'([^'\\]|\\.)*'/, `volume: '${esc}'`);
      } else {
        block = block.replace(/\s*\}\s*$/, `, volume: '${esc}' }`);
      }
    }

    if (block !== before) {
      out = out.replace(before, block);
      changed++;
    }
  }
  return { out, changed };
}

function main() {
  const { text, source } = loadUpdate();
  const parsed = parseUpdate(text);
  const dataPath = path.join(ROOT, 'js', 'data.js');
  const dataJs = fs.readFileSync(dataPath, 'utf8');

  const updatesById = {};
  const unmatched = [];
  for (const p of parsed) {
    const id = resolveId(p.name);
    if (!id) {
      unmatched.push(p.name);
      continue;
    }
    updatesById[id] = {
      price: p.price,
      desc: p.desc || undefined,
      volume: p.volume || undefined,
    };
  }

  const { out, changed } = patchDataJs(dataJs, updatesById);
  fs.writeFileSync(dataPath, out, 'utf8');

  // Also mirror into menu-list.txt drink description/price columns when present
  const listPath = path.join(ROOT, 'menu-list.txt');
  if (fs.existsSync(listPath)) {
    const listLines = fs.readFileSync(listPath, 'utf8').split(/\n/);
    const next = listLines.map((line) => {
      const parts = line.split('\t');
      if (parts.length < 3) return line;
      const id = parts[0];
      const upd = updatesById[id];
      if (!upd) return line;
      // format: id \t cat \t name \t [desc]
      while (parts.length < 4) parts.push('');
      if (upd.desc) parts[3] = upd.desc.replace(/\.$/, '');
      return parts.join('\t').replace(/\t+$/, '');
    });
    fs.writeFileSync(listPath, next.join('\n'), 'utf8');
  }

  console.log(`Source: ${source}`);
  console.log(`Parsed: ${parsed.length}, matched: ${Object.keys(updatesById).length}, unmatched: ${unmatched.length}`);
  if (unmatched.length) console.log('Unmatched:', unmatched);
  console.log(`data.js blocks changed: ${changed}`);
}

main();
