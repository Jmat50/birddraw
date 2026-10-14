// Static drawings must stay byte-identical across refactors.
// node test/static_golden.js           -> verify against test/golden.json
// node test/static_golden.js --record  -> rewrite test/golden.json
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bd = require('../birddraw.js');

const N = 30;
const file = path.join(__dirname, 'golden.json');
let hashes = {};
for (let i = 0; i < N; i++){
  let seed = bd.seed_name('golden' + i);
  hashes[seed] = crypto.createHash('sha1').update(bd.draw_svg(bd.main(seed))).digest('hex');
}

if (process.argv.includes('--record')){
  fs.writeFileSync(file, JSON.stringify(hashes, null, 2) + '\n');
  console.log(`recorded ${N} golden hashes`);
}else{
  let want = JSON.parse(fs.readFileSync(file, 'utf8'));
  let bad = Object.keys(want).filter(k => want[k] !== hashes[k]);
  if (bad.length){
    console.error(`static output changed for ${bad.length} seeds: ${bad.slice(0, 5).join(', ')}`);
    process.exit(1);
  }
  console.log(`ok: ${N} static drawings byte-identical to golden`);
}
