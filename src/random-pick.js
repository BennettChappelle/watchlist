'use strict';

import { state }          from './state.js';
import { titleGradient }  from './utils.js';
import { render }         from './render/main.js';

// ── math helpers ──────────────────────────────────────────────────────────────
function bezier(x1, y1, x2, y2) {
  const cx=3*x1, bx=3*(x2-x1)-cx, ax=1-cx-bx, cy=3*y1, by=3*(y2-y1)-cy, ay=1-cy-by;
  const sx=t=>((ax*t+bx)*t+cx)*t, sy=t=>((ay*t+by)*t+cy)*t, dx=t=>(3*ax*t+2*bx)*t+cx;
  return x => {
    if (x<=0) return 0; if (x>=1) return 1; let lo=0, hi=1, t=x;
    for (let i=0; i<6; i++) { const e=sx(t)-x, d=dx(t); if (Math.abs(e)<1e-6||Math.abs(d)<1e-6) break; t-=e/d; }
    if (t<0||t>1||Math.abs(sx(t)-x)>1e-4) { t=x; for (let i=0; i<30; i++) { if (sx(t)<x) lo=t; else hi=t; t=(lo+hi)/2; } }
    return sy(t);
  };
}
const EASE_SPIN    = bezier(0.42, 0.04, 0.1, 1);
const easeOutCubic = u => 1 - Math.pow(1-u, 3);
const easeOutExpo  = u => u >= 1 ? 1 : 1 - Math.pow(2, -10*u);
const clamp  = (v,a,b) => Math.max(a, Math.min(b, v));
const mod    = (a,n)   => ((a%n)+n)%n;
const shuffle = arr => { const a=arr.slice(); for (let i=a.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

const W=240, H=360, OS=0.26, SLOTS=15;

// ── pool ──────────────────────────────────────────────────────────────────────
function getPool(type) {
  const all = state.watchlist.filter(i => i.type === type);
  const unw = all.filter(i => !i.watched);
  return unw.length ? unw : all;
}

function hueOf(t) { let h=0; for (let i=0; i<t.length; i++) h=(t.charCodeAt(i)+((h<<5)>>>0)-h)>>>0; return h%360; }

// ── carousel params ───────────────────────────────────────────────────────────
function slotParams(d, style) {
  const ad=Math.abs(d), sg=Math.sign(d);
  if (style === 'cylinder') {
    const step=20*Math.PI/180, R=(W/2+16)/Math.tan(step/2), ang=d*step, c=Math.cos(ang);
    return { x:R*Math.sin(ang), y:0, z:R*c-R, ry:ang*180/Math.PI, s:1, op:c>0.05?1:0, shade:clamp((1-c)*1.4,0,0.82) };
  }
  if (style === 'flat') {
    return { x:d*(W+28), y:0, z:0, ry:0, s:1+Math.max(0,1-ad)*0.08, op:ad>6.2?Math.max(0,7-ad):1, shade:clamp(ad*0.17,0,0.72) };
  }
  const c=Math.min(ad,1), far=Math.max(ad-1,0);
  return { x:sg*(c*190+far*96), y:0, z:-c*230-far*30, ry:-sg*c*52, s:1, op:ad>6.2?Math.max(0,7-ad):1, shade:clamp(c*0.38+far*0.1,0,0.8) };
}

// ── audio ──────────────────────────────────────────────────────────────────────
let ac = null;
function ensureAudio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {} }
  if (ac?.state === 'suspended') ac.resume();
}
function tone(freq, end, dur, gain, type, delay=0) {
  if (!ac || ac.state !== 'running' || !(state.settings.sound ?? true)) return;
  const t=ac.currentTime+delay, o=ac.createOscillator(), g=ac.createGain();
  o.type=type; o.frequency.setValueAtTime(freq,t); o.frequency.exponentialRampToValueAtTime(end,t+dur*0.8);
  g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t+dur+0.02);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PICKER MODAL
