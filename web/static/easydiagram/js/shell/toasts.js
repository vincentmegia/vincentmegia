// Toasts: one at a time, bottom-centre of the stage, role=status.
import { h, icon } from './dom.js';
import { I } from './defs.js';

export function createToasts() {
  const host = h('div.ed-toasts', { 'aria-live': 'polite' });
  let timer = 0;
  function toast(msg, kind = 'ok') {
    clearTimeout(timer);
    const el = h('div.ed-toast', { role: 'status', 'data-kind': kind },
      h('span.ico', { 'aria-hidden': 'true' }, icon(kind === 'error' ? I.alert : I.check, { size: 13, sw: 3 })),
      h('span', { text: msg }));
    host.replaceChildren(el);
    timer = setTimeout(() => host.replaceChildren(), kind === 'error' ? 4200 : 2600);
  }
  toast.host = host;
  return toast;
}
