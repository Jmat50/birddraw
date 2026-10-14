/*
 * birddraw.js - procedurally generated bird drawings.
 * Adapted from fishdraw (https://github.com/LingDong-/fishdraw).
 *
 * Portions of this file are copied verbatim from fishdraw:
 *
 * MIT License
 * Copyright (c) 2021 Lingdong Huang
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// ===== vendored from fishdraw.js L2-779: PRNG, Perlin noise, geometry kernel, shading primitives, resample, Douglas-Peucker, Poisson disk =====
let jsr = 0x5EED;
let {PI} = Math;
function rand(){
  jsr^=(jsr<<17);
  jsr^=(jsr>>13);
  jsr^=(jsr<<5);
  return (jsr>>>0)/4294967295;
}

var PERLIN_YWRAPB = 4; var PERLIN_YWRAP = 1<<PERLIN_YWRAPB;
var PERLIN_ZWRAPB = 8; var PERLIN_ZWRAP = 1<<PERLIN_ZWRAPB;
var PERLIN_SIZE = 4095;
var perlin_octaves = 4;var perlin_amp_falloff = 0.5;
var scaled_cosine = function(i) {return 0.5*(1.0-Math.cos(i*PI));};
var perlin;
let noise = function(x,y,z) {
  y = y || 0; z = z || 0;
  if (perlin == null) {
    perlin = new Array(PERLIN_SIZE + 1);
    for (var i = 0; i < PERLIN_SIZE + 1; i++) {
      perlin[i] = rand();
    }
  }
  if (x<0) { x=-x; } if (y<0) { y=-y; } if (z<0) { z=-z; }
  var xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
  var xf = x - xi; var yf = y - yi; var zf = z - zi;
  var rxf, ryf;
  var r=0; var ampl=0.5;
  var n1,n2,n3;
  for (var o=0; o<perlin_octaves; o++) {
    var of=xi+(yi<<PERLIN_YWRAPB)+(zi<<PERLIN_ZWRAPB);
    rxf = scaled_cosine(xf); ryf = scaled_cosine(yf);
    n1  = perlin[of&PERLIN_SIZE];
    n1 += rxf*(perlin[(of+1)&PERLIN_SIZE]-n1);
    n2  = perlin[(of+PERLIN_YWRAP)&PERLIN_SIZE];
    n2 += rxf*(perlin[(of+PERLIN_YWRAP+1)&PERLIN_SIZE]-n2);
    n1 += ryf*(n2-n1);
    of += PERLIN_ZWRAP;
    n2  = perlin[of&PERLIN_SIZE];
    n2 += rxf*(perlin[(of+1)&PERLIN_SIZE]-n2);
    n3  = perlin[(of+PERLIN_YWRAP)&PERLIN_SIZE];
    n3 += rxf*(perlin[(of+PERLIN_YWRAP+1)&PERLIN_SIZE]-n3);
    n2 += ryf*(n3-n2);
    n1 += scaled_cosine(zf)*(n2-n1);
    r += n1*ampl;
    ampl *= perlin_amp_falloff;
    xi<<=1; xf*=2; yi<<=1; yf*=2; zi<<=1; zf*=2;
    if (xf>=1.0) { xi++; xf--; }
    if (yf>=1.0) { yi++; yf--; }
    if (zf>=1.0) { zi++; zf--; }
  }
  return r;
};

function dist(x0,y0,x1,y1){
  return Math.hypot(x1-x0,y1-y0);
}
function lerp(a,b,t){
  return a * (1-t) + b * t;
}
function lerp2d(x0,y0,x1,y1,t){
  return [
    x0*(1-t) + x1*t,
    y0*(1-t) + y1*t,
  ]
}
function get_bbox(points){
  let xmin = Infinity;
  let ymin = Infinity;
  let xmax = -Infinity;
  let ymax = -Infinity
  for (let i = 0;i < points.length; i++){
    let [x,y] = points[i];
    xmin = Math.min(xmin,x);
    ymin = Math.min(ymin,y);
    xmax = Math.max(xmax,x);
    ymax = Math.max(ymax,y);
  }
  return {x:xmin,y:ymin,w:xmax-xmin,h:ymax-ymin};
}

function seg_isect(p0x, p0y, p1x, p1y, q0x, q0y, q1x, q1y, is_ray = false) {
  let d0x = p1x - p0x;
  let d0y = p1y - p0y;
  let d1x = q1x - q0x;
  let d1y = q1y - q0y;
  let vc = d0x * d1y - d0y * d1x;
  if (vc == 0) {
    return null;
  }
  let vcn = vc * vc;
  let q0x_p0x = q0x - p0x;
  let q0y_p0y = q0y - p0y;
  let vc_vcn = vc / vcn;
  let t = (q0x_p0x * d1y - q0y_p0y * d1x) * vc_vcn;
  let s = (q0x_p0x * d0y - q0y_p0y * d0x) * vc_vcn;
  if (0 <= t && (is_ray || t < 1) && 0 <= s && s < 1) {
    let ret = {t, s, side: null, other: null, xy: null};
    ret.xy = [p1x * t + p0x * (1 - t), p1y * t + p0y * (1 - t)];
    ret.side = pt_in_pl(p0x, p0y, p1x, p1y, q0x, q0y) < 0 ? 1 : -1;
    return ret;
  }
  return null;
}
function pt_in_pl(x, y, x0, y0, x1, y1) {
  let dx = x1 - x0;
  let dy = y1 - y0;
  let e = (x - x0) * dy - (y - y0) * dx;
  return e;
}

function poly_bridge(poly0,poly1){
  let dmin = Infinity;
  let imin = null;
  for (let i = 0; i < poly0.length; i++){
    for (let j = 0; j < poly1.length; j++){
      let [x0,y0] = poly0[i];
      let [x1,y1] = poly1[j];
      let dx = x0-x1;
      let dy = y0-y1;
      let d2 = dx*dx + dy*dy;
      if (d2 < dmin){
        dmin = d2;
        imin = [i,j];
      }
    }
  }
  let u = poly0.slice(0,imin[0]).concat(
    poly1.slice(imin[1])).concat(
      poly1.slice(0,imin[1])).concat(
        poly0.slice(imin[0]));
  return u;
}

function poly_union(poly0,poly1,self_isect=false){
  let verts0 = poly0.map(xy=>({xy, isects: [], isects_map: {}}));
  let verts1 = poly1.map(xy=>({xy, isects: [], isects_map: {}}));

  function pair_key() {
    return Array.from(arguments).join(',');
  }

  let has_isect = false;

  function build_vertices(poly,other,out,oout,idx){
    let n = poly.length;
    let m = other.length;
    if (self_isect){
      for (let i = 0; i < n; i++) {
        let id = pair_key(idx,i);
        let p = out[i];
        let i1 = (i + 1 + n) % n;
        let a = poly[i];
        let b = poly[i1];
        for (let j = 0; j < n; j++) {
          let jd = pair_key(idx,j);
          let j1 = (j + 1 + n) % n;
          if (i == j || i == j1 || i1 == j || i1 == j1) {
            continue;
          }
          let c = poly[j];
          let d = poly[j1];
          let xx;
          let ox = out[j].isects_map[id];
          if (ox) {
            xx = {
              t: ox.s,
              s: ox.t,
              xy: ox.xy,
              other: null,
              side: pt_in_pl(...a, ...b, ...c) < 0 ? 1 : -1
            };
          }else{
            xx = seg_isect(...a, ...b, ...c, ...d);
          }
          if (xx) {
            xx.other = j;
            xx.jump = false;
            p.isects.push(xx);
            p.isects_map[jd] = xx;
          }
        }
        
      }
    }

    for (let i = 0; i < n; i++) {
      let id = pair_key(idx,i);
      let p = out[i];
      let i1 = (i + 1 + n) % n;
      let a = poly[i];
      let b = poly[i1];
      for (let j = 0; j < m; j++) {
        let jd = pair_key(1-idx,j);
        let j1 = (j + 1 + m) % m;
        let c = other[j];
        let d = other[j1];
        let xx;

        let ox = oout[j].isects_map[id];
        if (ox) {
          xx = {
            t: ox.s,
            s: ox.t,
            xy: ox.xy,
            other: null,
            side: pt_in_pl(...a, ...b, ...c) < 0 ? 1 : -1
          };
        } else {
          xx = seg_isect(...a, ...b, ...c, ...d);
        }
        if (xx) {
          has_isect = true;
          xx.other = j;
          xx.jump = true;
          p.isects.push(xx);
          p.isects_map[jd] = xx;
        }
      }
      p.isects.sort((a2, b2) => a2.t - b2.t);
    }
  }
  build_vertices(poly0,poly1,verts0,verts1,0);
  build_vertices(poly1,poly0,verts1,verts0,1);
  
  if (!has_isect){
    if (!self_isect){
      return poly_bridge(poly0,poly1);
    }else{
      return poly_union(poly_bridge(poly0,poly1),[],true);
    }
  }


  let isect_mir = {};
  function mirror_isects(verts0,verts1,idx) {
    let n = verts0.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < verts0[i].isects.length; j++) {
        let id = pair_key(idx, i, j);
        let {jump} = verts0[i].isects[j];
        let jd = jump?(1-idx):idx;
        let k = verts0[i].isects[j].other;
        let z = (jump?verts1:verts0)[k].isects.findIndex((x) => (x.jump == jump && x.other == i));
        isect_mir[id] = [jd, k, z];
      }
    }
  }
  mirror_isects(verts0,verts1,0);
  mirror_isects(verts1,verts0,1);

  // console.log(verts0,verts1)

  function trace_outline(idx, i0, j0, dir) {
    let zero = null;
    let out = [];
    function trace_from(idx, i0, j0, dir) {
      if (zero == null) {
        zero = [idx, i0, j0];
      } else if (idx == zero[0] && i0 == zero[1] && j0 == zero[2]) {
        return true;
      }
      let verts = idx?verts1:verts0;
      let n = verts.length;
      let p = verts[i0];
      let i1 = (i0 + dir + n) % n;
      if (j0 == -1) {
        out.push(p.xy);
        if (dir < 0) {
          return trace_from(idx,i1, verts[i1].isects.length - 1, dir);
        } else if (!verts[i0].isects.length) {
          return trace_from(idx, i1, -1, dir, [i0, j0]);
        } else {
          return trace_from(idx, i0, 0, dir, [i0, j0]);
        }
      } else if (j0 >= p.isects.length) {
        return trace_from(idx, i1, -1, dir, [i0, j0]);
      } else {
        let id = pair_key(idx, i0, j0);
        out.push(p.isects[j0].xy);

        let q = p.isects[j0];
        let [jdx, k, z] = isect_mir[id];
        let params;
        if (q.side * dir < 0) {
          params = [jdx, k, z - 1, -1];
        } else {
          params = [jdx, k, z + 1, 1];
        }
        return trace_from(...params);
      }
    }
    let success = trace_from(idx, i0, j0, dir);
    if (!success || out.length < 3) {
      return null;
    }
    return out;
  }

  let xmin = Infinity;
  let amin = null;
  for (let i = 0; i < poly0.length; i++) {
    if (poly0[i][0] < xmin) {
      xmin = poly0[i][0];
      amin = [0,i];
    }
  }
  for (let i = 0; i < poly1.length; i++) {
    if (poly1[i][0] < xmin) {
      xmin = poly1[i][0];
      amin = [1,i];
    }
  }

  function check_concavity(poly, idx) {
    let n = poly.length;
    let a = poly[(idx - 1 + n) % n];
    let b = poly[idx];
    let c = poly[(idx + 1) % n];
    let cw = pt_in_pl(...a, ...b, ...c) < 0 ? 1 : -1;
    return cw;
  }

  let cw = check_concavity(amin[0]?poly1:poly0, amin[1]);
  let ret = trace_outline(...amin, -1, cw, true);
  if (!ret) {
    return [];
  }
  return ret;
}

function seg_isect_poly(x0,y0,x1,y1,poly,is_ray=false){
  let n = poly.length;
  let isects = [];
  for (let i = 0; i < poly.length; i++){
    let a = poly[i];
    let b = poly[(i+1)%n];
    let xx = seg_isect(x0,y0,x1,y1,...a,...b,is_ray);
    if (xx){
      isects.push(xx);
    }
  }
  isects.sort((a,b)=>a.t-b.t);
  return isects;
}


function clip(polyline,polygon){
  if (!polyline.length){
    return {true:[],false:[]};
  }
  let zero = seg_isect_poly(...polyline[0],polyline[0][0]+Math.E,polyline[0][1]+PI,polygon,true).length % 2 != 0;
  let out = {
    'true' :[[]],
    'false':[[]],
  }
  let io = zero;
  for (let i = 0; i < polyline.length; i++){
    let a= polyline[i];
    let b= polyline[i+1];
    out[io][out[io].length-1].push(a);
    if (!b) break;

    let isects = seg_isect_poly(...a,...b,polygon,false);
    for (let j = 0; j < isects.length; j++){
      out[io][out[io].length-1].push(isects[j].xy);
      io = !io;
      out[io].push([isects[j].xy]);
    }
  }
  out.true = out.true.filter(x=>x.length);
  out.false = out.false.filter(x=>x.length);
  return out;
}

function clip_multi(polylines,polygon,clipper_func=clip){
  let out = {
    true:[],
    false:[],
  };
  for (let i = 0; i < polylines.length; i++){
    let c = clipper_func(polylines[i],polygon);
    out.true.push(...c.true);
    out.false.push(...c.false); 
  }
  return out;
}

function binclip(polyline,func){
  if (!polyline.length){
    return {true:[],false:[]};
  }
  let bins = [];
  for (let i = 0; i < polyline.length; i++){
    let t = i/(polyline.length-1);
    bins.push(func(...polyline[i],t));
  }
  let zero = bins[0];
  let out = {
    'true' :[[]],
    'false':[[]],
  }
  let io = zero;
  for (let i = 0; i < polyline.length; i++){
    let a= polyline[i];
    let b= polyline[i+1];
    out[io][out[io].length-1].push(a);
    if (!b) break;

    let do_isect = bins[i] != bins[i+1];

    if (do_isect){
      let pt = lerp2d(...a,...b,0.5);
      out[io][out[io].length-1].push(pt);
      io = !io;
      out[io].push([pt]);
    }
  }
  out.true = out.true.filter(x=>x.length);
  out.false = out.false.filter(x=>x.length);
  return out;
}


function shade_shape(poly,step=5,dx=10,dy=20){
  let bbox = get_bbox(poly);
  bbox.x -= step;
  bbox.y -= step;
  bbox.w += step*2;
  bbox.h += step*2;
  let lines = [];
  for (let i = -bbox.h; i < bbox.w; i+=step){
    let x0 = bbox.x + i;
    let y0 = bbox.y;
    let x1 = bbox.x + i + bbox.h;
    let y1 = bbox.y + bbox.h;
    lines.push([[x0,y0],[x1,y1]]);
  }
  lines = clip_multi(lines,poly).true;

  let carve = trsl_poly(poly,-dx,-dy);

  lines = clip_multi(lines,carve).false;

  for (let i = 0; i < lines.length; i++){
    let [a,b] = lines[i];
    let s = rand()*0.5;
    if (dy > 0){
      a = lerp2d(...a,...b,s);
      lines[i][0] = a;
    }else{
      b = lerp2d(...b,...a,s);
      lines[i][1] = b;
    }
  }

  return lines;
}


function fill_shape(poly,step=5){
  let bbox = get_bbox(poly);
  bbox.x -= step;
  bbox.y -= step;
  bbox.w += step*2;
  bbox.h += step*2;
  let lines = [];
  for (let i = 0; i < bbox.w+bbox.h/2; i+=step){
    let x0 = bbox.x + i;
    let y0 = bbox.y;
    let x1 = bbox.x + i - bbox.h/2;
    let y1 = bbox.y + bbox.h;
    lines.push([[x0,y0],[x1,y1]]);
  }
  lines = clip_multi(lines,poly).true;
  return lines;
}

function patternshade_shape(poly,step=5,pattern_func){
  let bbox = get_bbox(poly);
  bbox.x -= step;
  bbox.y -= step;
  bbox.w += step*2;
  bbox.h += step*2;
  let lines = [];
  for (let i = -bbox.h/2; i < bbox.w; i+=step){
    let x0 = bbox.x + i;
    let y0 = bbox.y;
    let x1 = bbox.x + i + bbox.h/2;
    let y1 = bbox.y + bbox.h;
    lines.push([[x0,y0],[x1,y1]]);
  }
  lines = clip_multi(lines,poly).true;

  for (let i = 0; i < lines.length; i++){
    lines[i] = resample(lines[i],2);
  }

  lines = clip_multi(lines,pattern_func,binclip).true;

  return lines;
}


function vein_shape(poly,n=50){
  let bbox = get_bbox(poly);
  let out = [];
  for (let i = 0; i < n; i++){
    let x = bbox.x + rand()*bbox.w;
    let y = bbox.y + rand()*bbox.h;
    let o = [[x,y]];
    for (let j = 0; j < 15; j++){
      let dx = (noise(x*0.1,y*0.1,7)-0.5)*4;
      let dy = (noise(x*0.1,y*0.1,6)-0.5)*4;
      x += dx;
      y += dy;
      o.push([x,y]);
    }
    out.push(o);
  }
  out = clip_multi(out,poly).true;
  return out;
}

function smalldot_shape(poly,scale=1){
  let samples = [];
  let bbox = get_bbox(poly);
  poissondisk(bbox.w,bbox.h,5*scale,samples);
  for (let i = 0; i < samples.length; i++){
    samples[i][0] += bbox.x;
    samples[i][1] += bbox.y;
  }
  let out = [];
  let n = 7;
  for (let i = 0; i < samples.length; i++){
    let [x,y] =samples[i]
    let t = (y > 0) ? (y/300) : 0.5;
    // console.log(y,t);
    if ((t > 0.4 || y < 0) && t > rand()){
      continue;
    }
    for (let k = 0; k < 2; k++){
      let o = [];
      for (let j = 0; j < n; j++){
        let t = j/(n-1);
        let a = t * PI * 2;
        o.push([
          Math.cos(a)*1-k*0.3,
          Math.sin(a)*0.5-k*0.3,
        ])
      }
      o = trsl_poly(rot_poly(o,rand()*PI*2),x,y);
      out.push(o);
    }
    
  }
  return clip_multi(out,poly).true;
}

function isect_circ_line(cx,cy,r,x0,y0,x1,y1){
  //https://stackoverflow.com/a/1084899
  let dx = x1-x0;
  let dy = y1-y0;
  let fx = x0-cx;
  let fy = y0-cy;
  let a = dx*dx+dy*dy;
  let b = 2*(fx*dx+fy*dy);
  let c = (fx*fx+fy*fy)-r*r;
  let discriminant = b*b-4*a*c;
  if (discriminant<0){
    return null;
  }
  discriminant = Math.sqrt(discriminant);
  let t0 = (-b - discriminant)/(2*a);
  if (0 <= t0 && t0 <= 1){
    return t0;
  }
  let t = (-b + discriminant)/(2*a);
  if (t > 1 || t < 0){
    return null;
  }
  return t;
}

function resample(polyline,step){
  if (polyline.length < 2){
    return polyline.slice();
  }
  polyline = polyline.slice();
  let out = [polyline[0].slice()];
  let next = null;
  let i = 0;
  while(i < polyline.length-1){
    let a = polyline[i];
    let b = polyline[i+1];
    let dx = b[0]-a[0];
    let dy = b[1]-a[1];
    let d = Math.sqrt(dx*dx+dy*dy);
    if (d == 0){
      i++;
      continue;
    }
    let n = ~~(d/step);
    let rest = (n*step)/d;
    let rpx = a[0] * (1-rest) + b[0] * rest;
    let rpy = a[1] * (1-rest) + b[1] * rest;
    for (let j = 1; j <= n; j++){
      let t = j/n;
      let x = a[0]*(1-t) + rpx*t;
      let y = a[1]*(1-t) + rpy*t;
      let xy = [x,y];
      for (let k = 2; k < a.length; k++){
        xy.push(a[k]*(1-t) + (a[k] * (1-rest) + b[k] * rest)*t);
      }
      out.push(xy);
    }

    next = null;
    for (let j = i+2; j < polyline.length; j++){
      let b = polyline[j-1];
      let c = polyline[j];
      if (b[0] == c[0] && b[1] == c[1]){
        continue;
      }
      let t = isect_circ_line(rpx,rpy,step,b[0],b[1],c[0],c[1]);
      if (t == null){
        continue;
      }
 
      let q = [
        b[0]*(1-t)+c[0]*t,
        b[1]*(1-t)+c[1]*t,
      ];
      for (let k = 2; k < b.length; k++){
        q.push(b[k]*(1-t)+c[k]*t);
      }
      out.push(q);
      polyline[j-1] = q;
      next = j-1;
      break;
    }
    if (next == null){
      break;
    }
    i = next;

  }

  if (out.length > 1){
    let lx = out[out.length-1][0];
    let ly = out[out.length-1][1];
    let mx = polyline[polyline.length-1][0];
    let my = polyline[polyline.length-1][1];
    let d = Math.sqrt((mx-lx)**2+(my-ly)**2);
    if (d < step*0.5){
      out.pop(); 
    }
  }
  out.push(polyline[polyline.length-1].slice());
  return out;
}


function pt_seg_dist(p, p0, p1)  {
  // https://stackoverflow.com/a/6853926
  let x = p[0];   let y = p[1];
  let x1 = p0[0]; let y1 = p0[1];
  let x2 = p1[0]; let y2 = p1[1];
  let A = x - x1; let B = y - y1; let C = x2 - x1; let D = y2 - y1;
  let dot = A*C+B*D;
  let len_sq = C*C+D*D;
  let param = -1;
  if (len_sq != 0) {
    param = dot / len_sq;
  }
  let xx; let yy;
  if (param < 0) {
    xx = x1; yy = y1;
  }else if (param > 1) {
    xx = x2; yy = y2;
  }else {
    xx = x1 + param*C;
    yy = y1 + param*D;
  }
  let dx = x - xx;
  let dy = y - yy;
  return Math.sqrt(dx*dx+dy*dy);
}

function approx_poly_dp(polyline, epsilon){
  if (polyline.length <= 2){
    return polyline;
  }
  let dmax   = 0;
  let argmax = -1;
  for (let i = 1; i < polyline.length-1; i++){
    let d = pt_seg_dist(polyline[i] , 
                        polyline[0] , 
                        polyline[polyline.length-1] );
    if (d > dmax){
      dmax = d;
      argmax = i;
    }  
  }
  let ret = [];
  if (dmax > epsilon){
    let L = approx_poly_dp(polyline.slice(0,argmax+1),epsilon);
    let R = approx_poly_dp(polyline.slice(argmax,polyline.length),epsilon);
    ret = ret.concat(L.slice(0,L.length-1)).concat(R);
  }else{
    ret.push(polyline[0].slice());
    ret.push(polyline[polyline.length-1].slice());
  }
  return ret;
}

function distsq(x0, y0, x1, y1) {
  let dx = x0-x1;
  let dy = y0-y1;
  return dx*dx+dy*dy;
}
function poissondisk(W, H, r, samples) {
  let grid = [];
  let active = [];
  let w =  ((r) / (1.4142135624));
  let r2 = ((r) * (r));
  let cols = (~~(((W) / (w))));
  let rows = (~~(((H) / (w))));
  for (let i = (0); Number((i) < (((cols) * (rows)))); i += (1)) {
    (grid).splice((grid.length), 0, (-1));
  };
  let pos = [(((W) / (2.0))), (((H) / (2.0)))];
  (samples).splice((samples.length), 0, (pos));
  for (let i = (0); Number((i) < (samples.length)); i += (1)) {
    let col = (~~(((((((samples)[i]))[0])) / (w))));
    let row = (~~(((((((samples)[i]))[1])) / (w))));
    ((grid)[((col) + (((row) * (cols))))] = i);
    (active).splice((active.length), 0, (((samples)[i])));
  };
  while (active.length) {
    let ridx = (~~(((rand()) * (active.length))));
    pos = ((active)[ridx]);
    let found = 0;
    for (let n = (0); Number((n) < (30)); n += (1)) {
      let sr = ((r) + (((rand()) * (r))));
      let sa = ((6.2831853072) * (rand()));
      let sx = ((((pos)[0])) + (((sr) * (Math.cos(sa)))));
      let sy = ((((pos)[1])) + (((sr) * (Math.sin(sa)))));
      let col = (~~(((sx) / (w))));
      let row = (~~(((sy) / (w))));
      if (((((((((Number((col) > (0))) && (Number((row) > (0))))) && (Number((col) < (((cols) - (1))))))) && (Number((row) < (((rows) - (1))))))) && (Number((((grid)[((col) + (((row) * (cols))))])) == (-1))))) {
        let ok = 1;
        for (let i = (-1); Number((i) <= (1)); i += (1)) {
          for (let j = (-1); Number((j) <= (1)); j += (1)) {
            let idx = ((((((((row) + (i))) * (cols))) + (col))) + (j));
            let nbr = ((grid)[idx]);
            if (Number((-1) != (nbr))) {
              let d = distsq(sx, sy, ((((samples)[nbr]))[0]), ((((samples)[nbr]))[1]));
              if (Number((d) < (r2))) {
                ok = 0;
              };
            };
          };
        };
        if (ok) {
          found = 1;
          ((grid)[((((row) * (cols))) + (col))] = samples.length);
          let sample = [(sx), (sy)];
          (active).splice((active.length), 0, (sample));
          (samples).splice((samples.length), 0, (sample));
        };
      };
    };
    if (Number(!(found))) {
      (active).splice((ridx), (1));
    };
  };
}

// ===== vendored from fishdraw.js L881-946: pow, gauss2d, squama (scale) primitives, affine helpers =====
function pow(a,b){
  return Math.sign(a) * Math.pow(Math.abs(a),b);
}

function gauss2d(x, y){
  let z0 = Math.exp(-0.5*x*x);
  let z1 = Math.exp(-0.5*y*y);
  return z0*z1;
 }

function squama_mask(w,h){
  let p = [];
  let n = 7;
  for (let i = 0; i < n; i++){
    let t = i/n;
    let a = t * PI * 2;
    let x = -pow(Math.cos(a),1.3)*w;
    let y =  pow(Math.sin(a),1.3)*h;
    p.push([x,y]);
  }
  return p;
}

function squama(w,h,m=3) {
  let p = [];
  let n = 8;
  for (let i = 0; i < n; i++){
    let t = i/(n-1);
    let a = t * PI + PI/2;
    let x = -pow(Math.cos(a),1.4)*w;
    let y =  pow(Math.sin(a),1.4)*h;
    p.push([x,y]);
  }
  let q = [p];
  for (let i = 0; i < m; i++){
    let t = i/(m-1);
    q.push([
      [-w*0.3 + (rand()-0.5),-h*0.2+t*h*0.4 + (rand()-0.5)],
      [ w*0.5 + (rand()-0.5),-h*0.3+t*h*0.6 + (rand()-0.5)]
    ]);
  }
  return q;
}

function trsl_poly(poly,x,y){
  return poly.map(xy=>[xy[0]+x,xy[1]+y]);
}
function scl_poly(poly,sx,sy){
  if (sy === undefined) sy = sx;
  return poly.map(xy=>[xy[0]*sx,xy[1]*sy]);
}
function shr_poly(poly,sx){
  return poly.map(xy=>[xy[0]+xy[1]*sx,xy[1]]);
}
function rot_poly(poly,th){
  let qoly = [];
  let costh = Math.cos(th);
  let sinth = Math.sin(th);
  for (let i = 0; i < poly.length; i++){
    let [x0,y0] = poly[i]
    let x = x0* costh-y0*sinth;
    let y = x0* sinth+y0*costh;
    qoly.push([x,y]);
  }
  return qoly;
}

// ===== vendored from fishdraw.js L1045-1069: pattern_dot =====
function pattern_dot(scale=1){
  let samples = [];
  poissondisk(500,300,20*scale,samples);
  let rs = [];
  for (let i = 0; i < samples.length; i++){
    rs.push((rand()*5+10)*scale)
  }
  return function(x,y){
    for (let i = 0; i < samples.length; i++){
      let r = rs[i];
      if (dist(x,y,...samples[i])<r){

        let [x0,y0] = samples[i];
        let dx = x - x0;
        let dy = y - y0;
        if (gauss2d(dx/r*2,dy/r*2)*noise(x,y,999) > 0.2){
          return true;
        }
      }
    }
    return false;
  }
}



// ===== vendored from fishdraw.js L1254-1320: fin_a (fan of soft rays along a curve) =====
function fin_a(curve,ang0,ang1,func,clip_root=false,curvature0=0,curvature1=0,softness=10){
  let angs = [];
  for (let i = 0; i < curve.length; i++){
    
    if (i == 0){
      angs.push( Math.atan2(curve[i+1][1]-curve[i][1], curve[i+1][0]-curve[i][0]) - PI/2 );
    }else if (i == curve.length-1){
      angs.push( Math.atan2(curve[i][1]-curve[i-1][1], curve[i][0]-curve[i-1][0]) - PI/2 );
    }else{
      let a0 = Math.atan2(curve[i-1][1]-curve[i][1], curve[i-1][0]-curve[i][0]);
      let a1 = Math.atan2(curve[i+1][1]-curve[i][1], curve[i+1][0]-curve[i][0]);
      while (a1 > a0){
        a1 -= PI*2;
      }
      a1 += PI*2;
      let a = (a0+a1)/2;
      angs.push(a);
    }
  }
  let out0 = [];
  let out1 = [];
  let out2 = [];
  let out3 = [];
  for (let i = 0; i < curve.length; i++){
    let t = i/(curve.length-1);
    let aa = lerp(ang0,ang1,t);
    let a = angs[i]+aa;
    let w = func(t);

    let [x0,y0] = curve[i];
    let x1 = x0 + Math.cos(a)*w;
    let y1 = y0 + Math.sin(a)*w;
    
    let p = resample([[x0,y0],[x1,y1]],3);
    for (let j = 0; j < p.length; j++){
      let s = j/(p.length-1);
      let ss = Math.sqrt(s);
      let [x,y] = p[j];
      let cv = lerp(curvature0,curvature1,t)*Math.sin(s*PI);
      p[j][0] += noise(x*0.1,y*0.1,3)*ss*softness + Math.cos(a-PI/2)*cv;
      p[j][1] += noise(x*0.1,y*0.1,4)*ss*softness + Math.sin(a-PI/2)*cv;
    }
    if (i == 0){
      out2 = p;
    }else if (i == curve.length-1){
      out3 = p.slice().reverse();
    }else{
      out0.push(p[p.length-1]);
      // if (i % 2){
        let q = p.slice(clip_root?(   ~~(rand()*4)  ):0,Math.max(2,~~(p.length*(rand()*0.5+0.5))));
        if (q.length){
          out1.push(q);
        }
      // }
    }
  }
  out0 = resample(out0,3);
  for (let i = 0; i < out0.length; i++){
    let [x,y] = out0[i];
    out0[i][0] += (noise(x*0.1,y*0.1)*6-3)*(softness/10);
    out0[i][1] += (noise(x*0.1,y*0.1)*6-3)*(softness/10);
  }
  let o = out2.concat(out0).concat(out3);
  out1.unshift(o);
  return [o.concat(curve.slice().reverse()),out1];
}


// ===== vendored from fishdraw.js L1602-1737: fish_eye_a, fish_eye_b, barbel =====
function fish_eye_a(ex,ey,rad){
  let n = 20;
  let eye0 = [];
  let eye1 = [];
  let eye2 = [];
  for (let i = 0; i < n; i++){
    let t = i/(n-1);
    let a = t * PI*2 + Math.PI/4*3;
    eye0.push([
      ex + Math.cos(a)*rad,
      ey + Math.sin(a)*rad
    ]);
    if (t > 0.5){
      eye1.push([
        ex + Math.cos(a)*(rad*0.8),
        ey + Math.sin(a)*(rad*0.8)
      ]);
    }
    eye2.push([
      ex + Math.cos(a)*(rad*0.4) -0.75,
      ey + Math.sin(a)*(rad*0.4) -0.75
    ]);
  }

  let ef = shade_shape(eye2,2.7,10,10);
  return [eye0,[eye0,eye1,eye2,...ef]];
}

function fish_eye_b(ex,ey,rad){
  let n = 20;
  let eye0 = [];
  let eye1 = [];
  let eye2 = [];
  for (let i = 0; i < n; i++){
    let t = i/(n-1);
    let a = t * PI*2+Math.E;
    eye0.push([
      ex + Math.cos(a)*rad,
      ey + Math.sin(a)*rad
    ]);
    eye2.push([
      ex + Math.cos(a)*(rad*0.4),
      ey + Math.sin(a)*(rad*0.4)
    ]);
  }
  let m =~~((rad*0.6)/2);
  for (let i = 0; i < m; i++){
    let r = rad - i * 2;
    let e = [];
    for (let i = 0; i < n; i++){
      let t = i/(n-1);
      let a = lerp(PI*7/8,PI*13/8,t)
      e.push([
        ex + Math.cos(a)*r,
        ey + Math.sin(a)*r
      ]);
    
    }
    eye1.push(e);
  }
  let trig = [
    [ex+Math.cos(-PI*3/4)*(rad*0.9),ey+Math.sin(-PI*3/4)*(rad*0.9)],
    [ex+1,ey+1],
    [ex+Math.cos(-PI*11/12)*(rad*0.9),ey+Math.sin(-PI*11/12)*(rad*0.9)],
  ];
  trig = resample(trig,3);
  for (let i = 0; i < trig.length; i++){
    let [x,y] = trig[i];
    x += noise(x*0.1,y*0.1,22)*4-2;
    y += noise(x*0.1,y*0.1,33)*4-2;
    trig[i] = [x,y];
  }
  

  let ef = fill_shape(eye2,1.5);

  ef = clip_multi(ef,trig).false;
  eye1 = clip_multi(eye1,trig).false;
  eye2 = clip(eye2,trig).false;

  return [eye0,[eye0,...eye1,...eye2,...ef]];
}


function barbel(x,y,n,ang,dd=3){
  let curve = [[x,y]];
  let sd = rand()*PI*2;
  let ar = 1;
  for (let i = 0; i < n; i++){
    x += Math.cos(ang)*dd;
    y += Math.sin(ang)*dd;
    ang += (noise(i*0.1,sd)-0.5)*ar;
    if (i < n/2){
      ar *= 1.02;
    }else{
      ar *= 0.92;
    }
    curve.push([x,y]);
  }
  let o0 = [];
  let o1 = [];
  for (let i = 0; i < n-1; i++){
    let t = i/(n-1);
    let w = 1.5*(1-t);

    let a = curve[i-1];
    let b = curve[i];
    let c = curve[i+1];

    let a1 = Math.atan2(c[1]-b[1],c[0]-b[0]);
    let a2;

    if (a){
      let a0 = Math.atan2(a[1]-b[1],a[0]-b[0]);
      
      a1 -= PI*2;
      while (a1 < a0){
        a1 += PI*2;
      }
      a2 = (a0+a1)/2;
    }else{
      a2 = a1-PI/2;
    }

    o0.push([
      b[0]+Math.cos(a2)*w,
      b[1]+Math.sin(a2)*w
    ])
    o1.push([
      b[0]+Math.cos(a2+PI)*w,
      b[1]+Math.sin(a2+PI)*w
    ])
  }
  o0.push(curve[curve.length-1]);
  return o0.concat(o1.slice().reverse());
}

// ===== vendored from fishdraw.js L1896-1902: bean, deviate =====
function bean(x){
  return Math.pow(0.25-Math.pow(x-0.5,2),0.5)*(2.6+2.4*Math.pow(x,1.5))*0.542;
}

function deviate(n){
  return rand()*2*n-n;
}

// ===== vendored from fishdraw.js L2281-2312: choice, rndtri =====
function choice(opts,percs){
  if (!percs){
    percs = opts.map(x=>1);
  }
  let s = 0;
  for (let i = 0; i < percs.length; i++){
    s += percs[i];
  }
  let r = rand()*s;
  s = 0;
  for (let i = 0; i < percs.length; i++){
    s += percs[i];
    if (r <= s){
      return opts[i];
    }
  }
}

function rndtri(a,b,c){
  let s0 = (b-a)/2;
  let s1 = (c-b)/2;
  let s = s0 + s1;
  let r = rand()*s;
  if (r < s0){
    //d * d/(b-a) / 2 = r;
    let d = Math.sqrt(2*r*(b-a));
    return a + d;
  }
  //d * d/(c-b) / 2 = s-r;
  let d = Math.sqrt(2*(s-r)*(c-b));
  return c-d;
}

// ===== vendored from fishdraw.js L2430-2563: Hershey font, put_text, str_to_seed =====
let hershey_raw = {
"501":"  9I[RFJ[ RRFZ[ RMTWT",
"502":" 24G\\KFK[ RKFTFWGXHYJYLXNWOTP RKPTPWQXRYTYWXYWZT[K[",
"503":" 19H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZV",
"504":" 16G\\KFK[ RKFRFUGWIXKYNYSXVWXUZR[K[",
"505":" 12H[LFL[ RLFYF RLPTP RL[Y[",
"506":"  9HZLFL[ RLFYF RLPTP",
"507":" 23H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZVZS RUSZS",
"508":"  9G]KFK[ RYFY[ RKPYP",
"509":"  3NVRFR[",
"510":" 11JZVFVVUYTZR[P[NZMYLVLT",
"511":"  9G\\KFK[ RYFKT RPOY[",
"512":"  6HYLFL[ RL[X[",
"513":" 12F^JFJ[ RJFR[ RZFR[ RZFZ[",
"514":"  9G]KFK[ RKFY[ RYFY[",
"515":" 22G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF",
"516":" 14G\\KFK[ RKFTFWGXHYJYMXOWPTQKQ",
"517":" 25G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF RSWY]",
"518":" 17G\\KFK[ RKFTFWGXHYJYLXNWOTPKP RRPY[",
"519":" 21H\\YIWGTFPFMGKIKKLMMNOOUQWRXSYUYXWZT[P[MZKX",
"520":"  6JZRFR[ RKFYF",
"521":" 11G]KFKULXNZQ[S[VZXXYUYF",
"522":"  6I[JFR[ RZFR[",
"523":" 12F^HFM[ RRFM[ RRFW[ R\\FW[",
"524":"  6H\\KFY[ RYFK[",
"525":"  7I[JFRPR[ RZFRP",
"526":"  9H\\YFK[ RKFYF RK[Y[",
"601":" 18I\\XMX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"602":" 18H[LFL[ RLPNNPMSMUNWPXSXUWXUZS[P[NZLX",
"603":" 15I[XPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"604":" 18I\\XFX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"605":" 18I[LSXSXQWOVNTMQMONMPLSLUMXOZQ[T[VZXX",
"606":"  9MYWFUFSGRJR[ ROMVM",
"607":" 23I\\XMX]W`VaTbQbOa RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"608":" 11I\\MFM[ RMQPNRMUMWNXQX[",
"609":"  9NVQFRGSFREQF RRMR[",
"610":" 12MWRFSGTFSERF RSMS^RaPbNb",
"611":"  9IZMFM[ RWMMW RQSX[",
"612":"  3NVRFR[",
"613":" 19CaGMG[ RGQJNLMOMQNRQR[ RRQUNWMZM\\N]Q][",
"614":" 11I\\MMM[ RMQPNRMUMWNXQX[",
"615":" 18I\\QMONMPLSLUMXOZQ[T[VZXXYUYSXPVNTMQM",
"616":" 18H[LMLb RLPNNPMSMUNWPXSXUWXUZS[P[NZLX",
"617":" 18I\\XMXb RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
"618":"  9KXOMO[ ROSPPRNTMWM",
"619":" 18J[XPWNTMQMNNMPNRPSUTWUXWXXWZT[Q[NZMX",
"620":"  9MYRFRWSZU[W[ ROMVM",
"621":" 11I\\MMMWNZP[S[UZXW RXMX[",
"622":"  6JZLMR[ RXMR[",
"623":" 12G]JMN[ RRMN[ RRMV[ RZMV[",
"624":"  6J[MMX[ RXMM[",
"625":" 10JZLMR[ RXMR[P_NaLbKb",
"626":"  9J[XMM[ RMMXM RM[X[",
"710":"  6MWRYQZR[SZRY",
};

let hershey_cache = {};

function compile_hershey(i){
  if (hershey_cache[i]){
    return hershey_cache[i];
  }
  var entry = hershey_raw[i];
  if (entry == null){
    return;
  }
  var ordR = 82;
  var bound= entry.substring(3,5);
  var xmin = bound.charCodeAt(0)-ordR;
  var xmax = bound.charCodeAt(1)-ordR;
  var content = entry.substring(5);
  var polylines = [[]];
  var j  = 0;
  while (j < content.length){
    var digit = content.substring(j,j+2);
    if (digit == " R"){
      polylines.push([]);
    }else{
      var x  = digit.charCodeAt(0)-ordR;
      var y  = digit.charCodeAt(1)-ordR;
      polylines[polylines.length-1].push([x,y]);
    }
    j+=2;
  }
  let data = {
    xmin:xmin,
    xmax:xmax,
    polylines:polylines,
  };
  hershey_cache[i] = data;
  return data;
}

function put_text(txt){
  let base = 500;
  let x = 0;
  let o = [];
  for (let i = 0; i < txt.length; i++){
    let ord = txt.charCodeAt(i);
    let idx;
    if (65 <= ord && ord <= 90){
      idx = base+1+(ord-65);
    }else if (97 <= ord && ord <= 122){
      idx = base + 101+(ord-97);
    }else if (ord == 46){
      idx = 710;
    }else if (ord == 32){
      x += 10;
      continue;
    }else{
      continue;
    }
    let {xmin,xmax,polylines} = compile_hershey(idx);
    polylines = polylines.map(p=>trsl_poly(p,x-xmin,0));
    o.push(...polylines);
    x += (xmax-xmin);
  }
  return [x,o];
}

function str_to_seed(str){
  let n = 1;
  for (let i = 0; i < str.length; i++){
    let x = str.charCodeAt(i)+1;
    n ^= x << (7+(i%5));
    // if (i % 2){
      n ^=(n<<17);
      n ^=(n>>13);
      n ^=(n<<5);
    // }
    n = (n>>>0) % 4294967295;
  }
  return n;
}

// ===== birddraw =====
let FRAME_W = 460;
let FRAME_H = 420;

function clamp(x,a,b){
  return x < a ? a : (x > b ? b : x);
}
function smoothstep(e0,e1,x){
  let t = clamp((x-e0)/(e1-e0),0,1);
  return t*t*(3-2*t);
}
function rot_pt(p,th,cx=0,cy=0){
  let c = Math.cos(th), s = Math.sin(th);
  let x = p[0]-cx, y = p[1]-cy;
  return [cx + x*c - y*s, cy + x*s + y*c];
}
function pt_in_poly(x,y,poly){
  let inside = false;
  for (let i = 0, j = poly.length-1; i < poly.length; j = i++){
    let [xi,yi] = poly[i];
    let [xj,yj] = poly[j];
    if (((yi > y) != (yj > y)) && (x < (xj-xi)*(y-yi)/(yj-yi) + xi)){
      inside = !inside;
    }
  }
  return inside;
}
function bbox_overlap(a,b){
  return !(a.x > b.x+b.w || b.x > a.x+a.w || a.y > b.y+b.h || b.y > a.y+a.h);
}
function ellipse_poly(cx,cy,rx,ry,n=24,a0=0){
  let o = [];
  for (let i = 0; i < n; i++){
    let a = a0 + i/n*PI*2;
    o.push([cx+Math.cos(a)*rx, cy+Math.sin(a)*ry]);
  }
  return o;
}
function closed(poly){
  return poly.concat([poly[0].slice()]);
}
function curve_normals(curve){
  let ns = [];
  for (let i = 0; i < curve.length; i++){
    let a = curve[Math.max(0,i-1)];
    let b = curve[Math.min(curve.length-1,i+1)];
    let tx = b[0]-a[0], ty = b[1]-a[1];
    let l = Math.hypot(tx,ty) || 1;
    ns.push([-ty/l, tx/l]);
  }
  return ns;
}
function tube(curve,w0,w1){
  let ns = curve_normals(curve);
  let l = [], r = [];
  for (let i = 0; i < curve.length; i++){
    let t = i/Math.max(1,curve.length-1);
    let w = lerp(w0,w1,t);
    l.push([curve[i][0]+ns[i][0]*w, curve[i][1]+ns[i][1]*w]);
    r.push([curve[i][0]-ns[i][0]*w, curve[i][1]-ns[i][1]*w]);
  }
  return l.concat(r.reverse());
}
function smooth_path(pts,step=1.5,iter=2){
  let p = resample(pts,step);
  for (let k = 0; k < iter; k++){
    let q = [p[0]];
    for (let i = 1; i < p.length-1; i++){
      q.push([(p[i-1][0]+p[i][0]*2+p[i+1][0])/4,(p[i-1][1]+p[i][1]*2+p[i+1][1])/4]);
    }
    q.push(p[p.length-1]);
    p = q;
  }
  return p;
}
function map_lines(lines,f){
  return lines.map(l=>l.map(f));
}

// Hidden-line removal without a growing union: a point is visible iff it lies
// outside every mask, so clipping by each overlapping mask in turn is
// equivalent to clipping by their union.
function Occluder(){
  this.items = [];
}
Occluder.prototype.add = function(poly){
  if (!poly || poly.length < 3) return;
  this.items.push({poly, bb:get_bbox(poly)});
};
Occluder.prototype.clip = function(lines){
  let out = [];
  for (let k = 0; k < lines.length; k++){
    let l = lines[k];
    if (!l || l.length < 2) continue;
    let cur = [l];
    let bb = get_bbox(l);
    for (let i = 0; i < this.items.length && cur.length; i++){
      let it = this.items[i];
      if (!bbox_overlap(bb,it.bb)) continue;
      let next = [];
      for (let j = 0; j < cur.length; j++){
        if (!bbox_overlap(get_bbox(cur[j]),it.bb)){
          next.push(cur[j]);
        }else{
          next.push(...clip(cur[j],it.poly).false);
        }
      }
      cur = next;
    }
    out.push(...cur.filter(x=>x.length>1));
  }
  return out;
};

function part(lines,masks){
  return {lines:lines||[], masks:masks||[]};
}
function map_part(p,f){
  return {lines:map_lines(p.lines,f), masks:map_lines(p.masks,f)};
}
function compose(parts){
  let occ = new Occluder();
  let out = [];
  for (let i = 0; i < parts.length; i++){
    out.push(...occ.clip(parts[i].lines));
    for (let j = 0; j < parts[i].masks.length; j++){
      occ.add(parts[i].masks[j]);
    }
  }
  return out;
}

// ===== body (body frame: origin at body centre, +x toward the tail) =====

function body_curves(arg,BL,BH){
  let n = 32;
  let c0 = [];
  let c1 = [];
  for (let i = 0; i < n; i++){
    let t = i/(n-1);
    let x = (t-0.5)*BL;
    let s = Math.sin(PI*(0.05+0.9*t));
    let top = BH*Math.pow(s,0.7)*(1-0.42*t)*lerp(0.9,1.08,noise(t*2,11));
    let bot = BH*Math.pow(s,0.55)*(1-0.3*t)*(1+0.14*arg.belly*Math.sin(PI*t))*lerp(0.92,1.06,noise(t*2,12));
    c0.push([x,-top]);
    c1.push([x,bot]);
  }
  let outline = c0.concat(c1.slice().reverse());
  return {c0,c1,outline};
}

function contour_feather(w,h,pointy,extra){
  let arc = [];
  let n = 9;
  for (let i = 0; i < n; i++){
    let a = i/(n-1)*PI+PI/2;
    arc.push([-pow(Math.cos(a),pointy)*w, pow(Math.sin(a),1.1)*h]);
  }
  let mask = [];
  let m = 12;
  for (let i = 0; i < m; i++){
    let a = i/m*PI*2;
    let c = Math.cos(a);
    mask.push([c > 0 ? pow(c,pointy)*w : c*w*0.75, pow(Math.sin(a),1.1)*h]);
  }
  let lines = [arc];
  if (extra == 'streak'){
    lines.push([[-w*0.15,-h*0.12],[w*0.55,0]],[[-w*0.15,h*0.12],[w*0.55,0]],[[-w*0.2,0],[w*0.6,0]]);
  }else if (extra == 'scallop'){
    lines.push(arc.map(([x,y])=>[x*0.7-w*0.12,y*0.72]));
  }else if (extra == 'rachis'){
    lines.push([[-w*0.3,0],[w*0.7,h*0.05]]);
  }
  return {arc,mask,lines};
}

// squama_mesh adapted for feathers: variable feather size, staggered columns,
// rows drifted toward the tail away from the midline (chevron rows), and
// neighbour-only occlusion through an Occluder instead of a growing union.
function plumage_mesh(outline,o){
  let bb = get_bbox(outline);
  let occ = new Occluder();
  let lines = [];
  let cy = o.cy === undefined ? bb.y+bb.h/2 : o.cy;
  let x = bb.x - o.size*0.4;
  let col = 0;
  while (x < bb.x+bb.w+o.size*0.5){
    let tx = clamp((x-bb.x)/bb.w,0,1);
    let s = o.size*lerp(1,o.grow,tx);
    let w = s*0.62;
    let h = s*0.56;
    for (let y = bb.y - s + (col%2)*s*0.48; y < bb.y+bb.h+s; y += s*0.92){
      let nx = x + (noise(x*0.03,y*0.03,5)-0.5)*s*0.7 + o.drift*Math.abs(y-cy)/(bb.h/2)*s;
      let ny = y + (noise(x*0.03,y*0.03,6)-0.5)*s*0.5;
      if (!pt_in_poly(nx,ny,outline)) continue;
      let f = contour_feather(
        w*lerp(0.85,1.15,rand()), h*lerp(0.88,1.12,rand()),
        o.pointy, o.extra ? o.extra(nx,ny) : null);
      let mask = trsl_poly(f.mask,nx,ny);
      let k = o.keep(nx,ny);
      if (rand() < k){
        let ls = f.lines.map(l=>trsl_poly(l,nx,ny));
        if (rand() > k){
          let a = ls[0];
          let i0 = ~~(rand()*3);
          let i1 = a.length - ~~(rand()*3);
          ls[0] = a.slice(i0,Math.max(i0+2,i1));
        }
        lines.push(...occ.clip(ls));
      }
      occ.add(mask);
    }
    x += s*0.6;
    col++;
  }
  return clip_multi(lines,outline).true;
}

function body_part(arg,BL,BH){
  let {c0,c1,outline} = body_curves(arg,BL,BH);
  let lines = [c0, c1, [c1[0],[c1[0][0]-BL*0.01,(c0[0][1]+c1[0][1])/2],c0[0]]];
  let pat = arg.body_pattern;
  let extra = null;
  if (pat == 'streaks'){
    extra = (x,y)=>(y > -BH*0.35 && x < BL*0.3 && rand() < 0.85) ? 'streak' : null;
  }else if (pat == 'scallop'){
    extra = (x,y)=>(rand() < 0.8 ? 'scallop' : null);
  }else if (arg.plumage_detail > 0.85){
    extra = (x,y)=>(y < 0 && rand() < 0.3 ? 'rachis' : null);
  }
  let d = arg.plumage_detail;
  lines.push(...plumage_mesh(outline,{
    size: BL*arg.plumage_size,
    grow: 1.45,
    pointy: arg.feather_point,
    drift: 0.25,
    cy: 0,
    keep: (x,y)=>d*lerp(0.95,0.3,smoothstep(-BH*0.7,BH*0.8,y))*lerp(0.55,1,smoothstep(-BL*0.5,-BL*0.1,x)),
    extra,
  }));

  let ps = arg.pattern_scale;
  let pf = null;
  if (pat == 'spots'){
    let pd = pattern_dot(0.55*ps*BL/180);
    pf = (x,y)=>(y > -BH*0.3 && pd(x+250,y+150));
  }else if (pat == 'bars'){
    let per = BL*0.055*ps;
    pf = (x,y)=>(y > -BH*0.3 && Math.sin((y+x*0.3)/per*PI*2 + noise(x*0.03,y*0.03,21)*4) > 0.4);
  }else if (pat == 'cape'){
    pf = (x,y)=>(y < lerp(-0.25,0.25,(x+BL/2)/BL)*BH + (noise(x*0.02,y*0.02,22)-0.5)*BH*0.35);
  }
  if (pf){
    lines.push(...patternshade_shape(outline,pat=='cape'?3.2:2.4,pf));
  }
  lines.push(...shade_shape(outline,5.5,4,BH*0.28));
  return part(lines,[outline]);
}

// ===== beak: conic profile (Campas et al. 2010; Fritz et al. 2014) =====

function beak(base,A,L,D,arg){
  let a = arg.beak_a;
  let shear = arg.beak_shear;
  let hook = arg.beak_hook;
  let dec = arg.beak_decurve;
  let dir = [Math.cos(A),Math.sin(A)];
  let nd = [Math.sin(A),-Math.cos(A)];
  if (nd[1] < 0) nd = [-nd[0],-nd[1]];
  let P = (u,v)=>[base[0]+dir[0]*u+nd[0]*v, base[1]+dir[1]*u+nd[1]*v];
  let g = x=>{x = clamp(x,0,1); return a*x*x+(1-a)*x;};
  let mid = u=>shear*D*(u/L) + dec*L*Math.pow(u/L,2);
  let Du = D*0.55;
  let Dl = D*0.45;
  hook = Math.min(hook,1.2);
  let Lu = L*(1+0.06*hook);
  let Ll = L*(1-0.16*hook);
  let mid_up = u=>mid(u) + hook*D*0.42*Math.pow(clamp((u/Lu-0.55)/0.45,0,1),2);
  let n = 28;
  let u0 = -L*0.06;
  let culmen = [], tomium_u = [], tomium_l = [], lower = [];
  for (let i = 0; i <= n; i++){
    let u = lerp(u0,Lu,i/n);
    let x = 1-u/Lu;
    culmen.push(P(u, mid_up(u) - Du*Math.pow(g(x),0.85)));
    tomium_u.push(P(u, mid_up(u) - (hook ? Du*0.08*g(x) : 0)));
  }
  for (let i = 0; i <= n; i++){
    let u = lerp(u0,Ll,i/n);
    let x = 1-u/Ll;
    tomium_l.push(P(u, mid(u)));
    lower.push(P(u, mid(u) + Dl*g(x)));
  }
  let upper_poly = culmen.concat(tomium_u.slice().reverse());
  let lower_poly = tomium_l.concat(lower.slice().reverse());
  let poly = culmen.concat([tomium_u[n]]).concat(lower.slice().reverse());
  if (hook){
    let tip_back = [];
    for (let i = n; i >= 0; i--){
      let u = lerp(u0,Lu,i/n);
      if (u <= Ll) break;
      tip_back.push(tomium_u[i]);
    }
    poly = culmen.concat(tip_back).concat(lower.slice().reverse());
  }
  let lines = [culmen, lower, tomium_u.slice(0)];
  // gape extends a little into the face
  lines.push([P(u0,mid(u0)),P(u0-L*0.08-D*0.1,mid(u0)+D*0.05)]);
  // naris
  let un = L*0.17+D*0.05;
  let vn = mid_up(un) - Du*Math.pow(g(1-un/Lu),0.85)*0.55;
  let nar = [];
  for (let i = 0; i < 8; i++){
    let t = i/7*PI*1.2-0.1;
    nar.push(P(un + Math.cos(t)*L*0.045, vn + Math.sin(t)*D*0.06));
  }
  lines.push(nar);
  if (arg.beak_dark){
    lines.push(...fill_shape(upper_poly,1.6));
    lines.push(...fill_shape(lower_poly,2.2));
  }else{
    lines.push(...shade_shape(lower_poly,1.8,0,D*0.25));
    let ridge = culmen.slice(2,~~(n*0.7)).map((p,i)=>[p[0]+nd[0]*D*0.08,p[1]+nd[1]*D*0.08]);
    lines.push(...binclip(ridge,(x,y,t)=>rand()<0.8).true);
  }
  return part(lines,[poly]);
}

// ===== head (world frame) =====

function head_outline(hc,HR){
  let n = 48;
  let o = [];
  for (let i = 0; i < n; i++){
    let a = i/n*PI*2;
    let r = HR*(1+(noise(Math.cos(a)+1,Math.sin(a)+1,31)-0.5)*0.1);
    let rx = r*1.04;
    let ry = r*(Math.sin(a) < 0 ? 0.93 : 0.98);
    o.push([hc[0]+Math.cos(a)*rx, hc[1]+Math.sin(a)*ry]);
  }
  return o;
}

function face_predicate(arg,hc,HR,E,ER,bbase){
  let fs = [];
  let ex = E[0], ey = E[1];
  if (arg.face_cap){
    let gap = arg.face_supercilium ? HR*0.2 : 0;
    fs.push((x,y)=>y < ey - ER*1.3 - gap + (x-ex)*0.12);
  }
  if (arg.face_eyestripe){
    fs.push((x,y)=>Math.abs(y-(ey+(x-ex)*0.12)) < ER*0.6 && x > bbase[0]-2 && x < hc[0]+HR*0.9);
  }
  if (arg.face_mask){
    fs.push((x,y)=>Math.hypot(x-ex,(y-ey)*1.25) < HR*0.42 || (x < ex && Math.abs(y-ey) < ER*1.3));
  }
  if (arg.face_bib){
    fs.push((x,y)=>y > hc[1]+HR*0.32 && x < hc[0]+HR*0.15);
  }
  if (arg.face_malar){
    let a = bbase, b = [bbase[0]+HR*0.55, bbase[1]+HR*0.55];
    fs.push((x,y)=>pt_seg_dist([x,y],a,b) < ER*0.4);
  }
  if (arg.face_cheek){
    fs.push((x,y)=>Math.hypot((x-(ex+HR*0.38))/1.2,y-(ey+HR*0.32)) < HR*0.24);
  }
  if (!fs.length) return null;
  return (x,y)=>{
    for (let i = 0; i < fs.length; i++) if (fs[i](x,y)) return true;
    return false;
  };
}

function head_parts(arg,hc,HR,body_world){
  let hp = head_outline(hc,HR);

  let by = arg.beak_y;
  let bbase = [hc[0]-Math.cos(by)*HR*0.88, hc[1]+Math.sin(by)*HR*0.88];
  let L = HR*arg.beak_len;
  let D = Math.min(HR*1.35, L*arg.beak_depth);
  let A = PI - arg.beak_droop;
  let bk = beak(bbase,A,L,D,arg);

  let E = [hc[0]-HR*arg.eye_fwd, hc[1]-HR*0.12];
  let ER = HR*arg.eye_ratio;
  let [eye0,ef] = (arg.eye_type ? fish_eye_b : fish_eye_a)(E[0],E[1],ER);
  let eye_mask = eye0;
  let eye_lines = ef;
  if (arg.eye_ring){
    let ring = ellipse_poly(E[0],E[1],ER*1.45,ER*1.4,28);
    eye_lines = eye_lines.concat(binclip(closed(ring),(x,y,t)=>noise(t*20,7)>0.35).true);
    eye_mask = ring;
  }
  if (arg.bristles){
    for (let i = 0; i < 3; i++){
      let b = barbel(bbase[0]+2,bbase[1]-D*0.05+i*1.2,8,PI+0.25+i*0.15,1.6);
      eye_lines.push(b);
    }
  }

  let lines = clip(closed(hp),body_world).false;
  let n_seam = lines.length;
  let fp = face_predicate(arg,hc,HR,E,ER,bbase);
  if (fp){
    lines.push(...patternshade_shape(hp,2.1,fp));
  }
  lines.push(...plumage_mesh(hp,{
    size: HR*0.32,
    grow: 1.2,
    pointy: arg.feather_point,
    drift: 0,
    keep: (x,y)=>arg.plumage_detail*(x > hc[0] ? 0.35 : 0.1),
  }));
  lines.push(...shade_shape(hp,4,2,HR*0.35).filter(l=>rand()<0.8));
  let masks = [hp];
  let n_end = lines.length;
  let crest = null;

  if (arg.crest){
    let a0 = PI*1.3, a1 = PI*1.9;
    let cv = [];
    for (let i = 0; i < 14; i++){
      let a = lerp(a0,a1,i/13);
      cv.push([hc[0]+Math.cos(a)*HR*1.0, hc[1]+Math.sin(a)*HR*0.92]);
    }
    let cl = arg.crest_len*HR;
    let [cpoly,clines_raw] = fin_a(cv,0.62,0.95,t=>cl*(0.2+0.8*Math.pow(Math.sin(PI*(0.1+t*0.62)),1.5)),false,0,0,6);
    let clines = clip_multi(clines_raw,hp).false;
    lines.push(...clines);
    masks.push(cpoly);
    crest = {poly:cpoly, lines:clines_raw, base:cv[7]};
  }
  return {
    beak: bk,
    eye: part(eye_lines,[eye_mask]),
    head: part(lines,masks),
    hp, E, ER, bbase, crest, n_seam, n_end,
  };
}

// ===== flight feather (Streit & Heidrich 2002; Franco & Walter 2002) =====
// Quadratic-Bezier rachis, asymmetric vane width profile, barbs running from
// the rachis to the vane edge further toward the tip (barb slant).

function feather(P0,P1,W,o={}){
  let asym = o.asym === undefined ? 0.42 : o.asym;
  let tip = o.tip || 'round';
  let bend = o.bend || 0;
  let emarg = o.emarg || 0;
  let n = o.n || 16;
  let L = dist(...P0,...P1);
  let ang = Math.atan2(P1[1]-P0[1],P1[0]-P0[0]);
  let C = [(P0[0]+P1[0])/2 - Math.sin(ang)*bend*L, (P0[1]+P1[1])/2 + Math.cos(ang)*bend*L];
  let R = s=>{
    let a = (1-s)*(1-s), b = 2*s*(1-s), c = s*s;
    return [a*P0[0]+b*C[0]+c*P1[0], a*P0[1]+b*C[1]+c*P1[1]];
  };
  let N = s=>{
    let tx = 2*(1-s)*(C[0]-P0[0]) + 2*s*(P1[0]-C[0]);
    let ty = 2*(1-s)*(C[1]-P0[1]) + 2*s*(P1[1]-C[1]);
    let l = Math.hypot(tx,ty) || 1;
    return [-ty/l, tx/l];
  };
  let wf = s=>{
    let w = W*Math.sqrt(smoothstep(0,0.22,s));
    if (tip == 'round'){
      if (s > 0.55){ let q = (s-0.55)/0.45; w *= Math.sqrt(Math.max(0,1-q*q)); }
    }else if (tip == 'pointed'){
      if (s > 0.4) w *= Math.pow(Math.max(0,(1-s)/0.6),0.85);
    }else{
      w *= 1 - smoothstep(0.88,1,s)*0.8;
    }
    return w;
  };
  let side_w = (s,side)=>{
    if (side < 0){
      let w = wf(s)*asym;
      if (emarg && s > emarg) w *= lerp(1,0.45,smoothstep(emarg,emarg+0.06,s));
      return w;
    }
    return wf(s)*(1-asym);
  };
  let edge = (s,side)=>{
    let r = R(s), nn = N(s), w = side_w(s,side);
    return [r[0]+side*nn[0]*w, r[1]+side*nn[1]*w];
  };
  let left = [], right = [];
  for (let i = 0; i <= n; i++){
    let s = i/n;
    left.push(edge(s,-1));
    right.push(edge(s,1));
  }
  let poly = left.concat(right.slice().reverse());
  let lines = [closed(poly)];
  if (o.rachis !== false){
    let r = [];
    for (let i = 0; i <= 10; i++) r.push(R(i/10*0.94));
    lines.push(r);
  }
  let nb = Math.floor(L*(o.barbs||0));
  let slant = o.slant || 0.12;
  for (let k = 0; k < nb; k++){
    let s = lerp(0.12,0.9,(k+rand()*0.6)/nb);
    for (let side = -1; side <= 1; side += 2){
      if (rand() > 0.6) continue;
      let a = R(s);
      let b = edge(Math.min(1,s+slant),side);
      a = lerp2d(...a,...b,0.1+rand()*0.35);
      let m = lerp2d(...a,...b,0.5);
      let j = (noise(m[0]*0.2,m[1]*0.2,51)-0.5)*1.2;
      m = [m[0]+j, m[1]+j];
      lines.push([a,m,lerp2d(...a,...b,0.97)]);
    }
  }
  if (o.dark){
    let dl = o.dark_len || 0.8;
    let inner = feather(R(0.04),R(dl),W*(o.dark_w||0.55),{tip, asym, n:10, rachis:false});
    lines.push(...fill_shape(inner.poly, o.dark_step || 2.2));
  }
  if (o.bars){
    let per = o.bars;
    lines.push(...patternshade_shape(poly,2,(x,y)=>Math.sin((x*Math.cos(ang)+y*Math.sin(ang))/per*PI*2) > 0.35));
  }
  return {poly,lines};
}

// ===== folded wing: feather-group roster (Howard 2011) =====
// Built in a "physical" wing frame (x along the wing from the wrist, y across,
// negative = toward the back), then warped into the tapering envelope and
// placed in the body frame.

function wing_part(arg,BL,BH){
  let WL = BL*arg.wing_ratio;
  let WH = BH*1.25;
  let us = 1-arg.kipp;
  let style = arg.wing_style;
  let taper = u=>Math.pow(smoothstep(0,0.18,u),0.5)*(1-0.78*smoothstep(0.38,1.05,u))+0.04;
  let anchor = [-BL*0.3, -BH*0.18];
  let beta = arg.wing_angle;
  let warp = p=>{
    let u = p[0]/WL;
    let q = [p[0], p[1]*taper(u)];
    q = rot_pt(q,beta);
    return [q[0]+anchor[0], q[1]+anchor[1]];
  };
  let warp_line = l=>resample(l,2).map(warp);

  let roster = [];
  let grp = (group,n,f)=>{
    for (let k = 0; k < n; k++){
      let t = n > 1 ? k/(n-1) : 0;
      roster.push(Object.assign({group},f(t,k)));
    }
  };
  grp('scapular',3,t=>({b:[0.02+0.14*t,-0.62+0.03*t], e:[0.3+0.12*t,-0.46+0.06*t], w:0.26, tip:'round'}));
  grp('median',arg.n_mcov,t=>({b:[0.07,-0.42+0.48*t], e:[0.28+0.02*t,-0.38+0.48*t], w:0.15, tip:'round'}));
  grp('greater',arg.n_gcov,t=>({b:[0.1,-0.36+0.72*t], e:[0.46+0.03*t,-0.32+0.68*t], w:0.17, tip:'round'}));
  grp('alula',3,t=>({b:[0.02,0.22+0.1*t], e:[0.24+0.04*t,0.28+0.1*t], w:0.12, tip:'pointed'}));
  grp('tertial',arg.n_tertials,t=>({b:[0.28,-0.4+0.14*t], e:[us+0.03-0.05*t,-0.33+0.18*t], w:0.3, tip:'round'}));
  grp('secondary',arg.n_secondaries,t=>({b:[0.2,-0.22+0.5*t], e:[us-0.04-0.06*t,-0.15+0.52*t], w:0.22, tip:'round'}));
  grp('primary',arg.n_primaries,t=>({b:[0.15,0.02+0.26*t], e:[lerp(us+0.05,1.0,Math.pow(t,0.8)),lerp(-0.05,0.3,t)], w:0.2, tip:'pointed'}));

  let flight = {tertial:1, secondary:1, primary:1};
  let occ = new Occluder();
  let lines = [];
  let masks = [];

  // lesser coverts: a small contour-feather mesh near the leading edge
  let lc = [[0,-0.12],[0.03,-0.42],[0.12,-0.56],[0.27,-0.52],[0.31,-0.2],[0.27,0.1],[0.1,0.14],[0.02,0.06]]
    .map(([u,v])=>[u*WL,v*WH]);
  lc = resample(closed(lc),3);
  let lcl = plumage_mesh(lc,{
    size: WH*0.15, grow: 1.15, pointy: arg.feather_point, drift: 0,
    keep: ()=>0.75*arg.plumage_detail,
  });
  lines.push(...lcl);
  occ.add(lc);
  masks.push(lc.map(warp));

  for (let i = 0; i < roster.length; i++){
    let f = roster[i];
    let P0 = [f.b[0]*WL, f.b[1]*WH];
    let P1 = [f.e[0]*WL, f.e[1]*WH];
    let o = {
      tip: f.tip,
      asym: f.group == 'primary' ? 0.35 : 0.45,
      bend: (f.group == 'primary' ? 0.015 : 0.03) + deviate(0.01),
      barbs: flight[f.group] ? arg.barb_density*(f.group == 'primary' ? 0.3 : 1) : 0,
      slant: 0.1,
      n: 18,
    };
    if (f.group == 'primary' && arg.emarg) o.emarg = 0.62;
    if (style == 'wingbars' && (f.group == 'greater' || f.group == 'median')){
      o.dark = 1; o.dark_len = 0.68; o.dark_w = 0.85;
    }else if (style == 'dark_centers' && (f.group == 'tertial' || f.group == 'greater' || f.group == 'median' || f.group == 'scapular')){
      o.dark = 1; o.dark_len = 0.82; o.dark_w = 0.55;
    }else if (style == 'dark_flight' && flight[f.group]){
      o.dark = 1; o.dark_len = 0.95; o.dark_w = 0.85; o.dark_step = f.group == 'primary' ? 4 : 2.4;
    }else if (style == 'barred' && flight[f.group]){
      o.bars = WL*0.07;
    }
    let fe = feather(P0,P1,f.w*WH,o);
    lines.push(...occ.clip(fe.lines));
    occ.add(fe.poly);
    masks.push(resample(closed(fe.poly),3).map(warp));
  }
  return part(lines.map(warp_line),masks);
}

// ===== tail fan =====

function tail_length_fn(shape,r){
  if (shape == 'square') return 0.97+0.03*r;
  if (shape == 'rounded') return 0.8+0.2*r;
  if (shape == 'graduated') return 0.45+0.55*Math.pow(r,1.2);
  if (shape == 'forked') return 1-0.32*r;
  if (shape == 'pointed') return 0.72+0.28*r+(r > 0.99 ? 0.25 : 0);
  return 0.6+0.4*r;
}

function tail_part(arg,BL,BH){
  let TL = BL*arg.tail_ratio;
  let k = arg.n_rect;
  let base = [BL*0.38, -BH*0.06];
  let ang0 = arg.tail_cock;
  let shape = arg.tail_shape;
  let tip = {square:'square', rounded:'round', graduated:'round', forked:'pointed', pointed:'pointed', wedge:'pointed'}[shape];
  let occ = new Occluder();
  let lines = [];
  let masks = [];
  let raw = [];
  let add = (fe,kind,i)=>{
    lines.push(...occ.clip(fe.lines));
    occ.add(fe.poly);
    masks.push(fe.poly);
    raw.push({kind, i, poly:fe.poly, lines:fe.lines});
  };
  let dir = a=>[Math.cos(a),Math.sin(a)];
  for (let j = 0; j < 3; j++){
    let b = [base[0]-BL*0.05+j*BL*0.02, base[1]-BH*0.12+j*BH*0.05];
    let d = dir(ang0-0.05);
    add(feather(b,[b[0]+d[0]*TL*0.35,b[1]+d[1]*TL*0.35],TL*0.14,{tip:'round',asym:0.5,n:12}),'upper_cov',j);
  }
  for (let j = 0; j < 2; j++){
    let b = [base[0]-BL*0.06, base[1]+BH*0.2+j*BH*0.06];
    let d = dir(ang0+0.25);
    add(feather(b,[b[0]+d[0]*TL*0.3,b[1]+d[1]*TL*0.3],TL*0.13,{tip:'round',asym:0.5,n:12}),'under_cov',j);
  }
  let style = arg.wing_style;
  for (let i = 0; i < k; i++){
    let r = 1-i/(k-1);
    let len = TL*tail_length_fn(shape,r);
    let a = ang0 + i*0.045;
    let b = [base[0], base[1]+i*TL*0.03];
    let d = dir(a);
    let w = TL*0.17*arg.tail_width*(shape == 'pointed' && r > 0.99 ? 0.6 : 1);
    let o = {tip, asym:0.45, n:18, bend:-0.02+deviate(0.01), barbs:arg.barb_density*0.7};
    if (style == 'barred') o.bars = TL*0.12;
    else if (style == 'dark_flight') {o.dark = 1; o.dark_len = 0.95; o.dark_w = 0.85; o.dark_step = 2.4;}
    add(feather(b,[b[0]+d[0]*len,b[1]+d[1]*len],w,o),'rect',i);
  }
  let p = part(lines,masks);
  p.raw = raw;
  p.pivot = base;
  return p;
}

// ===== legs, feet, perch (world frame) =====

function toe_shape(pts,w0,w1){
  let c = smooth_path(pts,1.2,2);
  let poly = tube(c,w0,w1);
  return {poly, lines:[closed(poly)]};
}

function leg_parts(H,F,tw,TaL,PT){
  let tc = resample([H,F],1.5);
  let tpoly = tube(tc,tw*1.1,tw*0.9);
  let n = tc.length;
  let front_edge = tpoly.slice(0,n);
  let back_edge = tpoly.slice(n);
  let ns = curve_normals(tc);
  let ticks = [];
  for (let s = 3; s < TaL-2; s += 2.6){
    let t = s/TaL;
    let p = lerp2d(...H,...F,t);
    let w = lerp(tw*1.1,tw*0.9,t);
    let nn = ns[Math.min(n-1,~~(t*(n-1)))];
    let side = nn[0] < 0 ? 1 : -1;
    let a = [p[0]+side*nn[0]*w, p[1]+side*nn[1]*w];
    let b = [p[0]+side*nn[0]*w*0.15, p[1]+side*nn[1]*w*0.15+0.8];
    ticks.push([a,b]);
  }
  let tarsus = part([front_edge,back_edge,...ticks],[tpoly]);

  let tl = Math.max(7,TaL*0.5+tw*2.5);
  let front = part([],[]);
  for (let j = 0; j < 3; j++){
    let jl = tl*(j == 1 ? 1 : 0.82);
    let S = [F[0]+(j-1)*tw*0.6, F[1]-tw*0.4];
    let pts = [
      S,
      [S[0]-jl*0.35, S[1]+PT*0.08],
      [S[0]-jl*0.55+j*jl*0.08, S[1]+PT*0.42],
      [S[0]-jl*0.5+j*jl*0.12, S[1]+PT*0.72],
    ];
    let t = toe_shape(pts,tw*0.85,tw*0.45);
    let e = pts[3];
    let claw = toe_shape([e,[e[0]+tw*0.3,e[1]+tw*1.8],[e[0]+tw*1.6,e[1]+tw*2.6]],tw*0.45,0.1);
    front.lines.push(...claw.lines,...clip_multi(t.lines,claw.poly).false);
    front.masks.push(claw.poly,t.poly);
  }
  let hpts = [F,[F[0]+tl*0.35,F[1]+PT*0.05],[F[0]+tl*0.5,F[1]+PT*0.3],[F[0]+tl*0.45,F[1]+PT*0.6]];
  let ht = toe_shape(hpts,tw*0.8,tw*0.35);
  let hallux = part(ht.lines,[ht.poly]);
  return {tarsus, front, hallux};
}

function perch_part(x0,x1,F,PT,tilt){
  let n = Math.max(8,~~((x1-x0)/4));
  let yc = x=>F[1] + (x-F[0])*tilt + (noise(x*0.012,41)-noise(F[0]*0.012,41))*PT*1.2;
  let th = x=>PT*lerp(1.15,0.75,(x-x0)/(x1-x0))*lerp(0.9,1.1,noise(x*0.03,42));
  let top = [], bot = [];
  for (let i = 0; i < n; i++){
    let x = lerp(x0,x1,i/(n-1));
    let y = yc(x);
    top.push([x,y]);
    bot.push([x,y+th(x)]);
  }
  let poly = top.concat(bot.slice().reverse());
  let lines = [top,bot];
  let t0 = th(x0);
  let ec = [x0,yc(x0)+t0/2];
  lines.push(closed(ellipse_poly(ec[0],ec[1],t0*0.22,t0/2,20)));
  for (let k = 1; k <= 2; k++){
    lines.push(closed(ellipse_poly(ec[0]+0.3,ec[1],t0*0.22*k/3.5,t0/2*k/3.5,14)));
  }
  let twig = [];
  let ex = x1, ey = yc(x1)+th(x1)/2;
  let ang = -0.45 + deviate(0.25);
  let nt = 4 + ~~(rand()*4);
  for (let i = 0; i < nt; i++){
    twig.push([ex,ey]);
    ex += Math.cos(ang)*PT*0.35;
    ey += Math.sin(ang)*PT*0.35;
    ang += (noise(i*0.3,43)-0.5)*0.5;
  }
  twig = smooth_path(twig,1.5,2);
  let tw = tube(twig,th(x1)*0.4,0.5);
  lines.push(...clip(closed(tw),poly).false);
  let bark = [];
  let m = ~~((x1-x0)/6);
  for (let k = 0; k < m; k++){
    let xa = lerp(x0,x1,rand());
    let len = PT*(1.5+rand()*4);
    let d = 0.15+rand()*0.75;
    let l = [];
    for (let x = xa; x < Math.min(x1,xa+len); x += 2){
      l.push([x, lerp(yc(x),yc(x)+th(x),d) + (noise(x*0.1,d*10,44)-0.5)*2.5]);
    }
    if (l.length > 1) bark.push(l);
  }
  lines.push(...clip_multi(bark,poly).true.filter(()=>rand()<0.8));
  lines.push(...shade_shape(poly,2.6,0,PT*0.45));
  return part(lines,[poly,tw]);
}

// ===== the bird =====

// build_rig keeps the exact legacy compose list (so static output and RNG use
// are unchanged) plus the metadata the idle animation needs.
function build_rig(arg){
  let BL = arg.body_length;
  let BH = BL*arg.body_plump/2;
  let th = arg.posture;
  let R = p=>rot_pt(p,th);

  let body = map_part(body_part(arg,BL,BH),R);
  let wing = map_part(wing_part(arg,BL,BH),R);
  let tp = tail_part(arg,BL,BH);
  let tail = map_part(tp,R);
  let tail_raw = tp.raw.map(f=>({kind:f.kind, i:f.i, poly:f.poly.map(R), lines:map_lines(f.lines,R)}));
  let body_world = body.masks[0];

  let HR = BH*arg.head_ratio;
  let Nw = R([-BL*0.4,-BH*0.2]);
  let hc = [Nw[0]-HR*0.1, Nw[1]-HR*(0.25+arg.neck)];
  let hd = head_parts(arg,hc,HR,body_world);

  let bcs = body_curves(arg,BL,BH);
  let bc = bcs.c1;
  let hi = 17;
  let H = R([bc[hi][0], bc[hi][1]*0.8]);
  let lowest = Math.max(...body_world.map(p=>p[1]));
  let TaL = BL*arg.tarsus_ratio;
  let lean = 0.22;
  let F = [H[0]-TaL*Math.sin(lean), H[1]+TaL*Math.cos(lean)];
  if (F[1] < lowest - BH*0.15){
    F[1] = lowest - BH*0.15;
  }
  TaL = dist(...H,...F);
  let tw = Math.max(1.4,BL*0.02);
  let PT = BL*arg.perch_ratio;

  let near = leg_parts(H,F,tw,TaL,PT);
  let off = [BL*0.07,-1.5];
  let far = leg_parts(
    [H[0]+off[0],H[1]+off[1]],[F[0]+off[0],F[1]+off[1]],tw*0.95,TaL,PT);

  let all = [].concat(body.masks,wing.masks,tail.masks,hd.head.masks,hd.beak.masks).flat();
  let bb = get_bbox(all);
  let x0 = Math.min(bb.x, F[0]) - BL*(0.04+rand()*0.12);
  let x1 = Math.max(bb.x+bb.w, F[0]) + BL*(0.02+rand()*0.12);
  let perch = perch_part(x0,x1,F,PT,arg.perch_tilt);

  return {
    arg,
    legacy: [
      near.front,
      hd.beak,
      hd.eye,
      hd.head,
      wing,
      body,
      near.tarsus,
      perch,
      near.hallux,
      tail,
      far.tarsus,
      far.front,
      far.hallux,
    ],
    meta: {
      BL, BH, th, c0:bcs.c0, c1:bcs.c1, H, F,
      hc, HR, E:hd.E, ER:hd.ER, bbase:hd.bbase, hp:hd.hp,
      crest:hd.crest, n_seam:hd.n_seam, n_end:hd.n_end,
      tail_raw, tail_pivot:R(tp.pivot),
      shoulder:R([-BL*0.3,-BH*0.18]),
      body_outline:body_world,
    },
  };
}

function render_static(rig){
  let drawing = compose(rig.legacy);
  if (rig.arg.facing){
    drawing = drawing.map(l=>l.map(([x,y])=>[-x,y]));
  }
  return drawing;
}

function bird(arg){
  return render_static(build_rig(arg));
}

// ===== parameters =====

function default_params(){
  return {
    archetype: 'finch',
    body_length: 180,
    body_plump: 0.62,
    belly: 0.5,
    posture: 0.55,
    head_ratio: 0.66,
    neck: 0.25,
    beak_len: 0.62,
    beak_depth: 0.85,
    beak_a: -0.5,
    beak_shear: 0.1,
    beak_hook: 0,
    beak_decurve: 0,
    beak_droop: 0.08,
    beak_y: 0.12,
    beak_dark: 0,
    eye_ratio: 0.19,
    eye_type: 0,
    eye_ring: 0,
    eye_fwd: 0.36,
    crest: 0,
    crest_len: 0.8,
    bristles: 0,
    face_cap: 0,
    face_eyestripe: 0,
    face_mask: 0,
    face_bib: 0,
    face_malar: 0,
    face_cheek: 0,
    face_supercilium: 0,
    wing_ratio: 0.72,
    wing_angle: 0.08,
    kipp: 0.28,
    n_primaries: 8,
    n_secondaries: 6,
    n_tertials: 3,
    n_gcov: 7,
    n_mcov: 5,
    wing_style: 'wingbars',
    emarg: 0,
    tail_ratio: 0.62,
    tail_shape: 'forked',
    tail_cock: 0.25,
    tail_width: 1,
    n_rect: 5,
    tarsus_ratio: 0.16,
    perch_ratio: 0.08,
    perch_tilt: 0,
    facing: 0,
    body_pattern: 'plain',
    pattern_scale: 1,
    plumage_size: 0.11,
    plumage_detail: 0.8,
    feather_point: 1.1,
    barb_density: 0.22,
  };
}

// Proportion centres are hand-seeded to typical AVONET ratios
// (tools/build_tables.js can regenerate them from the dataset).
let ARCHETYPES = {
  finch: {
    n:{body_plump:.64,posture:.55,head_ratio:.68,neck:.2,beak_len:.6,beak_depth:.85,beak_a:-.5,beak_shear:.1,beak_droop:.08,eye_ratio:.19,wing_ratio:.72,kipp:.28,tail_ratio:.62,tail_cock:.25,tarsus_ratio:.15,plumage_size:.11},
    tail_shape:{forked:3,square:2,rounded:1}, body_pattern:{plain:3,streaks:2,cape:2,scallop:1},
    wing_style:{wingbars:3,plain:1,dark_centers:2},
    face:{cap:.3,mask:.15,bib:.25,eyestripe:.1,malar:.1,cheek:.15,supercilium:.1}, crest:.1, eye_ring:.1, beak_dark:.3, bristles:0,
  },
  sparrow: {
    n:{body_plump:.6,posture:.5,head_ratio:.64,neck:.2,beak_len:.6,beak_depth:.75,beak_a:-.4,beak_shear:.08,beak_droop:.08,eye_ratio:.19,wing_ratio:.7,kipp:.22,tail_ratio:.7,tail_cock:.2,tarsus_ratio:.18,plumage_size:.11},
    tail_shape:{square:2,rounded:2,forked:1}, body_pattern:{streaks:3,plain:1,cape:1},
    wing_style:{dark_centers:3,wingbars:2},
    face:{cap:.5,bib:.4,eyestripe:.4,supercilium:.4,malar:.3,cheek:.3}, crest:.05, eye_ring:.1, beak_dark:.4, bristles:0,
  },
  warbler: {
    n:{body_plump:.52,posture:.45,head_ratio:.6,neck:.25,beak_len:.75,beak_depth:.38,beak_a:.1,beak_shear:.05,beak_droop:.05,eye_ratio:.21,wing_ratio:.7,kipp:.22,tail_ratio:.72,tail_cock:.15,tarsus_ratio:.2,plumage_size:.1},
    tail_shape:{square:3,rounded:1,forked:1}, body_pattern:{plain:4,streaks:2},
    wing_style:{plain:2,wingbars:2,dark_centers:1},
    face:{supercilium:.4,eyestripe:.4,cap:.2,mask:.1,bib:.15}, crest:.05, eye_ring:.4, beak_dark:.5, bristles:.3,
  },
  thrush: {
    n:{body_plump:.56,posture:.6,head_ratio:.58,neck:.3,beak_len:.85,beak_depth:.4,beak_a:0,beak_shear:.06,beak_droop:.06,eye_ratio:.22,wing_ratio:.8,kipp:.26,tail_ratio:.72,tail_cock:.18,tarsus_ratio:.26,plumage_size:.11},
    tail_shape:{square:3,rounded:2}, body_pattern:{spots:4,plain:1,scallop:1},
    wing_style:{plain:2,dark_centers:2,wingbars:1},
    face:{malar:.3,cheek:.3,supercilium:.2}, crest:0, eye_ring:.5, beak_dark:.4, bristles:.2,
  },
  corvid: {
    n:{body_plump:.5,posture:.5,head_ratio:.55,neck:.3,beak_len:1.3,beak_depth:.48,beak_a:-.25,beak_shear:.18,beak_droop:.08,eye_ratio:.17,wing_ratio:.85,kipp:.3,tail_ratio:.9,tail_cock:.15,tarsus_ratio:.3,plumage_size:.13},
    tail_shape:{rounded:3,graduated:2,square:1}, body_pattern:{plain:4,cape:1},
    wing_style:{plain:2,dark_flight:3},
    face:{bib:.2,cap:.2}, crest:.1, eye_ring:0, beak_dark:1, bristles:.5,
  },
  raptor: {
    n:{body_plump:.62,posture:1.0,head_ratio:.58,neck:.15,beak_len:.75,beak_depth:.8,beak_a:-.6,beak_shear:.25,beak_hook:1,beak_droop:.1,eye_ratio:.24,wing_ratio:.95,kipp:.32,tail_ratio:.72,tail_cock:.1,tarsus_ratio:.28,plumage_size:.12},
    tail_shape:{square:3,rounded:2}, body_pattern:{bars:3,streaks:2,spots:1},
    wing_style:{barred:3,dark_centers:2,plain:1},
    face:{malar:.5,cap:.3,mask:.2}, crest:.15, eye_ring:.1, beak_dark:.6, bristles:0, emarg:.8,
  },
  parrot: {
    n:{body_plump:.6,posture:1.0,head_ratio:.75,neck:.1,beak_len:.75,beak_depth:1.1,beak_a:-.8,beak_shear:.3,beak_hook:1.4,beak_droop:.15,eye_ratio:.18,wing_ratio:.8,kipp:.25,tail_ratio:1.1,tail_cock:.05,tarsus_ratio:.12,plumage_size:.11},
    tail_shape:{graduated:3,pointed:2,square:1}, body_pattern:{plain:3,scallop:2},
    wing_style:{plain:2,dark_flight:2,dark_centers:1},
    face:{mask:.2,cheek:.4,bib:.2}, crest:.25, eye_ring:.6, beak_dark:.4, bristles:0,
  },
  kingfisher: {
    n:{body_plump:.62,posture:.45,head_ratio:.82,neck:.05,beak_len:2.2,beak_depth:.33,beak_a:.2,beak_shear:.03,beak_droop:.05,eye_ratio:.17,wing_ratio:.65,kipp:.18,tail_ratio:.42,tail_cock:.3,tarsus_ratio:.08,plumage_size:.1},
    tail_shape:{rounded:3,square:1}, body_pattern:{plain:3,scallop:1},
    wing_style:{plain:2,dark_centers:1,wingbars:1},
    face:{eyestripe:.5,cheek:.4,bib:.4,cap:.3}, crest:.5, eye_ring:0, beak_dark:.7, bristles:0,
  },
  owl: {
    n:{body_plump:.78,posture:1.35,head_ratio:.86,neck:0,beak_len:.38,beak_depth:.9,beak_a:-.6,beak_shear:.3,beak_hook:1,beak_droop:.55,beak_y:.3,eye_ratio:.3,eye_fwd:.3,wing_ratio:.85,kipp:.2,tail_ratio:.42,tail_cock:.2,tarsus_ratio:.22,plumage_size:.1},
    tail_shape:{rounded:3,square:2}, body_pattern:{bars:3,streaks:3,spots:1},
    wing_style:{barred:3,dark_centers:1},
    face:{mask:.3,cap:.1}, crest:.12, eye_ring:.7, beak_dark:.3, bristles:0,
  },
  swallow: {
    n:{body_plump:.48,posture:.35,head_ratio:.62,neck:.1,beak_len:.38,beak_depth:.5,beak_a:-.2,beak_shear:.05,beak_droop:.04,eye_ratio:.2,wing_ratio:1.15,kipp:.45,tail_ratio:.95,tail_cock:.1,tarsus_ratio:.07,plumage_size:.1},
    tail_shape:{forked:5,square:1}, body_pattern:{plain:4,cape:3},
    wing_style:{plain:2,dark_flight:2},
    face:{bib:.5,cap:.3,mask:.1}, crest:0, eye_ring:0, beak_dark:1, bristles:.3,
  },
  wader: {
    n:{body_plump:.5,posture:.4,head_ratio:.5,neck:.9,beak_len:2.6,beak_depth:.24,beak_a:.15,beak_shear:.02,beak_droop:.08,eye_ratio:.2,wing_ratio:.9,kipp:.3,tail_ratio:.45,tail_cock:.25,tarsus_ratio:.5,plumage_size:.12},
    tail_shape:{square:2,rounded:2,wedge:1}, body_pattern:{scallop:2,streaks:2,plain:1,bars:1},
    wing_style:{dark_centers:3,plain:1,wingbars:1},
    face:{supercilium:.5,eyestripe:.4,cap:.2}, crest:.15, eye_ring:0, beak_dark:.6, bristles:0, decurve:.4,
  },
};

// Absolute half-widths of the triangular sampling around archetype centres.
// Negative values are relative to the centre.
let PARAM_SPREAD = {
  body_plump:.08, posture:.25, head_ratio:.1, neck:.15,
  beak_len:-.25, beak_depth:.12, beak_a:.25, beak_shear:.08, beak_hook:.3, beak_droop:.08,
  beak_y:.08, eye_ratio:.04, eye_fwd:.05,
  wing_ratio:.1, kipp:.08, tail_ratio:-.2, tail_cock:.15, tarsus_ratio:-.25, plumage_size:.02,
};

function weighted(obj){
  let ks = Object.keys(obj);
  return choice(ks,ks.map(k=>obj[k]));
}

function generate_params(){
  let arg = default_params();
  let names = Object.keys(ARCHETYPES);
  let an = choice(names);
  let A = ARCHETYPES[an];
  let B = null, bw = 0;
  let bn = null;
  if (rand() < 0.3){
    bn = choice(names);
    B = ARCHETYPES[bn];
    bw = rand()*0.6;
  }
  arg.archetype = B ? an+'+' : an;
  arg.archetype_mix = [an, bn, bw];
  let src = (B && rand() < bw) ? B : A;

  let keys = Object.keys(PARAM_SPREAD);
  for (let i = 0; i < keys.length; i++){
    let k = keys[i];
    let ca = A.n[k] === undefined ? arg[k] : A.n[k];
    let c = ca;
    if (B){
      let cb = B.n[k] === undefined ? arg[k] : B.n[k];
      c = lerp(ca,cb,bw);
    }
    let s = PARAM_SPREAD[k];
    s = s < 0 ? -s*Math.abs(c) : s;
    arg[k] = rndtri(c-s,c,c+s);
  }
  arg.body_plump = clamp(arg.body_plump,0.4,0.85);
  arg.beak_depth = Math.max(0.15,arg.beak_depth);
  arg.beak_a = clamp(arg.beak_a,-0.95,0.4);
  arg.beak_hook = arg.beak_hook < 0.25 ? 0 : arg.beak_hook;
  arg.kipp = clamp(arg.kipp,0.08,0.5);
  arg.eye_ratio = clamp(arg.eye_ratio,0.12,0.36);
  arg.neck = Math.max(0,arg.neck);
  arg.tarsus_ratio = Math.max(0.05,arg.tarsus_ratio);
  arg.beak_decurve = rand() < ((src.decurve||0)+0.04) ? rndtri(0.1,0.22,0.35) : 0;

  arg.tail_shape = weighted(src.tail_shape);
  arg.body_pattern = weighted(src.body_pattern);
  arg.wing_style = weighted(src.wing_style);
  let fk = ['cap','eyestripe','mask','bib','malar','cheek','supercilium'];
  for (let i = 0; i < fk.length; i++){
    arg['face_'+fk[i]] = Number(rand() < (src.face[fk[i]] || 0));
  }
  arg.crest = Number(rand() < src.crest);
  arg.crest_len = rndtri(0.3,0.55,0.95);
  arg.eye_ring = Number(rand() < src.eye_ring);
  arg.beak_dark = Number(rand() < src.beak_dark);
  arg.bristles = Number(rand() < src.bristles);
  arg.emarg = Number(rand() < (src.emarg || 0));
  arg.eye_type = choice([0,1]);

  arg.body_length = rndtri(160,180,200);
  arg.belly = rndtri(0,0.5,1);
  arg.wing_angle = rndtri(0,0.08,0.18);
  arg.n_primaries = ~~rndtri(6,8,10);
  arg.n_secondaries = ~~rndtri(5,6,9);
  arg.n_tertials = choice([2,3,3]);
  arg.n_gcov = ~~rndtri(6,7,10);
  arg.n_mcov = ~~rndtri(4,5,7);
  arg.n_rect = ~~rndtri(4,5,7);
  arg.tail_width = rndtri(0.8,1,1.3);
  arg.perch_ratio = rndtri(0.06,0.08,0.12);
  arg.perch_tilt = deviate(0.08);
  arg.facing = choice([0,1]);
  arg.pattern_scale = rndtri(0.6,1,1.6);
  arg.plumage_detail = rndtri(0.5,0.8,1);
  arg.feather_point = rndtri(0.8,1.1,1.5);
  arg.barb_density = rndtri(0.1,0.22,0.4);
  return arg;
}

// ===== names =====
// Syllable tables in fishdraw's binomen format. tools/build_names.js can
// rebuild them (with frequencies) from a list of real scientific names.

let BIRD_SYLLABLES = [
  ["A","AC","AE","AL","AM","AN","AR","AS","BU","CA","CAR","CER","CHLO","CI","CO","CY","DEN","DRY","E","EM","ER","EU","FAL","FRIN","GAL","GEO","HA","HE","HI","HY","LA","LEP","LO","LOX","ME","MI","MO","MY","NE","NU","O","OR","PA","PAS","PE","PHY","PI","PO","PSI","PY","RAL","SAX","SE","SI","SPI","STUR","SYL","TA","THRY","TI","TO","TUR","TY","VI","XE","ZO"],
  ["BE","CA","CI","CO","DRO","GI","LA","LE","LI","LO","MI","NA","NI","PHI","PI","RI","RO","SPI","TA","TI","TO","VI","ZE"],
  ["A","AX","CA","CUS","DA","ER","ES","IA","ICA","IS","LA","LUS","NIS","OPS","ORNIS","PHAGA","PUS","RHYNCHUS","STES","TES","US","ZA","OLA","ULA","ILUS","ETTA"],
  ["AL","AT","AU","BI","CAE","CAN","CHRY","CI","CRIS","CYA","DO","E","ERY","FLA","FUS","GRI","HYP","LEU","LU","MA","MEL","MI","MIN","NI","NO","OCH","OLI","PAL","PER","PU","RU","SAN","SPLEN","STRI","SUL","TRI","VI","XAN"],
  ["BI","CA","CE","CEPH","DI","GA","GU","LA","LI","LO","ME","NO","PHA","RO","TA","TI"],
  ["A","ALIS","ATA","ATUS","CEPS","CULUS","ENSIS","EUS","IDA","ICA","INA","INUS","IS","OIDES","OLA","ONOTUS","OPTERA","OSA","OSUS","RA","URUS","US","ENS","ANS","IA"],
];
let BIRD_SYLLABLE_FREQ = null;

function binomen(){
  let d = BIRD_SYLLABLES;
  let f = BIRD_SYLLABLE_FREQ || [];
  let name = choice(d[0],f[0]);
  let n = ~~(rand()*2.2);
  for (let i = 0; i < n; i++) name += choice(d[1],f[1]);
  name += choice(d[2],f[2]);
  name += ' ';
  name += choice(d[3],f[3]);
  n = ~~(rand()*2.2);
  for (let i = 0; i < n; i++) name += choice(d[4],f[4]);
  name += choice(d[5],f[5]);
  name = name.replace(/([A-Z])\1\1+/g,'$1$1');
  return name[0]+name.slice(1).toLowerCase();
}

// ===== output stage (adapted from fishdraw: parameterised frame size) =====

function frame_fit(bbox,pad=20,text=false,W=FRAME_W,H=FRAME_H){
  let w = (W-pad*2);
  let h = (H-pad*2) - (text?10:0);
  let s = Math.min(w/bbox.w, h/bbox.h);
  return {s, x:bbox.x, y:bbox.y, px:(w-bbox.w*s)/2, py:(h-bbox.h*s)/2, pad};
}

function fit_pt(f,x,y){
  return [(x-f.x)*f.s+f.px+f.pad, (y-f.y)*f.s+f.py+f.pad];
}

function apply_fit(polylines,f){
  for (let i = 0; i < polylines.length; i++){
    for (let j = 0; j < polylines[i].length; j++){
      let [x,y] = polylines[i][j];
      polylines[i][j] = fit_pt(f,x,y);
    }
  }
  return polylines;
}

function caption_lines(text,pad=20,W=FRAME_W,H=FRAME_H){
  let [tw,tp] = put_text(text);
  tp = tp.map(p=>scl_poly(shr_poly(p,-0.3),0.3,0.3));
  tw *= 0.3;
  return tp.map(p=>trsl_poly(p,W/2-tw/2,H-pad+5));
}

function reframe(polylines,pad=20,text=null,W=FRAME_W,H=FRAME_H){
  apply_fit(polylines,frame_fit(get_bbox(polylines.flat()),pad,!!text,W,H));
  if (text){
    polylines.push(...caption_lines(text,pad,W,H));
  }
  return polylines;
}

function cleanup(polylines){
  for (let i = polylines.length-1; i >= 0; i--){
    polylines[i] = approx_poly_dp(polylines[i],0.1);
    for (let j = 0; j < polylines[i].length; j++){
      for (let k = 0; k < polylines[i][j].length; k++){
        polylines[i][j][k] = ~~(polylines[i][j][k]*10000)/10000;
      }
    }
    if (polylines[i].length < 2){
      polylines.splice(i,1);
      continue;
    }
    if (polylines[i].length == 2){
      if (dist(...polylines[i][0],...polylines[i][1]) < 0.9){
        polylines.splice(i,1);
        continue;
      }
    }
  }
  return polylines;
}

function draw_svg(polylines,W=FRAME_W,H=FRAME_H){
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="${W+20}" height="${H+20}">`;
  o += `<rect x="0" y="0" width="${W+20}" height="${H+20}" fill="floralwhite"/><rect x="10" y="10" width="${W}" height="${H}" stroke="black" stroke-width="1" fill="none"/><path stroke="black" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round" d="`;
  for (let i = 0; i < polylines.length; i++){
    o += '\nM ';
    for (let j = 0; j < polylines[i].length; j++){
      let [x,y] = polylines[i][j];
      o += `${(~~((x+10)*100))/100} ${(~~((y+10)*100))/100} `;
    }
  }
  o += `\n"/></svg>`;
  return o;
}

function draw_svg_anim(polylines,speed,W=FRAME_W,H=FRAME_H){
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="${W+20}" height="${H+20}">`;
  o += `<rect x="0" y="0" width="${W+20}" height="${H+20}" fill="floralwhite"/><rect x="10" y="10" width="${W}" height="${H}" stroke="black" stroke-width="1" fill="none"/>`;
  let lengths = [];
  let acc_lengths = [];
  let total_l = 0;
  for (let i = 0; i < polylines.length; i++){
    let l = 0;
    for (let j = 1; j < polylines[i].length; j++){
      l += Math.hypot(polylines[i][j-1][0]-polylines[i][j][0], polylines[i][j-1][1]-polylines[i][j][1]);
    }
    lengths.push(l);
    acc_lengths.push(total_l);
    total_l += l;
  }
  for (let i = 0; i < polylines.length; i++){
    let l = lengths[i];
    let t = speed*l;
    o += `
    <path transform="translate(10,10)" stroke="black" stroke-width="1" fill="none" stroke-dasharray="${l}" stroke-dashoffset="${l}" d="M${polylines[i].map(p=>p.join(' ')).join(' L')}">
      <animate id="a${i}" attributeName="stroke-dashoffset" fill="freeze" from="${l}" to="0" dur="${t}s" begin="${acc_lengths[i]*speed}s;a${i}.end+${8+speed*total_l-t}s"/>
      <animate id="b${i}" attributeName="stroke-dashoffset" fill="freeze" from="0" to="${l}" dur="3s" begin="${5+speed*total_l}s;b${i}.end+${5+speed*total_l}s"/>
    </path>`;
  }
  o += `</svg>`;
  return o;
}

function draw_ps(polylines,W=FRAME_W,H=FRAME_H){
  let o = `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 ${W+20} ${H+20}
1 setlinewidth
0.5 0.5 translate
/m /moveto load def
/l /lineto load def
/F /stroke load def
%%EndPageSetup
10 10 m
${W+10} 10 l
${W+10} ${H+10} l
10 ${H+10} l
closepath
F
`;
  for (let i = 0; i < polylines.length; i++){
    for (let j = 0; j < polylines[i].length; j++){
      let [x,y] = polylines[i][j];
      o += `${(~~((x+10)*100))/100} ${(~~((H+10-y)*100))/100} ${j==0?'m':'l'}\n`;
    }
    o += `F\n\n`;
  }
  return o;
}

// ===== idle animation: cached rig =====
// Geometry is built once and only transformed per frame, so hatching and
// plumage stick to the surface instead of swimming. Clipping commutes with any
// continuous bijective map applied to both lines and masks, so parts that share
// a motion group keep their mutual occlusion from a one-off pre-clip; per frame
// we only clip against masks of parts in other groups.

let D2R = PI/180;

function make_rng(s){
  let x = (str_to_seed(String(s)) >>> 0) || 0x9e3779b9;
  return ()=>{
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x/4294967296;
  };
}

function make_tri(rng){
  return (a,b,c)=>{
    if (c <= a) return b;
    let u = rng(), F = (b-a)/(c-a);
    return u < F ? a+Math.sqrt(u*(c-a)*(b-a)) : c-Math.sqrt((1-u)*(c-a)*(c-b));
  };
}

function densify(l,step){
  let o = [l[0]];
  for (let i = 1; i < l.length; i++){
    let a = l[i-1], b = l[i];
    let n = Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step);
    for (let k = 1; k < n; k++) o.push([a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n]);
    o.push(b);
  }
  return o;
}

function densify_poly(poly,step){
  return densify(closed(poly),step).slice(0,-1);
}

function chunk_line(l,maxlen){
  let out = [], cur = [l[0]], acc = 0;
  for (let i = 1; i < l.length; i++){
    acc += dist(...l[i-1],...l[i]);
    cur.push(l[i]);
    if (acc >= maxlen && i < l.length-1){
      out.push(cur);
      cur = [l[i]];
      acc = 0;
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

function prep_lines(lines){
  let o = [];
  for (let i = 0; i < lines.length; i++){
    let l = lines[i];
    if (!l || l.length < 2) continue;
    o.push(...chunk_line(densify(l,2),24));
  }
  return o;
}

function mask_item(poly,group){
  let n = poly.length;
  let e = new Float64Array(n*4);
  for (let i = 0; i < n; i++){
    let a = poly[i], b = poly[(i+1)%n];
    e[i*4] = a[0]; e[i*4+1] = a[1]; e[i*4+2] = b[0]; e[i*4+3] = b[1];
  }
  return {poly, bb:get_bbox(poly), group, e, n};
}

function inside_item(it,x,y){
  let e = it.e, c = false;
  for (let k = 0; k < it.n; k++){
    let x0 = e[k*4], y0 = e[k*4+1], x1 = e[k*4+2], y1 = e[k*4+3];
    if ((y0 > y) != (y1 > y) && x < (x1-x0)*(y-y0)/(y1-y0)+x0) c = !c;
  }
  return c;
}

// Pieces of polyline l outside the mask (same semantics as clip(l,poly).false,
// with per-edge bbox rejection and no per-edge allocation).
function clip_out(l,it){
  let e = it.e, n = it.n;
  let inside = inside_item(it,l[0][0],l[0][1]);
  let out = [];
  let cur = inside ? null : [l[0]];
  let ts = [];
  for (let i = 0; i+1 < l.length; i++){
    let ax = l[i][0], ay = l[i][1], bx = l[i+1][0], by = l[i+1][1];
    let sx0 = Math.min(ax,bx), sx1 = Math.max(ax,bx), sy0 = Math.min(ay,by), sy1 = Math.max(ay,by);
    let dx = bx-ax, dy = by-ay;
    ts.length = 0;
    for (let k = 0; k < n; k++){
      let cx = e[k*4], cy = e[k*4+1], ex = e[k*4+2], ey = e[k*4+3];
      if ((cx < sx0 && ex < sx0) || (cx > sx1 && ex > sx1) || (cy < sy0 && ey < sy0) || (cy > sy1 && ey > sy1)) continue;
      let fx = ex-cx, fy = ey-cy;
      let den = dx*fy - dy*fx;
      if (!den) continue;
      let t = ((cx-ax)*fy - (cy-ay)*fx)/den;
      let u = ((cx-ax)*dy - (cy-ay)*dx)/den;
      if (t >= 0 && t < 1 && u >= 0 && u < 1) ts.push(t);
    }
    if (ts.length > 1) ts.sort((p,q)=>p-q);
    for (let j = 0; j < ts.length; j++){
      let p = [ax+dx*ts[j], ay+dy*ts[j]];
      inside = !inside;
      if (inside){
        cur.push(p);
        if (cur.length > 1) out.push(cur);
        cur = null;
      }else{
        cur = [p];
      }
    }
    if (!inside) cur.push(l[i+1]);
  }
  if (cur && cur.length > 1) out.push(cur);
  return out;
}

function FastOccluder(items){
  this.items = items || [];
}
FastOccluder.prototype.add = function(poly){
  if (!poly || poly.length < 3) return;
  this.items.push(mask_item(poly));
};
FastOccluder.prototype.clip = function(lines){
  let out = [];
  for (let k = 0; k < lines.length; k++){
    let l = lines[k];
    if (!l || l.length < 2) continue;
    let cur = [l];
    let bb = get_bbox(l);
    for (let i = 0; i < this.items.length && cur.length; i++){
      let it = this.items[i];
      if (!bbox_overlap(bb,it.bb)) continue;
      let next = [];
      for (let j = 0; j < cur.length; j++){
        if (cur.length > 1 && !bbox_overlap(get_bbox(cur[j]),it.bb)) next.push(cur[j]);
        else next.push(...clip_out(cur[j],it));
      }
      cur = next;
    }
    out.push(...cur);
  }
  return out;
};

function occ_items(items){
  return new FastOccluder(items);
}

function split_pred(l,keep){
  let out = [], cur = [];
  for (let i = 0; i < l.length; i++){
    if (keep(l[i][0],l[i][1])){
      cur.push(l[i]);
    }else{
      if (cur.length > 1) out.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

function map_cull(lines,f){
  let out = [];
  for (let i = 0; i < lines.length; i++){
    let cur = [];
    for (let j = 0; j < lines[i].length; j++){
      let q = f(lines[i][j]);
      if (q){
        cur.push(q);
      }else{
        if (cur.length > 1) out.push(cur);
        cur = [];
      }
    }
    if (cur.length > 1) out.push(cur);
  }
  return out;
}

let MASK_STEP = {static:0, wing:0, tail:0, body:3, head:2, crest:2};

function anim_rig(rig,opts={}){
  let m = rig.meta, L = rig.legacy;
  let P = (name,group,p)=>({name, group, lines:p.lines, masks:p.masks});
  // with flaps the legs leave the perch, so they need their own group
  let lg = opts.flap ? 'legs' : 'static';
  let parts = [];
  if (opts.flap) parts.push(P('wing_open','wing_open',{lines:[], masks:[]}));
  parts.push(
    P('near_front',lg,L[0]),
    P('beak','head',L[1]),
    P('eye','head',L[2]),
    P('head','head',{lines:L[3].lines.slice(m.n_seam,m.n_end), masks:[m.hp]}),
  );
  if (m.crest) parts.push(P('crest','crest',{lines:m.crest.lines, masks:[m.crest.poly]}));
  parts.push(
    P('wing','wing',L[4]),
    P('body','body',L[5]),
    P('near_tarsus',lg,L[6]),
    P('perch','static',L[7]),
    P('near_hallux',lg,L[8]),
    P('tail','tail',{lines:[], masks:[]}),
    P('far_tarsus',lg,L[10]),
    P('far_front',lg,L[11]),
    P('far_hallux',lg,L[12]),
  );
  for (let i = 0; i < parts.length; i++){
    let p = parts[i];
    let step = MASK_STEP[p.group];
    if (step && p.name != 'head') p.masks = p.masks.map(mk=>densify_poly(mk,step));
  }
  for (let i = 0; i < parts.length; i++){
    let p = parts[i];
    let items = [];
    for (let j = 0; j < i; j++){
      if (parts[j].group != p.group) continue;
      for (let k = 0; k < parts[j].masks.length; k++) items.push(mask_item(parts[j].masks[k]));
    }
    p.lines = occ_items(items).clip(prep_lines(p.lines));
  }
  let tail = m.tail_raw.map(f=>({kind:f.kind, i:f.i, poly:f.poly, lines:prep_lines(f.lines)}));

  // cross-group candidates: front parts whose rest bbox, grown by the largest
  // plausible idle displacement, can ever overlap this part
  let grow = m.BL*0.2;
  let pbb = parts.map((p,i)=>{
    let pts = p.masks.flat().concat(p.lines.flat());
    if (p.group == 'tail') pts = tail.map(f=>f.poly).flat();
    if (!pts.length) return null;
    let b = get_bbox(pts);
    return {x:b.x-grow, y:b.y-grow, w:b.w+grow*2, h:b.h+grow*2};
  });
  for (let i = 0; i < parts.length; i++){
    parts[i].cand = [];
    for (let j = 0; j < i; j++){
      // a flap moves parts far from their rest boxes; the occluder's own bbox test still culls
      if (opts.flap || (pbb[i] && pbb[j] && bbox_overlap(pbb[i],pbb[j]))) parts[i].cand.push(j);
    }
  }
  let body_outline = parts.find(p=>p.name == 'body').masks[0];
  let wopen = opts.flap ? wing_open_build(rig.arg,m.BL) : null;
  return {rig, meta:m, arg:rig.arg, parts, tail, body_outline, wopen};
}

// ===== idle animation: open wing for flaps =====
// An articulated wing: every feather is a rigid shape attached to the humerus,
// ulna or manus. Joint angles move between folded (e = 0) and spread (e = 1);
// in the spread pose the primaries fan from the hand and the secondaries hang
// off the forearm. The planform (u outward along the span, v back along the
// chord) is then projected through the stroke angle.
function wing_open_build(arg,BL){
  let WL = BL*arg.wing_ratio;
  let style = arg.wing_style;
  let flight = {tertial:1, secondary:1, primary:1};
  let feathers = [];
  let add = (group,bone,t,len,w,dopen,dfold,fwd,o={})=>{
    let opt = Object.assign({
      tip:'round',
      asym: group == 'primary' ? 0.35 : 0.45,
      bend: (group == 'primary' ? 0.015 : 0.03) + deviate(0.01),
      barbs: flight[group] ? arg.barb_density*(group == 'primary' ? 0.3 : 1) : 0,
      slant: 0.1, n: 14,
    },o);
    if (group == 'primary' && arg.emarg) opt.emarg = 0.62;
    if (style == 'wingbars' && (group == 'greater' || group == 'median')){
      opt.dark = 1; opt.dark_len = 0.68; opt.dark_w = 0.85;
    }else if (style == 'dark_centers' && (group == 'tertial' || group == 'greater' || group == 'median')){
      opt.dark = 1; opt.dark_len = 0.82; opt.dark_w = 0.55;
    }else if (style == 'dark_flight' && flight[group]){
      opt.dark = 1; opt.dark_len = 0.95; opt.dark_w = 0.85; opt.dark_step = group == 'primary' ? 4 : 2.4;
    }else if (style == 'barred' && flight[group]){
      opt.bars = WL*0.07;
    }
    let fe = feather([0,0],[len,0],w,opt);
    feathers.push({group, bone, t, dopen:dopen*D2R, dfold:dfold*D2R, fwd:fwd*WL, poly:fe.poly, lines:fe.lines});
  };
  let np = arg.n_primaries, ns = arg.n_secondaries, nt = arg.n_tertials;
  let fr = (k,n)=>n > 1 ? k/(n-1) : 0;
  let Lp = k=>WL*0.72*(0.7+0.3*smoothstep(0,0.75,fr(k,np)))*(fr(k,np) > 0.95 ? 0.95 : 1);
  let Ls = WL*0.42;
  let sec_t = k=>1-0.95*fr(k,ns);
  let sec_d = k=>85+lerp(-12,6,fr(k,ns));
  let pri_d = k=>10+lerp(80,4,fr(k,np));
  // front to back; on each row the feather nearer the body lies on top
  let nl = 10;
  for (let k = 0; k < nl; k++){
    let s = k/(nl-1);
    add('lesser', s < 0.45 ? 0 : 1, s < 0.45 ? 0.15+s/0.45*0.85 : (s-0.45)/0.55, WL*0.13, WL*0.07, 85, 92, 0.07);
  }
  for (let k = ns-1; k >= 0; k--) add('median',1,sec_t(k),WL*0.2,WL*0.065,sec_d(k),92,0.045);
  for (let j = 0; j < 3; j++) add('alula',2,0.05+0.05*j,WL*(0.16+0.03*j),WL*0.035,-5+4*j,93,0.01,{tip:'pointed'});
  for (let k = ns-1; k >= 0; k--) add('greater',1,sec_t(k),Ls*0.5,WL*0.07,sec_d(k),92,0.02);
  for (let k = 0; k < np; k++) add('pcov',2,fr(k,np),Lp(k)*0.32,WL*0.05,pri_d(k),93,0.015);
  for (let j = 0; j < nt; j++) add('tertial',0,lerp(0.6,0.95,fr(j,nt)),WL*0.42,WL*0.09,100-4*j,92,0);
  for (let k = ns-1; k >= 0; k--) add('secondary',1,sec_t(k),Ls*(0.94+0.06*fr(k,ns)),WL*0.075,sec_d(k),92+0.3*k,0);
  for (let k = 0; k < np; k++) add('primary',2,fr(k,np),Lp(k),WL*0.08,pri_d(k),94-0.3*k,0,{tip:'pointed'});
  return {WL, feathers};
}

// Places every open-wing feather for the pose: skeleton from the extension,
// then planform -> world through the stroke angle phi (90 deg = straight up).
// The stroke plane leans back at the top and forward at the bottom, as in takeoff.
function wing_open_maps(W,m,pose,post){
  let e = pose.ext, WL = W.WL;
  let ang = (open,fold)=>lerp(fold,open,e)*D2R;
  let a = [ang(20,95), ang(-5,-85), ang(10,95)];
  let L = [0.22*WL, 0.3*WL, 0.18*WL];
  let J = [[0,0]];
  for (let i = 0; i < 3; i++) J.push([J[i][0]+L[i]*Math.cos(a[i]), J[i][1]+L[i]*Math.sin(a[i])]);
  let cth = m.th*0.4;
  let C = [Math.cos(cth), Math.sin(cth)];
  let sp = 15*D2R, s = Math.sin(pose.phi);
  let U = [Math.sin(sp)*s + 0.15*C[0], -Math.cos(sp)*s + 0.15*C[1]];
  let O = m.shoulder;
  return k=>{
    let f = W.feathers[k];
    let d = lerp(f.dfold,f.dopen,e);
    let c = Math.cos(d), sn = Math.sin(d);
    let b = lerp2d(...J[f.bone],...J[f.bone+1],f.t);
    b = [b[0]-c*f.fwd, b[1]-sn*f.fwd];
    return p=>{
      let u = b[0] + p[0]*c - p[1]*sn, v = b[1] + p[0]*sn + p[1]*c;
      return post([O[0] + u*U[0] + v*C[0], O[1] + u*U[1] + v*C[1]]);
    };
  };
}

// ===== idle animation: motion maps =====

function body_tb(m,x){
  let n = m.c0.length;
  let fi = clamp((x+m.BL/2)/m.BL,0,1)*(n-1);
  let i0 = Math.min(n-2,Math.floor(fi)), f = fi-i0;
  return [lerp(m.c0[i0][1],m.c0[i0+1][1],f), lerp(m.c1[i0][1],m.c1[i0+1][1],f)];
}

// Inspiration swings the sternum ventrally and cranially about the shoulder
// girdle (pump handle); the back, synsacrum and hip stay put.
function breath_disp(m,q,amp){
  if (!amp) return [0,0];
  let u = (q[0]+m.BL/2)/m.BL;
  let [top,bot] = body_tb(m,q[0]);
  let v = clamp((q[1]-top)/Math.max(1e-6,bot-top),0,1);
  let w = Math.pow(smoothstep(0.15,1,v),1.3)*Math.exp(-Math.pow((u-0.48)/0.3,2));
  let k = amp*m.BH*w;
  return [-0.25*k,k];
}

// 2.5D head: points inside the head silhouette are lifted onto an ellipsoid
// (skulls are laterally narrow, so c < a), everything else (beak, crest,
// bristles) lies in the midsagittal plane z = 0. Rotation is about the
// atlanto-occipital joint, posterior-ventral of the skull centre.
function head_map(m,pose){
  let a = m.HR*1.04, b = m.HR, c = m.HR*0.8;
  let cy = Math.cos(pose.yaw), sy = Math.sin(pose.yaw);
  let cr = Math.cos(pose.roll), sr = Math.sin(pose.roll);
  let cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch);
  let rot = (X,Y,Z)=>{
    let x1 = X*cy + Z*sy, z1 = -X*sy + Z*cy;
    let y2 = Y*cr - z1*sr, z2 = Y*sr + z1*cr;
    return [x1*cp - y2*sp, x1*sp + y2*cp, z2];
  };
  let inv = (X,Y,Z)=>{
    let x1 = X*cp + Y*sp, y1 = -X*sp + Y*cp;
    let y2 = y1*cr + Z*sr, z2 = -y1*sr + Z*cr;
    return [x1*cy - z2*sy, y2, x1*sy + z2*cy];
  };
  let K = [0.3*a, 0.45*b];
  let rk = rot(-K[0],-K[1],0);
  let cc = [rk[0]+K[0], rk[1]+K[1]];
  let d = inv(0,0,1);
  let qa = (d[0]/a)*(d[0]/a) + (d[1]/b)*(d[1]/b) + (d[2]/c)*(d[2]/c);
  let hc = m.hc;
  let ident = !pose.yaw && !pose.roll && !pose.pitch;
  let proj = (x,y,z)=>{
    let r = rot(x-K[0],y-K[1],z);
    return [hc[0]+r[0]+K[0], hc[1]+r[1]+K[1]];
  };
  let f = (p,cull)=>{
    if (ident) return [p[0],p[1]];
    let x = p[0]-hc[0], y = p[1]-hc[1];
    let r2 = (x/a)*(x/a) + (y/b)*(y/b);
    if (r2 < 1){
      let z = c*Math.sqrt(1-r2);
      if (cull){
        let n = rot(x/(a*a), y/(b*b), z/(c*c));
        if (n[2] < -1e-9) return null;
      }
      return proj(x,y,z);
    }
    if (cull){
      let qb = 2*(x*d[0]/(a*a) + y*d[1]/(b*b));
      let disc = qb*qb - 4*qa*(r2-1);
      if (disc >= 0 && -qb/(2*qa) > 0) return null;
    }
    return proj(x,y,0);
  };
  let sx = Math.sqrt(cy*cy + (c/a)*(c/a)*sy*sy);
  let sy2 = Math.sqrt(cr*cr + (c/b)*(c/b)*sr*sr);
  let sil = p=>{
    let x = (p[0]-hc[0])*sx, y = (p[1]-hc[1])*sy2;
    return [hc[0]+cc[0]+x*cp-y*sp, hc[1]+cc[1]+x*sp+y*cp];
  };
  return {f, sil};
}

function anim_maps(A,pose){
  let m = A.meta;
  let ct = Math.cos(m.th), st = Math.sin(m.th);
  let to_body = p=>[p[0]*ct+p[1]*st, -p[0]*st+p[1]*ct];
  let from_body = q=>[q[0]*ct-q[1]*st, q[0]*st+q[1]*ct];
  let tee = pose.teeter, hop = pose.hop || 0, tilt = pose.tilt || 0;
  let post = (tee || hop || tilt) ? (p=>{
    let q = tee ? rot_pt(p,-tee,m.H[0],m.H[1]) : p;
    if (tilt) q = rot_pt(q,tilt,m.H[0],m.H[1]);
    return hop ? [q[0],q[1]-hop] : q;
  }) : (p=>p);
  // the feet stay on the perch through the takeoff crouch and landing
  let lh = Math.max(0,hop);
  let legs = lh ? (p=>[p[0],p[1]-lh]) : (p=>p);
  let amp = pose.breath;
  let body = p=>{
    if (!amp) return post(p);
    let d = from_body(breath_disp(m,to_body(p),amp));
    return post([p[0]+d[0],p[1]+d[1]]);
  };
  // the folded wing rides rigidly on the flank: it follows the ribcage at the
  // mid-flank with a fraction of the belly displacement, pivoting at the shoulder
  let [tq,bq] = body_tb(m,-m.BL*0.05);
  let dw = from_body(breath_disp(m,[-m.BL*0.05,lerp(tq,bq,0.6)],amp));
  let wa = -0.3*D2R*amp/0.025;
  let S = m.shoulder;
  // a wing flick lifts the tip (negative rotation raises the tail-ward end)
  let wl = wa - (pose.wing || 0);
  let wing = p=>{
    if (!amp && !wl) return post(p);
    let q = rot_pt(p,wl,S[0],S[1]);
    return post([q[0]+dw[0]*0.3, q[1]+dw[1]*0.3]);
  };
  let hm = head_map(m,pose);
  let head_c = p=>{ let q = hm.f(p,true); return q && post(q); };
  let head = p=>post(hm.f(p,false));
  let sil = p=>post(hm.sil(p));
  let cb = m.crest ? m.crest.base : [0,0];
  let crest_c = p=>head_c(pose.crest ? rot_pt(p,pose.crest,cb[0],cb[1]) : p);
  let crest = p=>head(pose.crest ? rot_pt(p,pose.crest,cb[0],cb[1]) : p);
  let TP = m.tail_pivot;
  let tail = f=>{
    let a = f.kind == 'rect'
      ? -pose.tail + f.i*0.045*pose.spread
      : -pose.tail*(f.kind == 'upper_cov' ? 0.35 : 0.25);
    return a ? (p=>post(rot_pt(p,a,TP[0],TP[1]))) : post;
  };
  let wing_open = A.wopen && pose.flap ? wing_open_maps(A.wopen,m,pose,post) : null;
  return {static:p=>p, legs, body, wing, head, head_c, sil, crest, crest_c, tail, wing_open};
}

// Eye overlays, built in head-local 2D before the head map.
// Nictitating membrane: translucent, sweeps from the anterior (nasal) corner
// backward and slightly down. Eyelid: lower lid in most birds, upper in owls.
function eye_overlay(m,pose,lines){
  let ex = m.E[0], ey = m.E[1], R = m.ER;
  let out = {lines, extra:[]};
  let lid = pose.lid;
  if (lid > 0.01){
    let upper = pose.lid_upper;
    let edge = dx=>-1.05 + 2.1*lid + 0.25*(1-dx*dx)*Math.min(1,lid*3);
    let rr = 1.15;
    let covered = (x,y)=>{
      let dx = (x-ex)/R, dy = (y-ey)/R;
      if (dx*dx+dy*dy > rr*rr) return false;
      return upper ? dy < edge(dx) : -dy < edge(dx);
    };
    out.lines = [];
    for (let i = 0; i < lines.length; i++) out.lines.push(...split_pred(lines[i],(x,y)=>!covered(x,y)));
    let el = [];
    for (let dx = -rr; dx <= rr+1e-9; dx += 0.05){
      let dy = upper ? edge(dx) : -edge(dx);
      if (dx*dx+dy*dy <= rr*rr){
        el.push([ex+dx*R, ey+dy*R]);
      }else{
        if (el.length > 1) out.extra.push(el);
        el = [];
      }
    }
    if (el.length > 1) out.extra.push(el);
    for (let k = -1.1; k <= 1.1; k += Math.max(0.32,2.2/R)){
      let hl = [];
      for (let dx = -rr; dx <= rr; dx += 0.08) hl.push([ex+dx*R, ey+k*R]);
      out.extra.push(...split_pred(hl,(x,y)=>{
        if (!covered(x,y)) return false;
        let dx = (x-ex)/R, dy = (y-ey)/R;
        return Math.abs(dy-(upper ? edge(dx) : -edge(dx))) > 0.12;
      }));
    }
  }
  let nn = pose.nict;
  if (nn > 0.01){
    let ca = Math.cos(0.26), sa = Math.sin(0.26);
    let ue = v=>-1.3 + 2.6*nn + 0.3*(1-v*v);
    let cov = (x,y)=>{
      let dx = (x-ex)/R, dy = (y-ey)/R;
      if (dx*dx+dy*dy > 1) return false;
      return dx*ca+dy*sa < ue(-dx*sa+dy*ca);
    };
    let el = [];
    for (let v = -1.2; v <= 1.2; v += 0.05){
      let u = ue(v);
      let dx = u*ca - v*sa, dy = u*sa + v*ca;
      if (dx*dx+dy*dy <= 1){
        el.push([ex+dx*R, ey+dy*R]);
      }else{
        if (el.length > 1) out.extra.push(el);
        el = [];
      }
    }
    if (el.length > 1) out.extra.push(el);
    for (let k = -2; k <= 2; k += Math.max(0.3,2.6/R)){
      let hl = [];
      for (let t = -1.2; t <= 1.2; t += 0.06) hl.push([ex+t*R, ey+(t+k)*R]);
      out.extra.push(...split_pred(hl,cov));
    }
  }
  return out;
}

// ===== idle animation: renderers =====

function anim_frame(A,pose,painter){
  let m = A.meta;
  let mp = anim_maps(A,pose);
  let out = [];
  for (let i = 0; i < A.parts.length; i++){
    let p = A.parts[i];
    let fr = {name:p.name, group:p.group, cand:p.cand, lines:[], dyn:[], masks:[]};
    let g = p.group;
    if (g == 'wing_open' || (p.name == 'wing' && pose.flap)){
      if (g == 'wing_open' && mp.wing_open){
        fr.feathers = A.wopen.feathers.map((f,k)=>{
          let fn = mp.wing_open(k);
          return {poly:f.poly.map(fn), lines:map_lines(f.lines,fn)};
        });
        if (!painter){
          let occ = new FastOccluder();
          for (let k = 0; k < fr.feathers.length; k++){
            fr.lines.push(...occ.clip(fr.feathers[k].lines));
            occ.add(fr.feathers[k].poly);
          }
        }
        fr.masks = fr.feathers.map(f=>f.poly);
      }
    }else if (g == 'tail'){
      fr.feathers = A.tail.map(f=>{
        let fn = mp.tail(f);
        return {poly:f.poly.map(fn), lines:map_lines(f.lines,fn)};
      });
      if (!painter){
        let occ = new FastOccluder();
        for (let k = 0; k < fr.feathers.length; k++){
          fr.lines.push(...occ.clip(fr.feathers[k].lines));
          occ.add(fr.feathers[k].poly);
        }
      }
      fr.masks = fr.feathers.map(f=>f.poly);
    }else if (g == 'head' || g == 'crest'){
      let fc = g == 'head' ? mp.head_c : mp.crest_c;
      let fm = g == 'head' ? mp.head : mp.crest;
      let src = p.lines;
      if (p.name == 'eye'){
        let ov = eye_overlay(m,pose,src);
        src = ov.lines;
        fr.dyn.push(...map_cull(ov.extra,fc));
      }
      fr.lines = map_cull(src,fc);
      if (p.name == 'head'){
        fr.masks = p.masks.map(mk=>mk.map(mp.sil));
        let bo = A.body_outline.map(mp.body);
        fr.dyn.push(...clip(closed(fr.masks[0]),bo).false);
      }else{
        fr.masks = p.masks.map(mk=>mk.map(fm));
      }
    }else{
      let fn = mp[g];
      fr.lines = map_lines(p.lines,fn);
      fr.masks = p.masks.map(mk=>mk.map(fn));
    }
    out.push(fr);
  }
  return out;
}

// Exact hidden-line render in world space (before facing flip and framing).
function render_world(A,pose){
  let fr = anim_frame(A,pose,false);
  let items = fr.map(p=>p.masks.map(mk=>mask_item(mk,p.group)));
  let out = [];
  for (let i = 0; i < fr.length; i++){
    let p = fr[i];
    let cross = [], all = [];
    for (let k = 0; k < p.cand.length; k++){
      let j = p.cand[k];
      all.push(...items[j]);
      if (fr[j].group != p.group) cross.push(...items[j]);
    }
    out.push(...occ_items(cross).clip(p.lines));
    if (p.dyn.length) out.push(...occ_items(all).clip(p.dyn));
  }
  return out;
}

function anim_fin(A){
  let f = A.fit, flip = A.arg.facing;
  return p=>fit_pt(f, flip ? -p[0] : p[0], p[1]);
}

function render_exact(A,pose){
  let fin = anim_fin(A);
  let out = render_world(A,pose).map(l=>l.map(p=>{
    let q = fin(p);
    return [Math.round(q[0]*100)/100, Math.round(q[1]*100)/100];
  }));
  return out.concat(A.caption);
}

// Painter's algorithm: back to front, fill each mask with paper then stroke.
// Visibly identical to render_exact, but needs no clipping.
function render_ops(A,pose){
  let fin = anim_fin(A);
  let fr = anim_frame(A,pose,true);
  let ops = [];
  let F = ls=>ls.map(l=>l.map(fin));
  for (let i = fr.length-1; i >= 0; i--){
    let p = fr[i];
    if (p.feathers){
      for (let k = p.feathers.length-1; k >= 0; k--){
        ops.push({fill:F([p.feathers[k].poly])}, {stroke:F(p.feathers[k].lines)});
      }
      continue;
    }
    ops.push({fill:F(p.masks)}, {stroke:F(p.lines.concat(p.dyn))});
  }
  ops.push({stroke:A.caption});
  return ops;
}

// ===== idle animation: behaviour =====
// Per-archetype temperament. mass (g) drives resting breathing rate through
// f = 17.2 M^-0.31 breaths/min (Lasiewski & Calder 1971). sacc = head saccades
// per second; yaw/roll/pitch = fixation spread in degrees; style 'pan' = slow
// smooth owl head turns instead of saccades; blink = spontaneous blinks per
// second; couple = probability a saccade carries a blink (Yorzinski 2016);
// tail = tail-motion style weights, trate = events per second, tamp = degrees;
// wflick = wing-flick bouts per second (kinglets and flycatchers flick often).
let TEMPERAMENT = {
  finch:      {mass:25,  sacc:1.4,  yaw:15, roll:12, pitch:8,  blink:0.12, couple:0.4, tail:{flick:2,pump:1,none:1}, trate:0.2,  tamp:10, wflick:0.08},
  sparrow:    {mass:30,  sacc:1.2,  yaw:15, roll:12, pitch:8,  blink:0.12, couple:0.4, tail:{flick:2,none:2},        trate:0.2,  tamp:9,  wflick:0.08},
  warbler:    {mass:10,  sacc:2.0,  yaw:16, roll:12, pitch:8,  blink:0.15, couple:0.4, tail:{flick:3,pump:1},        trate:0.35, tamp:12, wflick:0.3},
  thrush:     {mass:80,  sacc:0.6,  yaw:14, roll:20, pitch:10, blink:0.1,  couple:0.45,tail:{flick:2,none:1},        trate:0.15, tamp:9,  wflick:0.05},
  corvid:     {mass:400, sacc:0.7,  yaw:16, roll:22, pitch:10, blink:0.1,  couple:0.5, tail:{none:2,flick:1},        trate:0.1,  tamp:7,  wflick:0.05},
  raptor:     {mass:800, sacc:0.25, yaw:20, roll:12, pitch:8,  blink:0.08, couple:0.5, tail:{none:3,flick:1},        trate:0.06, tamp:6,  wflick:0.03},
  parrot:     {mass:300, sacc:0.4,  yaw:16, roll:25, pitch:10, blink:0.1,  couple:0.4, tail:{none:2,flick:1},        trate:0.08, tamp:6,  wflick:0.05},
  kingfisher: {mass:40,  sacc:0.4,  yaw:12, roll:10, pitch:8,  blink:0.1,  couple:0.4, tail:{pump:2,flick:1},        trate:0.2,  tamp:10, wflick:0.05},
  owl:        {mass:400, sacc:0.15, yaw:35, roll:15, pitch:8,  blink:0.08, couple:0.2, tail:{none:1},                trate:0,    tamp:0,  wflick:0.02,
               style:'pan', lid:'upper', lid_rest:[0.15,0.3,0.5]},
  swallow:    {mass:20,  sacc:1.0,  yaw:12, roll:10, pitch:6,  blink:0.12, couple:0.4, tail:{none:2,flick:1},        trate:0.1,  tamp:6,  wflick:0.1},
  wader:      {mass:100, sacc:0.6,  yaw:14, roll:10, pitch:8,  blink:0.1,  couple:0.4, tail:{teeter:1,pump:1},       trate:0.15, tamp:8,  wflick:0.06},
};

// Movement channels that can be switched on or off; wing flicks and flaps are opt-in.
let ANIM_MOVES = {breath:true, head:true, blink:true, tail:true, crest:true, wing:false, flap:false};

// "head,blink" = only those; "+wing,-tail" = defaults with changes; also "all", "none".
function parse_moves(s){
  let toks = String(s || '').split(/[,\s]+/).filter(Boolean);
  let rel = toks.every(t=>/^[+-]/.test(t));
  let m = {};
  for (let k in ANIM_MOVES) m[k] = rel ? ANIM_MOVES[k] : false;
  for (let t of toks){
    let name = t.replace(/^[+-]/,'');
    if (name == 'all' || name == 'none'){
      for (let k in m) m[k] = name == 'all';
      continue;
    }
    if (!(name in ANIM_MOVES)) throw new Error(`unknown movement "${name}"; use ${Object.keys(ANIM_MOVES).join(', ')}`);
    m[name] = !t.startsWith('-');
  }
  return m;
}

function anim_params(arg,seed,intensity=0.7){
  let rng = make_rng(seed+'#anim');
  let tri = make_tri(rng);
  let mix = arg.archetype_mix || [String(arg.archetype).replace('+',''),null,0];
  let TA = TEMPERAMENT[mix[0]] || TEMPERAMENT.finch;
  let TB = mix[1] ? TEMPERAMENT[mix[1]] : null;
  let bw = mix[2] || 0;
  let num = k=>TB ? lerp(TA[k],TB[k],bw) : TA[k];
  let src = (TB && rng() < bw) ? TB : TA;
  let pick = obj=>{
    let ks = Object.keys(obj), s = ks.reduce((a,k)=>a+obj[k],0), r = rng()*s;
    for (let i = 0; i < ks.length; i++){ r -= obj[ks[i]]; if (r <= 0) return ks[i]; }
    return ks[ks.length-1];
  };
  let mass = num('mass')*tri(0.8,1,1.25);
  let style = src.style || 'saccade';
  let lid_upper = src.lid == 'upper';
  let ap = {
    intensity,
    mass,
    breath_f: 17.2*Math.pow(mass/1000,-0.31)/60,
    breath_amp: 0.025*intensity*tri(0.8,1,1.2),
    breath_phase: rng(),
    style,
    sacc_rate: num('sacc')*tri(0.7,1,1.3),
    yaw: Math.min(num('yaw')*intensity*tri(0.8,1,1.2), style == 'pan' ? 35 : 25)*D2R,
    roll: Math.min(num('roll')*intensity*tri(0.8,1,1.2), 25)*D2R,
    pitch: num('pitch')*intensity*tri(0.8,1,1.2)*D2R,
    d0: 0.05,
    k: 0.003,
    blink_rate: num('blink')*tri(0.7,1,1.3),
    couple: num('couple'),
    lid_upper,
    lid_rest: src.lid_rest ? tri(...src.lid_rest) : 0,
    blink_dur: lid_upper ? tri(0.3,0.4,0.5) : tri(0.12,0.15,0.2),
    tail_style: pick(src.tail),
    tail_rate: num('trate')*tri(0.7,1,1.3),
    tail_amp: num('tamp')*intensity*tri(0.6,1,1.2)*D2R,
    tail_tau: tri(0.1,0.12,0.15),
    crest: !!arg.crest,
    wing_rate: num('wflick'),
    wing_amp: 9*intensity*D2R,
    BL: arg.body_length,
    flap_h: arg.body_length*0.4*(0.5+0.5*intensity),
  };
  return ap;
}

function rest_pose(ap){
  // same field order as pose_at, so both share one object shape
  return {breath:0, yaw:0, pitch:0, roll:0, crest:0, tail:0, spread:0, teeter:0, wing:0,
    nict:0, lid:ap ? ap.lid_rest : 0, lid_upper:ap ? ap.lid_upper : false,
    flap:0, phi:0, ext:0, hop:0, tilt:0};
}

// minimum-jerk position profile (Flash & Hogan 1985)
function min_jerk(t){
  t = clamp(t,0,1);
  return t*t*t*(10-15*t+6*t*t);
}

function make_timeline(ap,T,seed,moves=ANIM_MOVES){
  let mv = Object.assign({},ANIM_MOVES,moves);
  let rng = make_rng(seed+'#timeline');
  let tri = make_tri(rng);
  let expo = rate=>rate > 0 ? -Math.log(1-rng())/rate : Infinity;
  let wrap = t=>((t%T)+T)%T;

  let nb = Math.max(1,Math.round(ap.breath_f*T));

  // head: saccades between fixations, still in between, closing on g0
  let sample = ()=>[tri(-ap.yaw,0,ap.yaw), tri(-ap.pitch,0,ap.pitch), tri(-ap.roll,0,ap.roll)];
  let dur = (g0,g1)=>{
    let amp = Math.max(...g0.map((v,i)=>Math.abs(v-g1[i])))/D2R;
    return ap.style == 'pan' ? lerp(0.6,1.5,clamp(amp/35,0,1)) : ap.d0 + ap.k*amp;
  };
  let g0 = sample();
  let segs = [];
  let cur = g0, tend = rng()*0.3;
  for (;;){
    let t0 = tend + expo(ap.sacc_rate);
    let g = sample();
    let D = dur(cur,g);
    if (!(t0 + D + 0.15 + dur(g,g0) <= T - 0.1)) break;
    segs.push({t0, t1:t0+D, from:cur, to:g});
    cur = g;
    tend = t0+D;
  }
  if (segs.length){
    let D = dur(cur,g0);
    let t0 = Math.max(tend+0.15, T-0.1-D);
    segs.push({t0, t1:t0+D, from:cur, to:g0});
  }else{
    // slow-scanning birds may draw no move in a short loop; give them one look away and back
    let g = sample();
    let D1 = dur(g0,g), D2 = dur(g,g0), hold = tri(0.4,1,2);
    let span = D1+hold+D2;
    if (span <= T-0.2){
      let t0 = 0.1 + rng()*(T-0.2-span);
      segs.push({t0, t1:t0+D1, from:g0, to:g});
      segs.push({t0:t0+D1+hold, t1:t0+span, from:g, to:g0});
    }
  }
  let head_at = t=>{
    let g = g0;
    for (let i = 0; i < segs.length; i++){
      let s = segs[i];
      if (t < s.t0) break;
      if (t < s.t1){
        let k = min_jerk((t-s.t0)/(s.t1-s.t0));
        return s.from.map((v,j)=>lerp(v,s.to[j],k));
      }
      g = s.to;
    }
    return g;
  };

  // blinks: coupled to saccade onsets, plus spontaneous ones
  let blinks = [];
  for (let i = 0; i < segs.length; i++){
    if (rng() < ap.couple) blinks.push({t0:segs[i].t0, kind:ap.lid_upper ? 'lid' : 'nict', dur:ap.blink_dur});
  }
  for (let t = expo(ap.blink_rate); t < T; t += expo(ap.blink_rate)){
    let lower = !ap.lid_upper && rng() < 0.1;
    blinks.push({t0:t, kind:(ap.lid_upper || lower) ? 'lid' : 'nict', dur:lower ? 0.3 : ap.blink_dur});
  }
  blinks.sort((a,b)=>a.t0-b.t0);
  let kept = [];
  for (let i = 0; i < blinks.length; i++){
    let b = blinks[i], p = kept[kept.length-1];
    if (p && b.t0 < p.t0+p.dur+0.1) continue;
    if (kept.length && b.t0+b.dur+0.1 > T+kept[0].t0) continue;
    kept.push(b);
  }
  blinks = kept;
  let blink_shape = (b,t)=>{
    let tau = wrap(t-b.t0);
    if (tau >= b.dur) return 0;
    let f = tau/b.dur;
    return f < 0.4 ? min_jerk(f/0.4) : 1-min_jerk((f-0.4)/0.6);
  };

  // tail: alpha-function kernels (quick excursion, elastic return), wrapped
  let tails = [], bouts = [];
  if (ap.tail_style == 'pump' || ap.tail_style == 'flick'){
    let sgn = ap.tail_style == 'pump' ? -1 : 1;
    for (let t = expo(ap.tail_rate); t < T; t += expo(ap.tail_rate)){
      tails.push({t0:t, A:sgn*ap.tail_amp*tri(0.6,1,1.2)});
    }
  }else if (ap.tail_style == 'teeter'){
    for (let t = expo(0.3); t < T; t += expo(0.3)){
      bouts.push({t0:t, dur:tri(0.6,1,1.4), f:tri(2,3,4), A:4*D2R*ap.intensity*tri(0.7,1,1.2)});
    }
  }
  let tk = ap.tail_tau;
  let tail_at = t=>{
    let s = 0, a = 0;
    for (let i = 0; i < tails.length; i++){
      let tau = wrap(t-tails[i].t0);
      if (tau > 8*tk) continue;
      let k = tails[i].A*(tau/tk)*Math.exp(1-tau/tk);
      s += k;
      a += Math.abs(k);
    }
    return [s, 0.3*a/(12*D2R)];
  };
  let teeter_at = t=>{
    let s = 0;
    for (let i = 0; i < bouts.length; i++){
      let tau = wrap(t-bouts[i].t0);
      if (tau >= bouts[i].dur) continue;
      let h = Math.sin(PI*tau/bouts[i].dur);
      s += bouts[i].A*Math.sin(2*PI*bouts[i].f*tau)*h*h;
    }
    return s;
  };

  // crest: damped spring driven by head pitch acceleration (follow-through);
  // simulated over two loops and the second one kept so it is periodic
  let crest_s = null, dt = 1/480;
  if (ap.crest){
    let n = Math.max(2,Math.round(T/dt));
    let pitch = new Float64Array(n);
    for (let i = 0; i < n; i++) pitch[i] = head_at(i*T/n)[1];
    let h = T/n;
    let w = 2*PI*4, z = 0.35, g = 0.5;
    let x = 0, v = 0;
    crest_s = new Float64Array(n);
    for (let loop = 0; loop < 2; loop++){
      for (let i = 0; i < n; i++){
        let acc = (pitch[(i+1)%n]-2*pitch[i]+pitch[(i-1+n)%n])/(h*h);
        v += (-w*w*x - 2*z*w*v - g*acc)*h;
        x += v*h;
        if (loop == 1) crest_s[i] = clamp(x,-0.3,0.3);
      }
    }
  }
  let crest_at = t=>{
    if (!crest_s) return 0;
    let n = crest_s.length, fi = t/T*n, i0 = Math.floor(fi)%n, f = fi-Math.floor(fi);
    return lerp(crest_s[i0],crest_s[(i0+1)%n],f);
  };

  // wing flicks: the folded wing is briefly lifted at the tip and dropped back,
  // in bouts of 1-3 flicks at ~6 Hz; its own stream so other channels are unchanged
  let flicks = [];
  if (mv.wing){
    let wr = make_rng(seed+'#wing'), wt = make_tri(wr);
    let wexp = rate=>-Math.log(1-wr())/Math.max(rate,1e-3);
    let mk = t=>{
      let n = 1 + Math.floor(wr()*3), f = wt(5,6,7.5);
      return {t0:t, n, dur:n/f, A:ap.wing_amp*wt(0.7,1,1.2)};
    };
    for (let t = wexp(ap.wing_rate); t < T; t += wexp(ap.wing_rate)) flicks.push(mk(t));
    if (!flicks.length) flicks.push(mk(wr()*T));
  }
  // full flap: crouch and spread, a few wingbeats that lift the bird off the
  // perch, then fold and settle. Beats are slowed to 2.5-5 Hz (real takeoff
  // beats are 10-25 Hz in small birds) so they read at animation frame rates.
  // The downstroke is fully extended; the upstroke flexes the wrist.
  let flap = null;
  if (mv.flap){
    let fr = make_rng(seed+'#flap'), ft = make_tri(fr);
    let fb = clamp(5*Math.pow(ap.mass/20,-0.15),2.5,5);
    let nb = 2 + Math.floor(fr()*3);
    let tp = 0.18, tf = 0.25;
    if (tp + nb/fb + tf > T-0.3) nb = Math.max(1,Math.floor((T-0.3-tp-tf)*fb));
    let dur = tp + nb/fb + tf;
    flap = {t0:0.15 + fr()*Math.max(0,T-0.3-dur), nb, fb, tp, tf, dur, H:ap.flap_h*ft(0.8,1,1.2)};
  }
  let flap_at = t=>{
    let F = flap;
    let tau = F ? t-F.t0 : -1;
    if (!F || tau < 0 || tau >= F.dur) return {flap:0, phi:0, ext:0, hop:0, tilt:0};
    let top = 75*D2R, mid = 15*D2R, amp = 60*D2R, fold = 10*D2R;
    if (tau < F.tp){
      let k = min_jerk(tau/F.tp);
      return {flap:1, phi:lerp(fold,top,k), ext:k, hop:-0.04*ap.BL*Math.sin(PI*tau/F.tp), tilt:0};
    }
    tau -= F.tp;
    let Tb = F.nb/F.fb;
    if (tau < Tb){
      let psi = 2*PI*F.fb*tau, r = tau/Tb;
      let h = min_jerk(r/0.4) - min_jerk((r-0.65)/0.35);
      return {flap:1, phi:mid+amp*Math.cos(psi), ext:1-0.35*Math.max(0,-Math.sin(psi)), hop:F.H*h, tilt:8*D2R*h};
    }
    tau -= Tb;
    let k = min_jerk(tau/F.tf);
    return {flap:1, phi:lerp(top,fold,k), ext:1-k, hop:-0.03*ap.BL*Math.sin(PI*tau/F.tf), tilt:0};
  };

  let wing_at = t=>{
    let s = 0;
    for (let i = 0; i < flicks.length; i++){
      let tau = wrap(t-flicks[i].t0);
      if (tau >= flicks[i].dur) continue;
      s = Math.max(s, flicks[i].A*Math.pow(Math.sin(PI*flicks[i].n*tau/flicks[i].dur),2));
    }
    return s;
  };

  let pose_at = t=>{
    t = wrap(t);
    let ph = (t*nb/T + ap.breath_phase)%1;
    let b = ph < 0.45 ? (1-Math.cos(PI*ph/0.45))/2 : (1+Math.cos(PI*(ph-0.45)/0.55))/2;
    let [yaw,pitch,roll] = mv.head ? head_at(t) : [0,0,0];
    let nict = 0, lid = 0;
    for (let i = 0; i < (mv.blink ? blinks.length : 0); i++){
      let v = blink_shape(blinks[i],t);
      if (!v) continue;
      if (blinks[i].kind == 'nict') nict = Math.max(nict,v);
      else lid = Math.max(lid,v);
    }
    let lid_upper = ap.lid_upper;
    let [tail,spread] = mv.tail ? tail_at(t) : [0,0];
    let fl = flap_at(t);
    return {
      breath: mv.breath ? ap.breath_amp*b : 0, yaw, pitch, roll,
      crest: mv.head && mv.crest ? crest_at(t) : 0, tail, spread, teeter: mv.tail ? teeter_at(t) : 0,
      wing: fl.flap ? 0 : wing_at(t),
      nict, lid: ap.lid_rest + (1-ap.lid_rest)*lid, lid_upper,
      flap:fl.flap, phi:fl.phi, ext:fl.ext, hop:fl.hop, tilt:fl.tilt,
    };
  };
  return {T, pose_at, segs, blinks, tails, bouts, flicks, flap, moves:mv, breaths:nb};
}

// Builds everything for one seed: the drawing RNG path is identical to
// main(seed); animation randomness comes from separate streams.
function animator(seed,opts={}){
  jsr = str_to_seed(seed);
  perlin = null;
  let arg = generate_params();
  let rig = build_rig(arg);
  let moves = Object.assign({},ANIM_MOVES,opts.moves);
  let A = anim_rig(rig,{flap:moves.flap});
  let T = opts.duration || 6;
  let ap = anim_params(arg,seed,opts.intensity === undefined ? 0.7 : opts.intensity);
  let tl = make_timeline(ap,T,seed,moves);
  let rest = rest_pose(ap);
  let fpts = render_world(A,Object.assign({},rest,{lid:0})).flat();
  if (moves.wing) fpts = fpts.concat(render_world(A,Object.assign({},rest,{lid:0,wing:ap.wing_amp*1.2})).flat());
  if (tl.flap){
    // frame the whole flap: wings at the top and bottom of the stroke at full height
    let F = tl.flap;
    for (let k = 0; k <= 12; k++){
      let p = tl.pose_at(F.t0 + F.dur*k/12);
      fpts = fpts.concat(render_world(A,Object.assign({},rest,p,{lid:0})).flat());
    }
    for (let phi of [75,-45]){
      let p = Object.assign({},rest,{flap:1, ext:1, phi:phi*D2R, hop:F.H, tilt:8*D2R});
      fpts = fpts.concat(render_world(A,p).flat());
    }
  }
  let bb = get_bbox(fpts);
  if (arg.facing) bb.x = -(bb.x+bb.w);
  let mg = opts.margin === undefined ? 0.04 : opts.margin;
  bb = {x:bb.x-bb.w*mg/2, y:bb.y-bb.h*mg/2, w:bb.w*(1+mg), h:bb.h*(1+mg)};
  A.fit = frame_fit(bb,20,true);
  A.caption = caption_lines(seed+'.',20);
  return {
    seed, arg, ap, T, A, timeline:tl,
    pose_at: t=>tl.pose_at(t),
    rest_pose: ()=>Object.assign({},rest),
    frame: t=>render_exact(A,tl.pose_at(t)),
    frame_pose: pose=>render_exact(A,pose),
    ops: t=>render_ops(A,tl.pose_at(t)),
    ops_pose: pose=>render_ops(A,pose),
    frames: fps=>{
      let n = Math.max(1,Math.round(T*fps));
      let o = [];
      for (let i = 0; i < n; i++) o.push(render_exact(A,tl.pose_at(i*T/n)));
      return o;
    },
  };
}

// ===== idle animation: output =====

// Flipbook SVG. Coordinates are quantised to 0.1 units; every polyline is
// emitted once per maximal run of consecutive frames it appears in, and runs
// sharing the same frame span go into one <path> whose visibility is switched
// by discrete SMIL. Lines present in every frame need no animation at all.
function draw_svg_flipbook(frames,T,W=FRAME_W,H=FRAME_H){
  let N = frames.length;
  let q = l=>l.map(p=>[Math.round((p[0]+10)*10), Math.round((p[1]+10)*10)]);
  let key = l=>l.map(p=>p[0]+' '+p[1]).join(' ');
  let fmt = v=>String(v/10);
  let dpath = l=>{
    let s = `M${fmt(l[0][0])} ${fmt(l[0][1])}l`;
    for (let j = 1; j < l.length; j++){
      let dx = l[j][0]-l[j-1][0], dy = l[j][1]-l[j-1][1];
      s += (j > 1 ? ' ' : '') + fmt(dx) + ' ' + fmt(dy);
    }
    return s;
  };
  let pres = new Map();
  for (let i = 0; i < N; i++){
    for (let j = 0; j < frames[i].length; j++){
      let l = q(frames[i][j]);
      if (l.length < 2) continue;
      let k = key(l);
      let e = pres.get(k);
      if (!e){ e = {l, fr:[]}; pres.set(k,e); }
      if (e.fr[e.fr.length-1] !== i) e.fr.push(i);
    }
  }
  let spans = new Map();
  let put = (a,b,l)=>{
    let k = (a == 0 && b == N-1) ? 'all' : a+'-'+b;
    if (!spans.has(k)) spans.set(k,{a,b,d:[]});
    spans.get(k).d.push(dpath(l));
  };
  pres.forEach(e=>{
    let a = e.fr[0], p = a;
    for (let j = 1; j < e.fr.length; j++){
      if (e.fr[j] != p+1){ put(a,p,e.l); a = e.fr[j]; }
      p = e.fr[j];
    }
    put(a,p,e.l);
  });
  let kt = v=>+(v).toFixed(6);
  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="${W+20}" height="${H+20}">`;
  o += `<rect x="0" y="0" width="${W+20}" height="${H+20}" fill="floralwhite"/><rect x="10" y="10" width="${W}" height="${H}" stroke="black" stroke-width="1" fill="none"/>`;
  o += `<g stroke="black" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round">`;
  spans.forEach((s,k)=>{
    if (k == 'all'){
      o += `\n<path d="${s.d.join('')}"/>`;
      return;
    }
    let v = [], t = [];
    if (s.a > 0){ v.push('hidden'); t.push(0); }
    v.push('visible'); t.push(kt(s.a/N));
    if (s.b < N-1){ v.push('hidden'); t.push(kt((s.b+1)/N)); }
    o += `\n<path visibility="${s.a == 0 ? 'visible' : 'hidden'}" d="${s.d.join('')}"><animate attributeName="visibility" calcMode="discrete" values="${v.join(';')}" keyTimes="${t.join(';')}" dur="${T}s" repeatCount="indefinite"/></path>`;
  });
  o += `\n</g></svg>`;
  return o;
}

// Antialiased rasteriser for polylines or painter ops (fill = paper).
// Returns ink coverage 0..1 per pixel, including the 10-unit border like draw_svg.
function raster(src,W=FRAME_W,H=FRAME_H,scale=1,lw=1){
  let cw = Math.round((W+20)*scale), ch = Math.round((H+20)*scale);
  let ink = new Float32Array(cw*ch);
  let rad = lw*scale/2;
  let X = x=>(x+10)*scale, Y = y=>(y+10)*scale;
  let seg = (x0,y0,x1,y1)=>{
    let xa = Math.max(0,Math.floor(Math.min(x0,x1)-rad-1)), xb = Math.min(cw-1,Math.ceil(Math.max(x0,x1)+rad+1));
    let ya = Math.max(0,Math.floor(Math.min(y0,y1)-rad-1)), yb = Math.min(ch-1,Math.ceil(Math.max(y0,y1)+rad+1));
    let dx = x1-x0, dy = y1-y0, ll = dx*dx+dy*dy;
    for (let py = ya; py <= yb; py++){
      for (let px = xa; px <= xb; px++){
        let cx = px+0.5, cy = py+0.5;
        let t = ll ? clamp(((cx-x0)*dx+(cy-y0)*dy)/ll,0,1) : 0;
        let ex = x0+dx*t-cx, ey = y0+dy*t-cy;
        let cov = rad+0.5-Math.sqrt(ex*ex+ey*ey);
        if (cov <= 0) continue;
        let i = py*cw+px;
        if (cov > ink[i]) ink[i] = Math.min(1,cov);
      }
    }
  };
  let stroke = ls=>{
    for (let i = 0; i < ls.length; i++){
      let l = ls[i];
      for (let j = 1; j < l.length; j++) seg(X(l[j-1][0]),Y(l[j-1][1]),X(l[j][0]),Y(l[j][1]));
    }
  };
  let fill = poly=>{
    let pts = poly.map(p=>[X(p[0]),Y(p[1])]);
    let b = get_bbox(pts);
    let ya = Math.max(0,Math.floor(b.y)), yb = Math.min(ch-1,Math.ceil(b.y+b.h));
    for (let py = ya; py <= yb; py++){
      let cy = py+0.5, xs = [];
      for (let i = 0, j = pts.length-1; i < pts.length; j = i++){
        let [xi,yi] = pts[i], [xj,yj] = pts[j];
        if ((yi > cy) != (yj > cy)) xs.push(xi+(cy-yi)*(xj-xi)/(yj-yi));
      }
      xs.sort((a,b)=>a-b);
      for (let k = 0; k+1 < xs.length; k += 2){
        let xa = Math.max(0,Math.ceil(xs[k]-0.5)), xb = Math.min(cw-1,Math.floor(xs[k+1]-0.5));
        for (let px = xa; px <= xb; px++) ink[py*cw+px] = 0;
      }
    }
  };
  stroke([[[0,0],[W,0],[W,H],[0,H],[0,0]]]);
  if (src.length && !Array.isArray(src[0])){
    for (let i = 0; i < src.length; i++){
      if (src[i].fill) src[i].fill.forEach(fill);
      if (src[i].stroke) stroke(src[i].stroke);
    }
  }else{
    stroke(src);
  }
  return {w:cw, h:ch, ink};
}

// Animated GIF89a (16 levels from floralwhite to black, LZW, infinite loop).
function gif_encode(frames,w,h,delay_cs){
  let out = [];
  let u16 = v=>out.push(v&255,(v>>8)&255);
  let str = s=>{ for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); };
  str('GIF89a');
  u16(w); u16(h);
  out.push(0xF3,0,0);
  for (let i = 0; i < 16; i++){
    let t = 1-i/15;
    out.push(Math.round(255*t),Math.round(250*t),Math.round(240*t));
  }
  out.push(0x21,0xFF,0x0B);
  str('NETSCAPE2.0');
  out.push(3,1,0,0,0);
  let idx = new Uint8Array(w*h);
  for (let f = 0; f < frames.length; f++){
    out.push(0x21,0xF9,4,0);
    u16(delay_cs);
    out.push(0,0);
    out.push(0x2C);
    u16(0); u16(0); u16(w); u16(h);
    out.push(0);
    let ink = frames[f];
    for (let i = 0; i < w*h; i++) idx[i] = Math.round(clamp(ink[i],0,1)*15);
    gif_lzw(idx,4,out);
  }
  out.push(0x3B);
  return new Uint8Array(out);
}

function gif_lzw(idx,mcs,out){
  out.push(mcs);
  let clear = 1<<mcs, eoi = clear+1;
  let size = mcs+1, next = eoi+1;
  let dict = new Map();
  let buf = 0, nb = 0, block = [];
  let flush = ()=>{
    out.push(block.length);
    for (let i = 0; i < block.length; i++) out.push(block[i]);
    block = [];
  };
  let emit = code=>{
    buf |= code << nb;
    nb += size;
    while (nb >= 8){
      block.push(buf & 255);
      buf >>>= 8;
      nb -= 8;
      if (block.length == 255) flush();
    }
  };
  emit(clear);
  let prefix = idx[0];
  for (let i = 1; i < idx.length; i++){
    let k = idx[i];
    let key = prefix*256+k;
    let v = dict.get(key);
    if (v !== undefined){
      prefix = v;
      continue;
    }
    emit(prefix);
    if (next == 4096){
      emit(clear);
      dict.clear();
      size = mcs+1;
      next = eoi+1;
    }else{
      if (next >= (1<<size)) size++;
      dict.set(key,next++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (nb > 0) block.push(buf & 255);
  if (block.length) flush();
  out.push(0);
}

function anim_gif(an,fps=20,scale=1){
  let n = Math.max(1,Math.round(an.T*fps));
  let frames = [], w = 0, h = 0;
  for (let i = 0; i < n; i++){
    let r = raster(an.frame(i*an.T/n),FRAME_W,FRAME_H,scale);
    w = r.w; h = r.h;
    frames.push(r.ink);
  }
  return gif_encode(frames,w,h,Math.round(100/fps));
}

function main(seed){
  if (seed === undefined){
    jsr = ~~(Math.random()*10000);
    seed = binomen();
  }
  jsr = str_to_seed(seed);
  perlin = null;
  let arg = generate_params();
  main.last_params = arg;
  let drawing = bird(arg);
  return cleanup(reframe(drawing,20,seed+'.'));
}

function seed_name(s){
  jsr = str_to_seed(String(s));
  return binomen();
}

if (typeof module != "undefined"){
  module.exports = {
    main, bird, build_rig, render_static, generate_params, default_params, ARCHETYPES,
    animator, anim_rig, anim_params, make_timeline, rest_pose, render_exact, render_ops, render_world,
    breath_disp, frame_fit, apply_fit, TEMPERAMENT, ANIM_MOVES, parse_moves,
    draw_svg_flipbook, raster, gif_encode, anim_gif,
    reframe, cleanup, draw_svg, draw_svg_anim, draw_ps, binomen, seed_name, str_to_seed,
    get_bbox, FRAME_W, FRAME_H,
  };
  if (require.main === module){
    let seed = undefined;
    let format = 'svg';
    let speed = 0.005;
    for (let i = 2; i < process.argv.length; i++){
      let a = process.argv[i];
      if (a == '--seed'){
        seed = process.argv[i+1];
      }else if (a == '--format'){
        format = process.argv[i+1];
      }else if (a == '--speed'){
        if (process.argv[i+1] > 0) speed = speed / process.argv[i+1];
      }
    }
    let num = (name,def)=>{
      let i = process.argv.indexOf('--'+name);
      return i >= 0 ? Number(process.argv[i+1]) : def;
    };
    if (format == 'anim' || format == 'gif' || format == 'frames'){
      if (seed === undefined){
        jsr = ~~(Math.random()*10000);
        seed = binomen();
      }
      let fps = num('fps',format == 'gif' ? 20 : 12);
      let mi = process.argv.indexOf('--moves');
      let moves = parse_moves(mi >= 0 ? process.argv[mi+1] : '');
      let an = animator(seed,{duration:num('duration',6), intensity:num('intensity',0.7), moves});
      let oi = process.argv.indexOf('--out');
      let out = oi >= 0 ? process.argv[oi+1] : null;
      let fs = require('fs');
      if (format == 'anim'){
        let svg = draw_svg_flipbook(an.frames(fps),an.T);
        if (out) fs.writeFileSync(out,svg); else process.stdout.write(svg);
      }else if (format == 'gif'){
        let gif = Buffer.from(anim_gif(an,fps,num('scale',1)));
        if (out) fs.writeFileSync(out,gif); else process.stdout.write(gif);
      }else{
        let dir = out || (seed.replace(/[^A-Za-z0-9]+/g,'_')+'_frames');
        fs.mkdirSync(dir,{recursive:true});
        an.frames(fps).forEach((f,i)=>fs.writeFileSync(`${dir}/frame_${String(i).padStart(4,'0')}.svg`,draw_svg(f)));
        console.log(dir);
      }
    }else{
    let polylines = main(seed);
    if (format == 'svg'){
      console.log(draw_svg(polylines));
    }else if (format == 'json'){
      console.log(JSON.stringify(polylines));
    }else if (format == 'smil'){
      console.log(draw_svg_anim(polylines,speed));
    }else if (format == 'csv'){
      console.log(polylines.map(x=>x.flat().join(',')).join('\n'));
    }else if (format == 'ps'){
      console.log(draw_ps(polylines));
    }
    }
  }
}