// ═══════════════════════════════════════════════════════════════════════════════
let pickerEl = null;

export function openPicker() {
  if (pickerEl) return;

  const seriesAll = state.watchlist.filter(i=>i.type==='series');
  const movieAll  = state.watchlist.filter(i=>i.type==='movie');

  // If only one type has items, skip the picker and go straight to the reel
  if (!seriesAll.length && movieAll.length)  { pick('movie');  return; }
  if (!movieAll.length  && seriesAll.length) { pick('series'); return; }
  if (!seriesAll.length && !movieAll.length) return;

  pickerEl = document.createElement('div');
  pickerEl.id = 'rp-overlay';
  pickerEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;animation:wl-fade 220ms cubic-bezier(0.16,1,0.3,1) both';

  const seriesPool = getPool('series'), moviePool = getPool('movie');
  const seriesUnw = state.watchlist.filter(i=>i.type==='series'&&!i.watched).length;
  const movieUnw  = state.watchlist.filter(i=>i.type==='movie' &&!i.watched).length;

  const tile = (type, label, key, pool, unw) => {
    const src = pool.length >= 3 ? pool : [...pool, ...pool, ...pool].slice(0, 3);
    const fan = src.slice(0,3).map((it,i) => {
      const o=i-1, rot=o*9, x=o*20, z=o===0?3:o===1?2:1;
      return `<div class="rp-fan" data-fi="${i}" style="position:absolute;left:50%;top:4px;width:64px;height:96px;margin-left:-32px;border-radius:4px;background:${titleGradient(it.title)};box-shadow:0 6px 18px rgba(0,0,0,0.55),inset 0 0 0 1px rgba(255,255,255,0.08);transform-origin:50% 100%;transform:translate(${x}px,0) rotate(${rot}deg);z-index:${z};transition:transform 380ms cubic-bezier(0.34,1.56,0.64,1)"></div>`;
    }).join('');
    const sub = unw > 0 ? `${unw} unwatched` : `${pool.length} titles (all)`;
    return `<button class="rp-tile" data-type="${type}" style="position:relative;background:#2c2c2e;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:28px 16px 20px;display:flex;flex-direction:column;align-items:center;gap:18px;color:#f5f5f7;font-family:'DM Sans',sans-serif;transition:transform 220ms cubic-bezier(0.16,1,0.3,1),border-color 120ms,box-shadow 220ms;cursor:pointer">
      <span aria-hidden="true" style="position:absolute;top:10px;right:10px;font-size:10px;color:#6e6e73;border:1px solid rgba(255,255,255,0.12);border-radius:4px;padding:1px 5px">${key}</span>
      <div style="position:relative;width:150px;height:104px">${fan}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        <span style="font-family:'Playfair Display',Georgia,serif;font-weight:600;font-size:22px">${label}</span>
        <span style="font-size:12px;color:#6e6e73">${sub}</span>
      </div>
    </button>`;
  };

  pickerEl.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="rp-picker-title" style="background:#1c1c1e;box-shadow:0 24px 80px rgba(0,0,0,0.8);border:1px solid rgba(255,255,255,0.08);padding:24px;width:min(90vw,560px);display:flex;flex-direction:column;border-radius:12px;animation:wl-modal 220ms cubic-bezier(0.16,1,0.3,1) both">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <span id="rp-picker-title" style="font-family:'Playfair Display',Georgia,serif;font-weight:600;font-size:20px;color:#f5f5f7">What are we watching?</span>
        <button id="rp-close" aria-label="Close" style="background:transparent;border:none;color:#6e6e73;display:flex;align-items:center;padding:4px;cursor:pointer"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
      </div>
      <div style="height:1px;background:rgba(255,255,255,0.06);margin:0 -24px 20px"></div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
        ${tile('series','Series','S',seriesPool,seriesUnw)}
        ${tile('movie','Movies','M',moviePool,movieUnw)}
      </div>
    </div>`;

  document.body.appendChild(pickerEl);

  // hover fan animation
  pickerEl.querySelectorAll('.rp-tile').forEach(tileEl => {
    tileEl.addEventListener('mouseenter', () => {
      tileEl.style.transform   = 'translateY(-2px)';
      tileEl.style.borderColor = 'rgba(10,132,255,0.6)';
      tileEl.style.boxShadow   = '0 8px 32px rgba(0,0,0,0.6)';
      tileEl.querySelectorAll('.rp-fan').forEach((fc, i) => {
        const o=i-1, rot=o*17, x=o*40, y=o===0?-8:-2;
        fc.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg)`;
      });
    });
    tileEl.addEventListener('mouseleave', () => {
      tileEl.style.transform = tileEl.style.borderColor = tileEl.style.boxShadow = '';
      tileEl.querySelectorAll('.rp-fan').forEach((fc, i) => {
        const o=i-1; fc.style.transform = `translate(${o*20}px,0) rotate(${o*9}deg)`;
      });
    });
  });

  pickerEl.addEventListener('click', e => {
    if (e.target === pickerEl) { closePicker(); return; }
    if (e.target.closest('#rp-close')) { closePicker(); return; }
    const t = e.target.closest('.rp-tile');
    if (t) { closePicker(); pick(t.dataset.type); }
  });
}

