// The shop window (bottom right: robots picking and loading inside one player's shop) and the
// order card (left: what a clicked order is, how long ago, how happy). Both read data/shop.json
// and data/shop.bin, recorded from the engine alongside the public feed (tools/simulate_match.py).
import { botSvg, truckSvg } from './looks.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const PARKED = 4;
const WALL = '#583a2d', FLOOR = '#fbf6ea', TILE = '#f1e9d6', SHELF = '#d9c3a0', INK = '#171412';
// One colour per product, for shelves, carried items and the order card.
const PRODUCT_COLOURS = {
  milk: '#7fb2e5', bread: '#c98f4f', apples: '#d6453d', pasta: '#e8c547', butter: '#f2d675', flour: '#cfc6b8', bananas: '#f1d02e',
  rice: '#b9b1a4', yogurt: '#9fc7d9', oats: '#b48a5a', tomatoes: '#e0533a', cereal: '#e39a3b', cheese: '#f0b429', eggs: '#e9d8b4',
  carrots: '#ef7d2d', juice: '#f59f2a', cream: '#c7d7e6', onions: '#a86a9b', peppers: '#4f9d4a', lettuce: '#7cbf4f', sugar: '#d9d2e8',
};
const productColour = name => PRODUCT_COLOURS[name] || '#a99';
const STATUS = {
  open: 'Open: waiting for a shop to claim it', claimed: 'Claimed', delivering: 'On the way', delivered: 'Delivered',
  expired: 'Expired: no shop claimed it in time', undelivered: 'Not delivered before the day ended',
};

