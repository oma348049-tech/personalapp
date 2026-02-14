import { Storage, uid } from './storage.js';
import { DefinitionEngine } from './engine.js';
import { GraphView } from './graph.js';

const storage = new Storage();
const engine = new DefinitionEngine();

const chatLog = document.getElementById('chatLog');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const startDefinitionBtn = document.getElementById('startDefinitionBtn');
const rerankBtn = document.getElementById('rerankBtn');
const conceptDetail = document.getElementById('conceptDetail');

const startNightSessionBtn = document.getElementById('startNightSessionBtn');
const nextNightStepBtn = document.getElementById('nextNightStepBtn');
const nightSessionStatus = document.getElementById('nightSessionStatus');

const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');

const addNodeBtn = document.getElementById('addNodeBtn');
const addEdgeBtn = document.getElementById('addEdgeBtn');
const deleteModeBtn = document.getElementById('deleteModeBtn');
const edgeTypeSelect = document.getElementById('edgeTypeSelect');

let state = await storage.getAll();
let selectedConceptId = null;
let pendingTerm = '';
let night = null;

const graph = new GraphView({
  canvas: document.getElementById('graphCanvas'),
  getEdgeType: () => edgeTypeSelect.value,
  onSelectConcept: (id) => {
    selectedConceptId = id;
    renderConceptDetail();
  },
  onChanged: async (type, payload) => {
    if (type === 'move') {
      const c = state.concepts.find((n) => n.id === payload);
      if (c) await storage.updateConcept(c.id, { posX: c.posX, posY: c.posY });
      return;
    }
    if (type === 'deleteConcept') {
      await storage.deleteConcept(payload);
      await refreshState();
      return;
    }
    if (type === 'deleteEdge') {
      await storage.deleteEdge(payload);
      await refreshState();
      return;
    }
    if (type === 'addEdge') {
      const duplicate = state.edges.find((e) => e.fromConceptId === payload.fromConceptId && e.toConceptId === payload.toConceptId);
      if (!duplicate && payload.fromConceptId !== payload.toConceptId) {
        await storage.addEdge(payload);
        await refreshState();
      }
    }
  }
});

function addMessage(who, text) {
  const box = document.createElement('div');
  box.className = `msg ${who}`;
  box.innerHTML = `<div class="who">${who === 'bot' ? 'SYSTEM' : 'YOU'}</div><div class="txt"></div>`;
  box.querySelector('.txt').textContent = text;
  chatLog.appendChild(box);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function promptStart() {
  addMessage('bot', '用語を1つ入力してください。Definition Engineを開始します。');
  pendingTerm = '';
}

async function refreshState() {
  state = await storage.getAll();
  graph.setData(state.concepts, state.edges);
  renderConceptDetail();
}

function renderConceptDetail() {
  const c = state.concepts.find((n) => n.id === selectedConceptId);
  if (!c) {
    conceptDetail.textContent = 'ノードをクリックすると詳細表示';
    return;
  }
  const attempts = state.attempts.filter((a) => a.conceptId === c.id);
  conceptDetail.textContent = [
    `Term: ${c.term}`,
    `Mastery: ${c.mastery}`,
    `Definition: ${c.definition}`,
    `Attributes: ${c.attributes.join(', ')}`,
    `Examples: ${c.examples.join(', ')}`,
    `Non-examples: ${c.non_examples.join(', ')}`,
    `Dependencies: ${c.dependencies.join(', ')}`,
    `Attempts: ${attempts.length}`
  ].join('\n');
}

function lowMasteryConcepts() {
  return [...state.concepts].sort((a, b) => a.mastery - b.mastery);
}

function setMode(mode) {
  graph.setMode(mode);
  addEdgeBtn.classList.toggle('active-mode', mode === 'addEdge');
  deleteModeBtn.classList.toggle('active-mode', mode === 'delete');
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  addMessage('user', text);

  if (!pendingTerm && !engine.isActive()) {
    pendingTerm = text;
    const q = engine.start(text);
    addMessage('bot', `用語「${text}」の定義訓練を開始。\n${q}`);
    return;
  }

  if (engine.isActive()) {
    const res = engine.answer(text);
    if (!res.done) {
      addMessage('bot', res.reply);
      return;
    }

    const { concept, attempt, scoreObj } = res.built;
    await storage.addConcept(concept);
    await storage.addAttempt(attempt);

    pendingTerm = '';
    addMessage('bot', `保存しました。score=${scoreObj.score}\nnotes=${scoreObj.notes}\n必要なら「override:80」のように手動上書きできます。`);
    await refreshState();
    if (night?.phase === 1) night.progress += 1;
    return;
  }

  if (text.startsWith('override:')) {
    const score = Number(text.replace('override:', '').trim());
    const latest = state.concepts[state.concepts.length - 1];
    if (latest && Number.isFinite(score)) {
      await storage.updateConcept(latest.id, { mastery: Math.max(0, Math.min(100, score)) });
      addMessage('bot', `最新概念「${latest.term}」のmasteryを${score}へ更新しました。`);
      await refreshState();
    }
    return;
  }
});

