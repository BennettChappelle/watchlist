'use strict';

export const esc = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export function titleGradient(title) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = title.charCodeAt(i) + ((h << 5) - h);
  h = Math.abs(h) % 360;
  return `linear-gradient(135deg,hsl(${h},30%,18%),hsl(${(h+40)%360},25%,12%))`;
}

export function posterStyle(item) {
  return item.poster
    ? `background-image:url('${esc(item.poster)}');background-size:cover;background-position:center`
    : `background:${titleGradient(item.title)}`;
}