export async function createPanels({ game, play, you }) {
  const [data, bin] = await Promise.all([
    fetch('data/shop.json').then(res => res.ok ? res.json() : null),
    fetch('data/shop.bin').then(res => res.ok ? res.arrayBuffer() : null),
  ]).catch(() => [null, null]);
  if (!data || !bin) return null;               // towns without recorded shop data: no panels
  const frames = new Uint8Array(bin);
  const shelf = new Map(data.items.map(([x, y, p]) => [x + ',' + y, p]));
  const sprites = game.players.map(player => ({ bot: image(botSvg(player.look), 36, 43), truck: image(truckSvg(player.look), 170, 122) }));
  const state = { seat: you ?? null, open: false, order: null, lastCard: '' };

  function image(svg, w, h) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', `<svg width="${w * 2}" height="${h * 2}" `));
    return img;
  }

  // ---- shop window -------------------------------------------------------------
  const win = $('shopwin'), canvas = $('shop-canvas'), g = canvas.getContext('2d');
  $('shop-close').addEventListener('click', () => closeShop());

  function showShop(seat) {
    if (!game.players[seat]) return;
    state.seat = seat;
    state.open = true;
    const player = game.players[seat];
    win.hidden = false;
    document.body.classList.add('has-shop');
    win.style.setProperty('--seat', player.colour);
    $('shop-title').textContent = seat === you ? 'Your shop' : `${player.name}'s shop`;
    $('shop-face').innerHTML = botSvg(player.look);
    sizeCanvas();
  }

  function closeShop() {
    state.open = false;
    win.hidden = true;
    document.body.classList.remove('has-shop');
  }

  let size = { w: 0, h: 0, cell: 10, dpr: 1 };
  function sizeCanvas() {
    const w = canvas.clientWidth || 320, cell = Math.floor(w / data.grid.width), truckRow = Math.round(cell * 2.2);
    const h = truckRow + cell * data.grid.height;
    size = { w, h, cell, truckRow, dpr: Math.min(2, devicePixelRatio || 1), ox: Math.floor((w - cell * data.grid.width) / 2) };
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * size.dpr);
    canvas.height = Math.round(h * size.dpr);
  }
  addEventListener('resize', () => { if (state.open) sizeCanvas(); });

  // byte layout per tick and seat: robots x [x, y, action, item1+1, item2+1, item3+1], trucks x [loaded, needed]
  const at = (tick, seat) => (clamp(tick, 0, data.ticks - 1) * data.seats + seat) * data.frameBytes;

  function drawShop(index, k, frameA, time) {
    const { cell, ox, truckRow, dpr } = size, seat = state.seat, player = game.players[seat];
    const W = data.grid.width, H = data.grid.height, X = x => ox + x * cell, Y = y => truckRow + y * cell;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);
    // floor, walls, loading cells
    g.fillStyle = FLOOR;
    g.fillRect(X(0), Y(0), W * cell, H * cell);
    g.fillStyle = TILE;
    for (let y = 1; y < H - 1; y++) for (let x = 1 + (y % 2); x < W - 1; x += 2) g.fillRect(X(x), Y(y), cell, cell);
    g.fillStyle = player.colour;
    g.globalAlpha = .18;
    for (const cells of data.loadCells) for (const [x, y] of cells) g.fillRect(X(x), Y(y), cell, cell);
    g.globalAlpha = 1;
    g.fillStyle = WALL;
    g.fillRect(X(0), Y(0), W * cell, cell * .55);
    g.fillRect(X(0), Y(H) - cell * .55, W * cell, cell * .55);
    g.fillRect(X(0), Y(0), cell * .55, H * cell);
    g.fillRect(X(W) - cell * .55, Y(0), cell * .55, H * cell);
    // bays: doors in the top wall, the truck parked outside when it is home
    const trucks = frameA.p[seat][4], o = at(index, seat), base = o + data.botsPerPlayer * 6;
    data.bays.forEach(([bx], t) => {
      g.fillStyle = FLOOR;
      g.fillRect(X(bx - 1) + 2, Y(0), cell * 3 - 4, cell * .55);
      const docked = trucks[t * 3 + 2] < PARKED, cx = X(bx) + cell / 2;
      if (docked && sprites[seat].truck.complete) {
        const tw = cell * 3.1, th = tw * 122 / 170;
        g.drawImage(sprites[seat].truck, cx - tw * .52, truckRow - th * .95, tw, th);
        const loaded = frames[base + t * 2], needed = frames[base + t * 2 + 1];
        if (needed) {
          g.fillStyle = 'rgba(23,20,18,.15)';
          g.fillRect(cx - cell * 1.2, truckRow - 3, cell * 2.4, 3);
          g.fillStyle = player.colour;
          g.fillRect(cx - cell * 1.2, truckRow - 3, cell * 2.4 * Math.min(1, loaded / needed), 3);
        }
      } else {
        g.strokeStyle = 'rgba(88,58,45,.35)';
        g.setLineDash([3, 3]);
        g.strokeRect(cx - cell * 1.3, truckRow - cell * 1.6, cell * 2.6, cell * 1.3);
        g.setLineDash([]);
        g.fillStyle = 'rgba(88,58,45,.55)';
        g.font = `700 ${Math.max(8, cell * .62)}px Mulish, Arial, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('out', cx, truckRow - cell * .95);
      }
    });
    // shelves with their product
    g.font = `800 ${Math.max(7, cell * .5)}px Mulish, Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const [x, y, p] of data.items) {
      g.fillStyle = SHELF;
      g.fillRect(X(x) + .5, Y(y) + .5, cell - 1, cell - 1);
      g.fillStyle = productColour(data.products[p]);
      g.fillRect(X(x) + 2, Y(y) + 2, cell - 4, cell - 4);
      g.fillStyle = 'rgba(23,20,18,.75)';
      g.fillText(data.products[p].slice(0, 2), X(x) + cell / 2, Y(y) + cell / 2 + .5);
    }
    // robots, eased from one tick to the next, with what they carry
    const next = at(index + 1, seat), crowd = new Map();
    for (let b = 0; b < data.botsPerPlayer; b++) {
      const i = o + b * 6, j = next + b * 6, key = frames[j] + ',' + frames[j + 1];
      crowd.set(key, (crowd.get(key) || 0) + 1);
    }
    const seen = new Map(), bots = [];
    for (let b = 0; b < data.botsPerPlayer; b++) {
      const i = o + b * 6, j = next + b * 6;
      const key = frames[j] + ',' + frames[j + 1], n = seen.get(key) || 0, many = crowd.get(key);
      seen.set(key, n + 1);
      // several robots waiting on one cell (the start cell) fan out a little
      const fan = many > 1 ? [((n % 5) - 2) * cell * .18, (Math.floor(n / 5) - 1.5) * cell * .16] : [0, 0];
      const x = X(frames[i] + (frames[j] - frames[i]) * k) + cell / 2 + fan[0], y = Y(frames[i + 1] + (frames[j + 1] - frames[i + 1]) * k) + cell / 2 + fan[1];
      bots.push({ x, y, action: frames[j + 2], items: [frames[j + 3], frames[j + 4], frames[j + 5]], cellX: frames[j], cellY: frames[j + 1] });
    }
    bots.sort((p, q) => p.y - q.y);
    const bw = cell * 1.25, bh = bw * 43 / 36;
    for (const bot of bots) {
      if (bot.action === 2) spark(bot, X, Y, k);                 // picking from the shelf next to it
      if (bot.action === 3) loadArrow(bot, k, player.colour);    // loading into the truck above
      if (sprites[seat].bot.complete) g.drawImage(sprites[seat].bot, bot.x - bw / 2, bot.y - bh * .78, bw, bh);
      bot.items.forEach((item, n) => {
        if (!item) return;
        g.beginPath();
        g.arc(bot.x - cell * .3 + n * cell * .3, bot.y - bh * .82, Math.max(1.8, cell * .14), 0, 7);
        g.fillStyle = productColour(data.products[item - 1]);
        g.fill();
        g.lineWidth = 1;
        g.strokeStyle = '#fff';
        g.stroke();
      });
    }
    return bots;
  }

  function spark(bot, X, Y, k) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!shelf.has(bot.cellX + dx + ',' + (bot.cellY + dy))) continue;
      const cx = X(bot.cellX + dx) + size.cell / 2, cy = Y(bot.cellY + dy) + size.cell / 2;
      g.globalAlpha = 1 - k;
      g.strokeStyle = '#fff';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, size.cell * (.3 + k * .5), 0, 7);
      g.stroke();
      g.globalAlpha = 1;
      return;
    }
  }

  function loadArrow(bot, k, colour) {
    const y = bot.y - size.cell * (.6 + k * .8);
    g.globalAlpha = 1 - k * .6;
    g.fillStyle = colour;
    g.beginPath();
    g.moveTo(bot.x, y - size.cell * .4);
    g.lineTo(bot.x - size.cell * .3, y);
    g.lineTo(bot.x + size.cell * .3, y);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
  }

  function footer(index, frameA, bots) {
    const seat = state.seat, trucks = frameA.p[seat][4];
    let home = 0;
    for (let t = 0; t < trucks.length / 3; t++) if (trucks[t * 3 + 2] < PARKED) home++;
    const busy = bots.filter(b => b.action).length;
    let picking = 0, out = 0;
    for (const order of Object.values(data.orders)) {
      const s = statusAt(order, index);
      if (s.seat !== seat) continue;
      if (s.status === 'claimed') picking++;
      if (s.status === 'delivering') out++;
    }
    $('shop-foot').textContent = `${busy} of ${data.botsPerPlayer} robots working · ${picking} order${picking === 1 ? '' : 's'} being packed · ${home} truck${home === 1 ? '' : 's'} home, ${trucks.length / 3 - home} out with ${out}`;
  }

  // ---- order card --------------------------------------------------------------
  const card = $('ordercard');
  addEventListener('keydown', event => { if (event.key === 'Escape') closeOrder(); });

  function statusAt(order, tick) {
    let now = { status: 'open', seat: -1, since: order.placed };
    for (const [t, status, seat] of order.history) {
      if (t > tick) break;
      if (status !== now.status || seat !== now.seat) now = { status, seat, since: t };
    }
    return now;
  }

  function showOrder(id) {
    if (!data.orders[id]) return;
    state.order = id;
    state.lastCard = '';
    card.hidden = false;
  }

  function closeOrder() {
    state.order = null;
    card.hidden = true;
  }

  const clockText = seconds => { const m = Math.floor(seconds / 60); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const minutes = seconds => seconds < 60 ? 'under a minute' : `${Math.round(seconds / 60)} min`;
  const escape = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function drawOrder(head) {
    const order = data.orders[state.order], tick = Math.floor(head), ts = data.tickSeconds, start = game.meta.clockStart;
    const s = statusAt(order, tick), owner = game.players[s.seat];
    const nowSec = head * ts, placedSec = order.placed * ts;
    // happiness: final when delivered; else how late it is against the deadline (5% per 2.5 min late)
    let happy = 100, mood = '';
    if (s.status === 'delivered') happy = order.satisfaction ?? 100;
    else if (s.status === 'expired' || s.status === 'undelivered') happy = 0;
    else if (order.deadline != null && s.status !== 'open') {
      const late = Math.max(0, nowSec - order.deadline * ts);
      happy = Math.max(0, 100 - Math.floor(late / (data.lateStepTicks * ts)) * data.lateStepPercent);
    }
    mood = happy >= 95 ? 'Happy' : happy >= 70 ? 'Getting impatient' : happy > 0 ? 'Unhappy' : 'Gave up';
    let detail = STATUS[s.status];
    if (s.status === 'claimed') {
      const loading = order.firstLoad != null && tick >= order.firstLoad, ready = order.ready != null && tick >= order.ready;
      detail = `Claimed by ${owner?.name ?? 'a shop'}: ${ready ? 'packed, waiting for the truck to leave' : loading ? 'robots are loading it onto the truck' : 'robots are picking the items'}`;
    } else if (s.status === 'delivering') detail = `On the way in a ${owner?.name ?? ''} truck`;
    else if (s.status === 'delivered') detail = `Delivered by ${owner?.name ?? 'a shop'}`;
    let timing;
    if (s.status === 'delivered') timing = `Took ${minutes(order.deliveredAt * ts - placedSec)} from order to doorstep`;
    else if (s.status === 'open') timing = `Expires in ${minutes(Math.max(0, order.expires * ts - nowSec))} if no shop claims it`;
    else if (order.deadline != null && s.status !== 'expired' && s.status !== 'undelivered') {
      const left = order.deadline * ts - nowSec;
      timing = left >= 0 ? `Due ${clockText(start + order.deadline * ts)}, in ${minutes(left)}` : `${minutes(-left)} late (was due ${clockText(start + order.deadline * ts)})`;
    } else timing = '';
    const counts = {};
    for (const item of order.items) counts[item] = (counts[item] || 0) + 1;
    const items = Object.entries(counts).map(([name, n]) => `<li><i style="background:${productColour(name)}"></i>${n > 1 ? `${n} × ` : ''}${escape(name)}</li>`).join('');
    const points = s.status === 'delivered' ? `+${order.points} points${order.rushBonus ? ` (incl. ${order.rushBonus} rush-hour bonus)` : ''}` : `Worth ${order.reward} points on time`;
    const html = `
      <header><h2>Order ${escape(state.order)}</h2><button class="g-x" id="order-close" type="button" aria-label="Close order">×</button></header>
      <p class="g-order-where">${escape(order.address)}</p>
      <p class="g-order-status" style="--seat:${owner ? owner.colour : '#735536'}">${owner ? `<button type="button" class="g-order-shop" data-seat="${s.seat}">${escape(detail)}</button>` : escape(detail)}</p>
      <h3>${order.items.length} item${order.items.length === 1 ? '' : 's'}</h3><ul class="g-order-items">${items}</ul>
      <dl>
        <div><dt>Ordered</dt><dd>${clockText(start + placedSec)}, ${minutes(Math.max(0, nowSec - placedSec))} ago</dd></div>
        ${timing ? `<div><dt>Time</dt><dd>${escape(timing)}</dd></div>` : ''}
        <div><dt>Customer</dt><dd><span class="g-happy"><b style="width:${happy}%;background:${happy >= 95 ? '#3f8f4f' : happy >= 70 ? '#e8a32e' : '#c8102e'}"></b></span> ${happy}% · ${mood}</dd></div>
        <div><dt>Points</dt><dd>${escape(points)}</dd></div>
      </dl>`;
    if (html !== state.lastCard) {
      card.innerHTML = html;
      state.lastCard = html;
      $('order-close').addEventListener('click', () => closeOrder());
      card.querySelector('.g-order-shop')?.addEventListener('click', event => showShop(Number(event.currentTarget.dataset.seat)));
    }
  }

  // ---- per frame ----------------------------------------------------------------
  let cardTick = -1;
  function update(index, k, frameA, head, time) {
    if (state.open) {
      if (!size.w || canvas.clientWidth !== size.w) sizeCanvas();
      const bots = drawShop(index, k, frameA, time);
      if (index !== state.footTick) { state.footTick = index; footer(index, frameA, bots); }
    }
    if (state.order && Math.floor(head * 4) !== cardTick) { cardTick = Math.floor(head * 4); drawOrder(head); }
  }

  if (state.seat !== null) showShop(state.seat);
  return { showShop, closeShop, showOrder, closeOrder, update, get selectedOrder() { return state.order; }, get seat() { return state.open ? state.seat : null; } };
}