startDefinitionBtn.addEventListener('click', () => {
  addMessage('bot', '新規定義訓練を開始します。まず用語を入力してください。');
  pendingTerm = '';
});

rerankBtn.addEventListener('click', () => {
  const ranked = lowMasteryConcepts().slice(0, 8).map((c, i) => `${i + 1}. ${c.term} (M:${c.mastery})`);
  addMessage('bot', ranked.length ? `弱点順:\n${ranked.join('\n')}` : '概念がありません。まず定義訓練を行ってください。');
});

addNodeBtn.addEventListener('click', async () => {
  const term = window.prompt('ノード名を入力', 'new concept');
  if (!term) return;
  const concept = graph.addNode(term.trim());
  await storage.addConcept(concept);
  await refreshState();
});

addEdgeBtn.addEventListener('click', () => {
  setMode(addEdgeBtn.classList.contains('active-mode') ? 'normal' : 'addEdge');
});

deleteModeBtn.addEventListener('click', () => {
  setMode(deleteModeBtn.classList.contains('active-mode') ? 'normal' : 'delete');
});

startNightSessionBtn.addEventListener('click', () => {
  night = {
    phase: 0,
    steps: [
      '(0-5) 今日の計画: 25分タスクを3つ「;」区切りで入力',
      '(5-45) 定義訓練: mastery低い概念から3〜5個。足りなければ新規用語を入力',
      '(45-55) 概念地図整理: 依存/含意/対比エッジを1〜2本追加',
      '(55-60) まとめ: 今日の学び1文 + 明日の最小一手1つ（;区切り）'
    ],
    plan: [],
    attempts: [],
    summary: '',
    progress: 0
  };
  nightSessionStatus.textContent = `開始\n${night.steps[0]}`;
  addMessage('bot', 'Night Session開始。最初に「task1;task2;task3」の形式で入力してください。');
});

nextNightStepBtn.addEventListener('click', async () => {
  if (!night) return;
  if (night.phase === 0) {
    const planRaw = window.prompt('今日の25分タスクを3つ (;区切り)');
    if (planRaw) night.plan = planRaw.split(';').map((v) => v.trim()).filter(Boolean).slice(0, 3);
    night.phase = 1;
    const weak = lowMasteryConcepts().slice(0, 5).map((c) => c.term).join(', ');
    nightSessionStatus.textContent = `${night.steps[1]}\n候補: ${weak || '候補なし。新規用語を入力してください。'}`;
    return;
  }
  if (night.phase === 1) {
    night.phase = 2;
    nightSessionStatus.textContent = night.steps[2];
    addMessage('bot', 'Canvasでエッジを1〜2本追加してください。完了したら「次へ」。');
    return;
  }
  if (night.phase === 2) {
    const summaryRaw = window.prompt('今日の学び1文;明日の最小一手');
    night.summary = summaryRaw || '';
    const attempts = state.attempts.slice(-Math.max(3, night.progress)).map((a) => a.id);
    const session = {
      id: uid('session'),
      date: new Date().toISOString().slice(0, 10),
      plan: night.plan,
      attempts,
      summary: night.summary,
      createdAt: new Date().toISOString()
    };
    await storage.addSession(session);
    night.phase = 3;
    nightSessionStatus.textContent = `完了\n${night.summary || 'summaryなし'}`;
    addMessage('bot', 'Night Sessionを保存しました。お疲れさまでした。');
    await refreshState();
    return;
  }
  nightSessionStatus.textContent = 'セッションは完了済みです。必要なら再開始してください。';
});

exportBtn.addEventListener('click', async () => {
  const data = await storage.getAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `neumann-os-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

importInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const parsed = JSON.parse(text);
    await storage.replaceAll(parsed);
    addMessage('bot', 'JSON importが完了しました。');
    await refreshState();
  } catch {
    addMessage('bot', 'JSON importに失敗しました。形式を確認してください。');
  }
  e.target.value = '';
});

await refreshState();
promptStart();
