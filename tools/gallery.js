// Render a batch of birds to samples/*.svg plus a samples/index.html contact sheet.
// usage: node tools/gallery.js [count=24] [prefix]
//        node tools/gallery.js --seeds "Seed one" "Seed two" ...
//        node tools/gallery.js --anim [count=8] [prefix]   (idle GIFs to samples/anim/)
const fs = require('fs');
const path = require('path');
const bd = require('../birddraw.js');

let args = process.argv.slice(2);
if (args[0] == '--anim'){
  anim_gallery(Number(args[1] || 8), args[2] || 'alive');
  return;
}
let seeds = [];
if (args[0] == '--seeds'){
  seeds = args.slice(1);
}else{
  let n = Number(args[0] || 24);
  let prefix = args[1] || 'bird';
  for (let i = 0; i < n; i++) seeds.push(bd.seed_name(prefix + i));
}

let out = path.join(__dirname, '..', 'samples');
fs.mkdirSync(out, {recursive: true});

let cells = [];
let sheet = [];
let cols = 4;
for (let i = 0; i < seeds.length; i++){
  let seed = seeds[i];
  let t0 = Date.now();
  let polylines = bd.main(seed);
  let ms = Date.now() - t0;
  let file = seed.replace(/[^A-Za-z0-9]+/g, '_') + '.svg';
  fs.writeFileSync(path.join(out, file), bd.draw_svg(polylines));
  let ox = (i % cols) * bd.FRAME_W, oy = Math.floor(i / cols) * bd.FRAME_H;
  sheet.push(`<g transform="translate(${ox},${oy})"><path d="${polylines.map(l => 'M' + l.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L')).join('')}"/></g>`);
  let n_pts = polylines.reduce((s, l) => s + l.length, 0);
  console.log(`${seed.padEnd(24)} ${String(ms).padStart(5)} ms  ${polylines.length} lines  ${n_pts} pts`);
  cells.push(`<figure><img src="${file}"><figcaption>${seed} (${ms} ms)</figcaption></figure>`);
}

let SW = cols * bd.FRAME_W, SH = Math.ceil(seeds.length / cols) * bd.FRAME_H;
fs.writeFileSync(path.join(out, 'sheet.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}"><rect width="${SW}" height="${SH}" fill="white"/>` +
  `<g fill="none" stroke="black" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round">${sheet.join('')}</g></svg>`);

fs.writeFileSync(path.join(out, 'index.html'), `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>birddraw gallery</title>
<style>
body{font-family:sans-serif;background:#eee;margin:20px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
figure{margin:0;background:#fff;padding:6px}
img{width:100%;display:block}
figcaption{font-size:11px;color:#666}
</style></head><body><main>
${cells.join('\n')}
</main></body></html>
`);

function anim_gallery(n, prefix){
  let out = path.join(__dirname, '..', 'samples', 'anim');
  fs.mkdirSync(out, {recursive: true});
  let cells = [];
  for (let i = 0; i < n; i++){
    let seed = bd.seed_name(prefix + i);
    let t0 = Date.now();
    let an = bd.animator(seed);
    let gif = bd.anim_gif(an, 15, 0.75);
    let file = seed.replace(/[^A-Za-z0-9]+/g, '_') + '.gif';
    fs.writeFileSync(path.join(out, file), gif);
    let tl = an.timeline;
    let desc = `${an.arg.archetype}; ${(an.ap.breath_f*60).toFixed(0)} breaths/min, ${tl.segs.length} head moves (${an.ap.style}), ${tl.blinks.length} blinks, tail ${an.ap.tail_style}`;
    console.log(`${seed.padEnd(24)} ${String(Date.now() - t0).padStart(6)} ms  ${(gif.length/1024).toFixed(0).padStart(5)} KB  ${desc}`);
    cells.push(`<figure><img src="${file}"><figcaption>${seed}<br>${desc}</figcaption></figure>`);
  }
  fs.writeFileSync(path.join(out, 'index.html'), `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>birddraw idle gallery</title>
<style>
body{font-family:sans-serif;background:#eee;margin:20px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
figure{margin:0;background:#fff;padding:6px}
img{width:100%;display:block}
figcaption{font-size:11px;color:#666}
</style></head><body><main>
${cells.join('\n')}
</main></body></html>
`);
}
