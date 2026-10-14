// Export an idle-animation loop as SVG/PNG frames, an animated GIF, a flipbook
// SVG, and a contact-sheet strip.
//
//   node tools/frames.js "Turdus merula" [--out dir] [--fps 12] [--duration 6]
//        [--intensity 0.7] [--scale 1] [--no-png] [--strip 8]
//
// Every SVG frame is an exact hidden-line drawing, so the frames can also be
// plotted as a flipbook. For MP4:
//   ffmpeg -framerate 12 -i out/frame_%04d.png -pix_fmt yuv420p out/anim.mp4
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const bd = require('../birddraw.js');

let args = process.argv.slice(2);
let seed = args[0] && !args[0].startsWith('--') ? args.shift() : bd.seed_name(String(Date.now()));
let opt = (name, def) => {
  let i = args.indexOf('--' + name);
  return i >= 0 ? args[i+1] : def;
};
let flag = name => args.includes('--' + name);
let fps = Number(opt('fps', 12));
let duration = Number(opt('duration', 6));
let intensity = Number(opt('intensity', 0.7));
let scale = Number(opt('scale', 1));
let strip = Number(opt('strip', 0));
let out = opt('out', path.join(__dirname, '..', 'samples', 'anim', seed.replace(/[^A-Za-z0-9]+/g, '_')));
fs.mkdirSync(out, {recursive: true});

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf){
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data){
  let len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  let td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// ink (0..1 coverage) -> RGB PNG on floralwhite paper
function png(ink, w, h){
  let raw = Buffer.alloc((w*3 + 1)*h);
  for (let y = 0; y < h; y++){
    raw[y*(w*3+1)] = 0;
    for (let x = 0; x < w; x++){
      let t = 1 - Math.min(1, ink[y*w+x]);
      let o = y*(w*3+1) + 1 + x*3;
      raw[o] = Math.round(255*t); raw[o+1] = Math.round(250*t); raw[o+2] = Math.round(240*t);
    }
  }
  let ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

let t0 = Date.now();
let an = bd.animator(seed, {duration, intensity});
let n = Math.max(1, Math.round(an.T*fps));
let frames = [], rasters = [];
for (let i = 0; i < n; i++){
  let f = an.frame(i*an.T/n);
  frames.push(f);
  let name = 'frame_' + String(i).padStart(4, '0');
  fs.writeFileSync(path.join(out, name + '.svg'), bd.draw_svg(f));
  let r = bd.raster(f, bd.FRAME_W, bd.FRAME_H, scale);
  rasters.push(r);
  if (!flag('no-png')) fs.writeFileSync(path.join(out, name + '.png'), png(r.ink, r.w, r.h));
}
fs.writeFileSync(path.join(out, 'flipbook.svg'), bd.draw_svg_flipbook(frames, an.T));
fs.writeFileSync(path.join(out, 'anim.gif'), Buffer.from(bd.gif_encode(rasters.map(r => r.ink), rasters[0].w, rasters[0].h, Math.round(100/fps))));

if (strip > 0){
  let w = rasters[0].w, h = rasters[0].h;
  let cols = Math.min(strip, 4), rows = Math.ceil(strip/cols);
  let ink = new Float32Array(w*cols*h*rows);
  for (let k = 0; k < strip; k++){
    let r = rasters[Math.floor(k*n/strip)];
    let ox = (k % cols)*w, oy = Math.floor(k/cols)*h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) ink[(oy+y)*w*cols + ox + x] = r.ink[y*w+x];
  }
  fs.writeFileSync(path.join(out, 'strip.png'), png(ink, w*cols, h*rows));
}

let p = an.ap, tl = an.timeline;
console.log(`${seed} [${an.arg.archetype}] ${n} frames in ${Date.now()-t0} ms -> ${out}`);
console.log(`  breathing ${tl.breaths} cycles/${an.T}s (${(p.breath_f*60).toFixed(0)}/min at ${p.mass.toFixed(0)} g), ` +
  `${tl.segs.length} head moves (${p.style}), ${tl.blinks.length} blinks, tail ${p.tail_style}`);
