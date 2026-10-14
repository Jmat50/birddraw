// Derive archetype proportion centres from AVONET morphometrics.
//
// AVONET (Tobias et al. 2022, Ecology Letters, CC BY 4.0) ships per-species
// trait tables; export the "AVONET1_BirdLife" sheet to CSV and run:
//
//   node tools/build_tables.js AVONET1_BirdLife.csv > tools/archetype_tables.json
//
// The output gives, for each archetype, scale factors relative to the finch
// archetype plus direct values where AVONET measures the same quantity the
// generator uses (Kipp's distance / wing length == the `kipp` parameter).
// The hand-tuned centres in birddraw.js were seeded from these ratios; the
// JSON can be pasted back over ARCHETYPES[*].n to refresh them.

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
  return rows.filter(r => r.length == head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const FAMILIES = {
  finch: ['Fringillidae'],
  sparrow: ['Passerellidae', 'Passeridae', 'Emberizidae'],
  warbler: ['Parulidae', 'Phylloscopidae', 'Sylviidae', 'Acrocephalidae'],
  thrush: ['Turdidae'],
  corvid: ['Corvidae'],
  raptor: ['Accipitridae', 'Falconidae'],
  parrot: ['Psittacidae', 'Psittaculidae', 'Cacatuidae'],
  kingfisher: ['Alcedinidae'],
  owl: ['Strigidae', 'Tytonidae'],
  swallow: ['Hirundinidae'],
  wader: ['Scolopacidae', 'Charadriidae'],
};

function col(r, ...names){
  for (let n of names){
    if (r[n] !== undefined && r[n] !== '' && r[n] !== 'NA') return Number(r[n]);
  }
  return NaN;
}

function median(a){
  a = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return NaN;
  let m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m-1] + a[m]) / 2;
}

function main(){
  let file = process.argv[2];
  if (!file){
    console.error('usage: node tools/build_tables.js AVONET1_BirdLife.csv');
    process.exit(1);
  }
  let rows = parse_csv(fs.readFileSync(file, 'utf8'));
  let stats = {};
  for (let arch in FAMILIES){
    let fams = new Set(FAMILIES[arch]);
    let sp = rows.filter(r => fams.has(r.Family1 || r.Family || r.family));
    let ratios = sp.map(r => {
      let mass = col(r, 'Mass', 'Mass.g');
      let size = Math.cbrt(mass);
      let culmen = col(r, 'Beak.Length_Culmen');
      let depth = col(r, 'Beak.Depth');
      let wing = col(r, 'Wing.Length');
      let kipps = col(r, "Kipps.Distance", 'Kipp.s.Distance');
      return {
        beak_len: culmen / size,
        beak_depth: depth / culmen,
        tarsus_ratio: col(r, 'Tarsus.Length') / size,
        wing_ratio: wing / size,
        tail_ratio: col(r, 'Tail.Length') / size,
        kipp: kipps / wing,
      };
    });
    let s = {species: sp.length};
    for (let k of ['beak_len', 'beak_depth', 'tarsus_ratio', 'wing_ratio', 'tail_ratio', 'kipp']){
      s[k] = median(ratios.map(x => x[k]));
    }
    stats[arch] = s;
  }

  let ref = stats.finch;
  let out = {};
  for (let arch in stats){
    let s = stats[arch];
    out[arch] = {
      species: s.species,
      relative_to_finch: {
        beak_len: +(s.beak_len / ref.beak_len).toFixed(3),
        beak_depth: +(s.beak_depth / ref.beak_depth).toFixed(3),
        tarsus_ratio: +(s.tarsus_ratio / ref.tarsus_ratio).toFixed(3),
        wing_ratio: +(s.wing_ratio / ref.wing_ratio).toFixed(3),
        tail_ratio: +(s.tail_ratio / ref.tail_ratio).toFixed(3),
      },
      kipp: +s.kipp.toFixed(3),
    };
  }
  console.log(JSON.stringify(out, null, 2));
}

main();