function closePicker() {
  pickerEl?.remove();
  pickerEl = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE (reel)
// ═══════════════════════════════════════════════════════════════════════════════
let stageEl   = null;
let stageData = null;

function buildStageEl() {
  const el = document.createElement('div');
  el.id = 'rp-stage';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Random pick reel');
  el.style.cssText = 'position:fixed;inset:0;z-index:250;background:#050505;overflow:hidden;animation:wl-fade 420ms cubic-bezier(0.16,1,0.3,1) both;user-select:none';

  const slotHtml = Array.from({length:SLOTS}, (_,i) => `
    <div data-slot="${i}" style="position:absolute;inset:0;backface-visibility:hidden;will-change:transform,opacity">
      <div data-poster style="position:absolute;inset:0;border-radius:8px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;padding:22px;background:#1c1c1e">
        <img data-img src="" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 120ms">
        <span data-title style="position:relative;font-family:'Playfair Display',Georgia,serif;font-size:24px;line-height:1.25;color:#f5f5f7;text-align:center;text-wrap:balance"></span>
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0.07),transparent 45%);border-radius:8px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08)"></div>
        <div data-shade style="position:absolute;inset:0;background:#050505;opacity:0"></div>
        <div data-flash style="position:absolute;inset:0;background:#fff;opacity:0"></div>
      </div>
    </div>`).join('');

  el.innerHTML = `
    <svg width="0" height="0" style="position:absolute;overflow:visible"><defs><filter id="wlReelBlur" x="-25%" y="0%" width="150%" height="100%"><feGaussianBlur stdDeviation="0 0"></feGaussianBlur></filter></defs></svg>
    <div data-glow style="position:absolute;left:50%;top:50%;width:1500px;height:1100px;margin:-550px 0 0 -750px;background:radial-gradient(closest-side,currentColor,transparent);opacity:0.5;color:hsl(210,40%,28%);transition:color 260ms linear;pointer-events:none"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,0.75) 100%);pointer-events:none"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;z-index:5;animation:wl-up 500ms 120ms cubic-bezier(0.16,1,0.3,1) both">
      <div style="display:flex;align-items:baseline;gap:10px">
        <span data-stage-title style="font-weight:500;font-size:11px;color:#f5f5f7;text-transform:uppercase;letter-spacing:0.08em"></span>
        <span data-stage-sub style="font-size:11px;color:#6e6e73"></span>
      </div>
      <button data-close-stage aria-label="Close" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.06);border:none;border-radius:50%;color:#6e6e73;transition:color 120ms,background 120ms;cursor:pointer"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
    </div>
    <div style="position:absolute;inset:0;padding-top:64px;display:flex;align-items:center;justify-content:center;perspective:1600px;pointer-events:none">
      <div data-track style="position:relative;width:${W}px;height:${H}px;transform-style:preserve-3d;opacity:0">
        ${slotHtml}
        <div data-chrome style="position:absolute;inset:0;transform:translateZ(2px)">
          <div data-marker style="position:absolute;left:50%;top:-44px;width:2px;height:22px;margin-left:-1px;background:#0a84ff;border-radius:1px;transform-origin:50% 0%;box-shadow:0 0 12px rgba(10,132,255,0.8)"></div>
          <div data-marker style="position:absolute;left:50%;top:calc(100% + 22px);width:2px;height:22px;margin-left:-1px;background:#0a84ff;border-radius:1px;transform-origin:50% 100%;box-shadow:0 0 12px rgba(10,132,255,0.8)"></div>
        </div>
      </div>
    </div>
    <div data-info style="display:none;position:absolute;z-index:6"></div>
    <div data-winner-announce aria-live="polite" aria-atomic="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap"></div>
    <div data-hint style="position:absolute;bottom:24px;left:0;right:0;text-align:center;font-size:11px;color:#6e6e73;letter-spacing:0.02em;pointer-events:none;animation:wl-fade 400ms 200ms cubic-bezier(0.16,1,0.3,1) both"></div>`;
  return el;
}

function bindNodes() {
  const d = stageData;
  d.slots    = [...stageEl.querySelectorAll('[data-slot]')].map(el => ({ el, poster:el.querySelector('[data-poster]'), img:el.querySelector('[data-img]'), title:el.querySelector('[data-title]'), shade:el.querySelector('[data-shade]'), flash:el.querySelector('[data-flash]') }));
  d.track    = stageEl.querySelector('[data-track]');
  d.glow     = stageEl.querySelector('[data-glow]');
  d.chrome   = stageEl.querySelector('[data-chrome]');
  d.markers  = [...stageEl.querySelectorAll('[data-marker]')];
  d.blurNode = stageEl.querySelector('feGaussianBlur');
  d.infoEl       = stageEl.querySelector('[data-info]');
  d.hintEl       = stageEl.querySelector('[data-hint]');
  d.announceEl   = stageEl.querySelector('[data-winner-announce]');
  d.titleEl  = stageEl.querySelector('[data-stage-title]');
  d.subEl    = stageEl.querySelector('[data-stage-sub]');
}

function startSpin(delay, prev) {
  const d=stageData, a=d.a, n=d.seq.length;
  let pos, guard=0;
  do { pos = Math.floor(Math.random()*n); }
  while (prev && d.poolSize > 1 && d.seq[pos].imdbID === prev.imdbID && guard++ < 50);
  const secs = state.settings.spinSeconds ?? 5;
  const from=a.p, travel=Math.round(secs*6.5);
  const to = Math.ceil((from+travel-pos)/n)*n+pos;
  Object.assign(a, { mode:'spin', from, to, t0:performance.now()+delay, dur:secs*1000, ease:EASE_SPIN });
}

function land() {
  const d=stageData, a=d.a, sl=d.slots[SLOTS>>1];
  const winner = d.seq[mod(a.to, d.seq.length)];
  sl.flash.animate([{opacity:0.55},{opacity:0}], {duration:700, easing:'cubic-bezier(0.16,1,0.3,1)'});
  sl.poster.animate([{transform:'scale(1)'},{transform:'scale(1.06)'},{transform:'scale(1)'}], {duration:520, easing:'cubic-bezier(0.34,1.56,0.64,1)'});
  d.markers.forEach(m => m.animate([{transform:'scaleY(2.2)',opacity:1},{transform:'scaleY(1)',opacity:0.75}], {duration:500, easing:'cubic-bezier(0.16,1,0.3,1)'}));
  ensureAudio(); tone(660,660,0.9,0.05,'sine'); tone(990,990,1.1,0.04,'sine',0.09);
  d.winner = winner;
  if (d.announceEl) d.announceEl.textContent = winner.title;
  clearTimeout(d.revealT);
  d.revealT = setTimeout(() => {
    if (!stageEl) return;
    const a2=d.a; a2.rFrom=a2.r; a2.rTo=1; a2.rT0=performance.now(); a2.rDur=1000;
    d.phase = 'reveal';
    showInfo();
  }, 380);
}

function showInfo() {
  const d=stageData, w=d.winner;
  if (!w || !d.infoEl) return;
  const wide = window.innerWidth >= 860;
  const k = wide ? Math.min(1, window.innerHeight/800, window.innerWidth/1100) : Math.min(0.9, window.innerWidth/420, window.innerHeight/900);
  const meta = [w.year, w.type, w.imdbRating ? `★ ${w.imdbRating}` : null].filter(Boolean).join(' · ');
  const kicker = d.type === 'series' ? 'Tonight\'s series' : 'Tonight\'s movie';
  const switchLabel = d.type === 'series' ? 'Pick a movie instead' : 'Pick a series instead';

  d.infoEl.style.cssText = `display:flex;flex-direction:column;align-items:${wide?'flex-start':'center'};` +
    (wide
      ? `left:calc(50% - ${Math.round(48*k)}px);top:50%;transform:translateY(-50%);width:min(470px,42vw);text-align:left;`
      : `left:24px;right:24px;top:calc(50% + ${Math.round(10*k)}px);text-align:center;`) +
    'position:absolute;z-index:6;transition:opacity 200ms ease-out,margin-top 200ms ease-out';

  d.infoEl.innerHTML = `
    <span style="font-weight:500;font-size:11px;color:#0a84ff;text-transform:uppercase;letter-spacing:0.12em;animation:wl-up 600ms 0ms cubic-bezier(0.16,1,0.3,1) both">${kicker}</span>
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-weight:600;font-size:${wide?'46px':'32px'};line-height:1.08;color:#f5f5f7;margin-top:12px;text-wrap:balance;animation:wl-up 700ms 60ms cubic-bezier(0.16,1,0.3,1) both">${w.title}</h1>
    <div style="font-size:13px;color:#6e6e73;margin-top:10px;letter-spacing:0.02em;animation:wl-up 700ms 120ms cubic-bezier(0.16,1,0.3,1) both">${meta}</div>
    ${w.plot ? `<p style="font-size:15px;color:rgba(245,245,247,0.75);line-height:1.6;margin-top:14px;max-width:440px;text-wrap:pretty;animation:wl-up 700ms 180ms cubic-bezier(0.16,1,0.3,1) both">${w.plot}</p>` : ''}
    <div style="display:flex;gap:10px;margin-top:26px;flex-wrap:wrap;animation:wl-up 700ms 240ms cubic-bezier(0.16,1,0.3,1) both">
      <button data-open-details style="background:#0a84ff;color:#fff;border:none;border-radius:6px;padding:9px 20px;font-family:'DM Sans',sans-serif;font-weight:500;font-size:14px;transition:filter 120ms;cursor:pointer">Open details</button>
      <button data-spin-again style="display:flex;align-items:center;gap:8px;background:transparent;color:#6e6e73;border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:9px 18px;font-family:'DM Sans',sans-serif;font-size:14px;transition:color 120ms,border-color 120ms;cursor:pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/></svg>Spin again</button>
    </div>
    <button data-switch-type style="margin-top:18px;background:transparent;border:none;color:#6e6e73;font-family:'DM Sans',sans-serif;font-size:12px;padding:0;animation:wl-up 700ms 300ms cubic-bezier(0.16,1,0.3,1) both;transition:color 120ms;cursor:pointer">${switchLabel}</button>`;

  d.infoEl.querySelector('[data-open-details]').addEventListener('click', e => { e.stopPropagation(); openDetails(); });
  d.infoEl.querySelector('[data-spin-again]').addEventListener('click',   e => { e.stopPropagation(); spinAgain(); });
  d.infoEl.querySelector('[data-switch-type]').addEventListener('click',  e => { e.stopPropagation(); pick(d.type === 'series' ? 'movie' : 'series'); });

  if (d.hintEl) d.hintEl.textContent = 'Space to spin again · Enter for details · Esc to close';
}

function spinAgain() {
  const d=stageData, a=d.a;
  a.rFrom=a.r; a.rTo=0; a.rT0=performance.now(); a.rDur=650;
  d.phase = 'leaving';
  d.infoEl.style.opacity = '0';
  d.infoEl.style.marginTop = '-8px';
  ensureAudio();
  clearTimeout(d.leaveT);
  d.leaveT = setTimeout(() => {
    if (stageData?.phase === 'leaving') { stageData.phase = 'spin'; stageData.infoEl.style.display = 'none'; }
  }, 130);
  startSpin(120, d.winner);
  if (d.hintEl) d.hintEl.textContent = 'Click or press Space to skip · Esc to close';
}

function openDetails() {
  const d = stageData;
  if (!d?.winner) return;
  const { imdbID, type } = d.winner;
  closeStage();
  state.openDetailId = imdbID;
  render();
  setTimeout(() => {
    const el = document.querySelector(`.shelf[data-type="${type}"]`);
    if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 64), behavior:'smooth' });
  }, 320);
}

