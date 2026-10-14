// Build binomen syllable tables (with frequencies) from a list of real bird
// scientific names, e.g. the AviList checklist (CC BY 4.0) exported to CSV.
//
//   node tools/build_names.js AviList.csv [top=60] > tools/syllables.json
//
// Any CSV with a "Scientific_name" (or "scientific_name"/"Species") column of
// "Genus epithet" binomials works. Paste the output arrays over
// BIRD_SYLLABLES / BIRD_SYLLABLE_FREQ in birddraw.js.
// Only letters A-Z are kept, because put_text only has Hershey glyphs for them.

const fs = require('fs');

function parse_csv(text){
  let rows = [], row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++){
    let c = text[i];
    if (q){
      if (c == '"'){
        if (text[i+1] == '"'){ cell += '"'; i++; }
        else q = false;
      }else cell += c;
    }else if (c == '"') q = true;
    else if (c == ','){ row.push(cell); cell = ''; }
    else if (c == '\n' || c == '\r'){
      if (c == '\r' && text[i+1] == '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    }else cell += c;
  }
  if (cell.length || row.length){ row.push(cell); rows.push(row); }
  let head = rows.shift().map(h => h.trim());
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

// Onset + vowel nucleus + (coda if word-final or followed by another consonant).
const SYL = /[^AEIOUY]*[AEIOUY]+(?:[^AEIOUY]+$|[^AEIOUY](?=[^AEIOUY]))?/g;

function syllables(word){
  word = word.toUpperCase().replace(/[^A-Z]/g, '');
  return word.match(SYL) || [];
}

function tally(map, k){
  map.set(k, (map.get(k) || 0) + 1);
}

function top(map, n){
  let e = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return [e.map(x => x[0]), e.map(x => x[1])];
}

function main(){
  let file = process.argv[2];
  let n = Number(process.argv[3] || 60);
  if (!file){
    console.error('usage: node tools/build_names.js names.csv [top]');
    process.exit(1);
  }
  let rows = parse_csv(fs.readFileSync(file, 'utf8'));
  let tables = [0, 1, 2, 3, 4, 5].map(() => new Map());
  let count = 0;
  let seen = new Set();
  for (let r of rows){
    let name = (r.Scientific_name || r.scientific_name || r.Species || r.species || '').trim();
    let rank = (r.Taxon_rank || r.rank || 'species').toLowerCase();
    if (rank != 'species') continue;
    let parts = name.split(/\s+/);
    if (parts.length < 2 || seen.has(name)) continue;
    seen.add(name);
    count++;
    for (let w = 0; w < 2; w++){
      let s = syllables(parts[w]);
      if (s.length < 2) continue;
      tally(tables[w*3], s[0]);
      for (let i = 1; i < s.length - 1; i++) tally(tables[w*3+1], s[i]);
      tally(tables[w*3+2], s[s.length-1]);
    }
  }
  let syl = [], freq = [];
  for (let t of tables){
    let [k, f] = top(t, n);
    syl.push(k);
    freq.push(f);
  }
  console.error(`${count} species`);
  console.log(JSON.stringify({BIRD_SYLLABLES: syl, BIRD_SYLLABLE_FREQ: freq}));
}

main();
