import { uid } from './storage.js';

const EDGE_TYPES = ['depends_on', 'implies', 'contrasts', 'example_of'];

export class GraphView {
  constructor({ canvas, onSelectConcept, onChanged }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelectConcept = onSelectConcept;
    this.onChanged = onChanged;

    this.data = { concepts: [], edges: [] };
    this.drag = null;
    this.mode = 'normal';
    this.edgePick = [];

    this.radius = 30;
    this._bind();
  }

  setData(concepts, edges) {
    this.data = { concepts, edges };
    this.draw();
  }

  setMode(mode) {
    this.mode = mode;
    this.edgePick = [];
  }

  addNode(term = 'new concept') {
    return {
      id: uid('concept'),
      term,
      definition: '',
      non_examples: [],
      examples: [],
      attributes: [],
      dependencies: [],
      mastery: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      posX: Math.floor(120 + Math.random() * (this.canvas.width - 240)),
      posY: Math.floor(120 + Math.random() * (this.canvas.height - 220))
    };
  }

  _bind() {
    this.canvas.addEventListener('mousedown', (e) => this._onDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMove(e));
    window.addEventListener('mouseup', () => this._onUp());
    this.canvas.addEventListener('click', (e) => this._onClick(e));
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _hitConcept(x, y) {
    return this.data.concepts.find((c) => Math.hypot(c.posX - x, c.posY - y) <= this.radius);
  }

  _hitEdge(x, y) {
    for (const edge of this.data.edges) {
      const from = this.data.concepts.find((c) => c.id === edge.fromConceptId);
      const to = this.data.concepts.find((c) => c.id === edge.toConceptId);
      if (!from || !to) continue;
      const dist = pointLineDistance(x, y, from.posX, from.posY, to.posX, to.posY);
      if (dist < 6) return edge;
    }
    return null;
  }

  _onDown(e) {
    if (this.mode !== 'normal') return;
    const { x, y } = this._pos(e);
    const hit = this._hitConcept(x, y);
    if (hit) this.drag = { id: hit.id, dx: x - hit.posX, dy: y - hit.posY };
  }

  _onMove(e) {
    if (!this.drag) return;
    const { x, y } = this._pos(e);
    const c = this.data.concepts.find((n) => n.id === this.drag.id);
    if (!c) return;
    c.posX = Math.max(this.radius, Math.min(this.canvas.width - this.radius, x - this.drag.dx));
    c.posY = Math.max(this.radius, Math.min(this.canvas.height - this.radius, y - this.drag.dy));
    this.draw();
  }

  _onUp() {
    if (this.drag) {
      this.onChanged?.('move', this.drag.id);
    }
    this.drag = null;
  }

  _onClick(e) {
    const { x, y } = this._pos(e);
    const concept = this._hitConcept(x, y);

    if (this.mode === 'delete') {
      if (concept) return this.onChanged?.('deleteConcept', concept.id);
      const edge = this._hitEdge(x, y);
      if (edge) return this.onChanged?.('deleteEdge', edge.id);
      return;
    }

    if (this.mode === 'addEdge') {
      if (!concept) return;
      this.edgePick.push(concept.id);
      if (this.edgePick.length === 2) {
        const [fromId, toId] = this.edgePick;
        const type = EDGE_TYPES[(Math.random() * EDGE_TYPES.length) | 0];
        this.onChanged?.('addEdge', {
          id: uid('edge'), fromConceptId: fromId, toConceptId: toId, type
        });
        this.edgePick = [];
      }
      return;
    }

    if (concept) this.onSelectConcept?.(concept.id);
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.data.edges.forEach((e) => {
      const from = this.data.concepts.find((c) => c.id === e.fromConceptId);
      const to = this.data.concepts.find((c) => c.id === e.toConceptId);
      if (!from || !to) return;
      drawArrow(ctx, from.posX, from.posY, to.posX, to.posY);
      ctx.fillStyle = '#54637b';
      ctx.font = '11px Arial';
      ctx.fillText(e.type, (from.posX + to.posX) / 2 + 4, (from.posY + to.posY) / 2 - 4);
    });

    this.data.concepts.forEach((c) => {
      ctx.beginPath();
      ctx.fillStyle = masteryColor(c.mastery);
      ctx.strokeStyle = '#243146';
      ctx.lineWidth = 1;
      ctx.arc(c.posX, c.posY, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0f1726';
      ctx.font = '12px Arial';
      const label = c.term.length > 12 ? `${c.term.slice(0, 12)}…` : c.term;
      ctx.fillText(label, c.posX - this.radius + 6, c.posY + 4);
      ctx.font = '10px Arial';
      ctx.fillText(`M:${c.mastery}`, c.posX - this.radius + 6, c.posY + 18);
    });
  }
}

function drawArrow(ctx, x1, y1, x2, y2) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const sx = x1 + 30 * Math.cos(angle);
  const sy = y1 + 30 * Math.sin(angle);
  const ex = x1 + (len - 30) * Math.cos(angle);
  const ey = y1 + (len - 30) * Math.sin(angle);
  ctx.strokeStyle = '#5d6f8f';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  const head = 8;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - head * Math.cos(angle - Math.PI / 6), ey - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(ex - head * Math.cos(angle + Math.PI / 6), ey - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = '#5d6f8f';
  ctx.fill();
}

function pointLineDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const t = Math.max(0, Math.min(1, lenSq ? dot / lenSq : 0));
  const x = x1 + t * C;
  const y = y1 + t * D;
  return Math.hypot(px - x, py - y);
}

function masteryColor(mastery) {
  if (mastery < 35) return '#ffd6d6';
  if (mastery < 70) return '#fff0c9';
  return '#d8f5d8';
}