export function closeStage() {
  const d = stageData;
  if (!d || d.closing) return;
  d.closing = true;
  clearTimeout(d.revealT); clearTimeout(d.leaveT);
  stageEl.style.animation = 'none';
  stageEl.style.transition = 'opacity 280ms cubic-bezier(0.16,1,0.3,1)';
  stageEl.style.opacity = '0';
  setTimeout(() => {
    d.running = false;
    cancelAnimationFrame(d.raf);
    document.body.style.overflow = '';
    stageEl?.remove();
    stageEl = null;
    stageData = null;
  }, 300);
}

function frameLoop(now) {
  const d=stageData, a=d.a;
  if (!a || !d.slots) return;
  const dt=Math.max(1, now-a.lastT); a.lastT=now;
  const prevP=a.p;

  if (a.mode === 'spin') {
    const u = clamp((now-a.t0)/a.dur, 0, 1);
    a.p = a.from + (a.to+OS-a.from) * a.ease(u);
    if (u >= 1) { a.mode='settle'; a.t0=now; a.amp=a.p-a.to; }
  } else if (a.mode === 'settle') {
    const s=(now-a.t0)/1000;
    a.p = a.to + a.amp*Math.exp(-5.5*s)*(Math.cos(9*s)+(5.5/9)*Math.sin(9*s));
    if (s > 0.75) { a.p=a.to; a.mode='rest'; land(); }
  }

  const v = Math.abs(a.p-prevP)/dt*1000;
  const ru = clamp((now-a.rT0)/a.rDur, 0, 1);
  a.r = a.rFrom + (a.rTo-a.rFrom) * (a.rTo > a.rFrom ? easeOutExpo(ru) : easeOutCubic(ru));
  const r=a.r, intro=easeOutCubic(clamp((now-a.openT-80)/800,0,1));
  const n=d.seq.length, base=Math.round(a.p), frac=a.p-base, half=SLOTS>>1;

  if (base !== a.lastBase) {
    d.slots.forEach((sl,ki) => {
      const it = d.seq[mod(base+ki-half,n)];
      const hasPoster = !!(it.poster && it.poster !== 'N/A');
      sl.poster.style.background = hasPoster ? '#0a0a0a' : titleGradient(it.title);
      sl.title.textContent = it.title;
      if (sl.img) {
        if (hasPoster) {
          if (sl.img.dataset.loaded === it.poster) {
            sl.img.style.opacity = '1';
            sl.title.style.visibility = 'hidden';
          } else {
            // Hide title immediately — gradient bg covers the slot while image loads
            sl.img.style.opacity = '0';
            sl.title.style.visibility = 'hidden';
            sl.img.src = it.poster;
            sl.img.onload = () => {
              if (sl.img.src.endsWith(it.poster) || sl.img.src === it.poster) {
                sl.img.style.opacity = '1';
                sl.img.dataset.loaded = it.poster;
              }
            };
            sl.img.onerror = () => {
              sl.img.style.opacity = '0';
              sl.title.style.visibility = 'visible';
              sl.poster.style.background = titleGradient(it.title);
            };
          }
        } else {
          sl.img.style.opacity = '0';
          sl.img.src = '';
          sl.title.style.visibility = 'visible';
          delete sl.img.dataset.loaded;
        }
      }
    });
    const cur = d.seq[mod(base,n)];
    if (d.glow) d.glow.style.color = `hsl(${hueOf(cur.title)},55%,34%)`;
    if (a.lastBase !== null && a.mode !== 'rest') {
      d.markers.forEach(m => m.animate([{transform:'scaleY(1.7)',opacity:1},{transform:'scaleY(1)',opacity:0.75}],{duration:180,easing:'cubic-bezier(0.16,1,0.3,1)'}));
      if (now-a.lastTick > 38) { a.lastTick=now; ensureAudio(); tone(2600,900,0.12,0.018,'square'); }
    }
    a.lastBase = base;
  }

  const wide=window.innerWidth>=860;
  const k=wide ? Math.min(1,window.innerHeight/800,window.innerWidth/1100) : Math.min(0.9,window.innerWidth/420,window.innerHeight/900);
  const rc = wide ? {x:-235,y:0,s:1.12} : {x:0,y:-H*0.46,s:0.78};

  d.slots.forEach((sl,i) => {
    const di=(i-half)-frac, P=slotParams(di, state.settings.carouselStyle ?? 'coverflow'), center=Math.abs(di)<0.5, sg=Math.sign(di)||1;
    const T = center ? {x:rc.x,y:rc.y,z:0,ry:0,s:rc.s,op:1,shade:0} : {x:P.x+sg*520,y:P.y,z:P.z-200,ry:P.ry,s:P.s*0.9,op:0,shade:P.shade};
    const L = key => P[key]+(T[key]-P[key])*r;
    sl.el.style.transform  = `translate3d(${L('x').toFixed(2)}px,${L('y').toFixed(2)}px,${L('z').toFixed(2)}px) rotateY(${L('ry').toFixed(2)}deg) scale(${L('s').toFixed(4)})`;
    sl.el.style.opacity    = L('op').toFixed(3);
    sl.el.style.zIndex     = String(100-Math.round(Math.abs(di)*10));
    sl.shade.style.opacity = L('shade').toFixed(3);
    // Only drive title opacity when title is visible (no poster loaded); otherwise leave visibility:hidden alone
    if (sl.title.style.visibility !== 'hidden') {
      sl.title.style.opacity = (center ? 1 : clamp(1-Math.abs(di)*0.75,0,1)*(1-r)).toFixed(3);
    }
  });

  const blur = clamp((v-3)*0.75,0,11)*(1-r);
  if (d.blurNode) d.blurNode.setAttribute('stdDeviation',`${blur.toFixed(2)} 0`);
  const blurOn = blur > 0.25;
  if (blurOn !== a.blurOn) { a.blurOn=blurOn; d.slots.forEach(sl => { sl.poster.style.filter = blurOn ? 'url(#wlReelBlur)' : 'none'; }); }

  if (d.track) { d.track.style.transform = `scale(${(k*(0.9+0.1*intro)).toFixed(4)}) translateY(${((1-intro)*40).toFixed(1)}px)`; d.track.style.opacity = intro.toFixed(3); }
  if (d.chrome) d.chrome.style.opacity = (1-r).toFixed(3);
}

function stageAction() {
  const d=stageData, a=d.a;
  if (!a) return;
  if (a.mode === 'spin') {
    const now=performance.now();
    if (now < a.t0) a.t0=now;
    const u=clamp((now-a.t0)/a.dur,0,1);
    if (u > 0.8) return;
    a.from=a.p; a.t0=now; a.dur=1100; a.ease=easeOutCubic;
  } else if ((a.mode === 'settle' || a.mode === 'rest') && d.phase !== 'reveal') {
    a.mode = 'rest'; a.p = a.to;
    clearTimeout(d.revealT);
    a.rFrom=a.r; a.rTo=1; a.rT0=performance.now(); a.rDur=600;
    d.winner = d.winner || d.seq[mod(a.to, d.seq.length)];
    d.phase = 'reveal';
    showInfo();
  } else if (d.phase === 'reveal') {
    spinAgain();
  }
}

export function pick(type) {
  if (stageEl) {
    if (stageData) { stageData.running=false; cancelAnimationFrame(stageData.raf); clearTimeout(stageData.revealT); clearTimeout(stageData.leaveT); }
    stageEl.remove(); stageEl=null; stageData=null; document.body.style.overflow='';
  }
  ensureAudio();
  const pool = getPool(type);
  if (!pool.length) return;
  const once=shuffle(pool); let seq=once.slice();
  while (seq.length < 20) seq = seq.concat(shuffle(pool));

  stageData = {
    type, seq, poolSize:pool.length, phase:'spin', winner:null, closing:false, running:false,
    a: { p:Math.floor(Math.random()*seq.length), mode:'idle', openT:performance.now(), lastT:performance.now(), lastBase:null, r:0, rFrom:0, rTo:0, rT0:performance.now(), rDur:1, blurOn:false, lastTick:0 },
  };
  stageEl = buildStageEl();
  document.body.appendChild(stageEl);
  document.body.style.overflow = 'hidden';
  bindNodes();

  stageData.titleEl.textContent = type === 'series' ? 'Random series' : 'Random movie';
  const unw = state.watchlist.filter(i=>i.type===type&&!i.watched).length;
  stageData.subEl.textContent   = `from ${unw > 0 ? unw + ' unwatched' : pool.length + ' titles'}`;
  stageData.hintEl.textContent  = 'Click or press Space to skip · Esc to close';

  stageEl.addEventListener('click', e => {
    if (e.target.closest('[data-close-stage]')) { closeStage(); return; }
    if (e.target.closest('[data-info]')) return;
    stageAction();
  });

  startSpin(260, null);
  stageData.running = true;
  const loop = t => { if (!stageData?.running) return; frameLoop(t); stageData.raf = requestAnimationFrame(loop); };
  stageData.raf = requestAnimationFrame(loop);
}

// ── keyboard handler (called from events.js) ──────────────────────────────────
export function handleRandomKey(e) {
  const tag=e.target.tagName;
  if (tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA') return;
  if (e.metaKey||e.ctrlKey||e.altKey) return;
  const k=e.key.toLowerCase();

  if (stageEl) {
    if (k==='escape') { e.preventDefault(); closeStage(); }
    else if (k===' ')  { e.preventDefault(); stageAction(); }
    else if (k==='enter' && stageData?.phase==='reveal') { e.preventDefault(); openDetails(); }
    return;
  }
  if (pickerEl) {
    if (k==='escape')          closePicker();
    else if (k==='s') { closePicker(); pick('series'); }
    else if (k==='m')          { closePicker(); pick('movie'); }
    return;
  }
  if (k==='r') openPicker();
}
