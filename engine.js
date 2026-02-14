import { uid } from './storage.js';

const prompts = [
  'Q1 用語を一文で定義せよ（〜とは、…である）',
  'Q2 本質的属性を3つ挙げろ（必要条件）※カンマ区切り',
  'Q3 具体例を2つ ※カンマ区切り',
  'Q4 非例（それっぽいが違う）を2つ ※カンマ区切り',
  'Q5 境界条件（どこからどこまで？）を一文',
  'Q6 依存する概念（前提知識）を最大3つ ※カンマ区切り'
];

const vagueWords = ['良い', 'すごい', 'なんか', 'やばい', '普通', 'いい感じ', '最高', '微妙'];

function splitCSV(text) {
  return text
    .split(/[、,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export class DefinitionEngine {
  constructor() {
    this.flow = null;
  }

  start(term) {
    this.flow = {
      term,
      idx: 0,
      answers: {
        definition: '',
        attributes: [],
        examples: [],
        nonExamples: [],
        boundaries: '',
        dependencies: []
      }
    };
    return prompts[0];
  }

  isActive() {
    return !!this.flow;
  }

  currentQuestion() {
    if (!this.flow) return null;
    return prompts[this.flow.idx] ?? null;
  }

  answer(input) {
    if (!this.flow) return { done: false, reply: '先に用語を入力して定義訓練を開始してください。' };
    const f = this.flow;
    switch (f.idx) {
      case 0: f.answers.definition = input.trim(); break;
      case 1: f.answers.attributes = splitCSV(input); break;
      case 2: f.answers.examples = splitCSV(input); break;
      case 3: f.answers.nonExamples = splitCSV(input); break;
      case 4: f.answers.boundaries = input.trim(); break;
      case 5: f.answers.dependencies = splitCSV(input).slice(0, 3); break;
      default: break;
    }
    f.idx += 1;
    if (f.idx < prompts.length) {
      return { done: false, reply: prompts[f.idx] };
    }
    const built = this._buildPayload(f.term, f.answers);
    this.flow = null;
    return { done: true, built };
  }

  _buildPayload(term, answers) {
    const now = new Date().toISOString();
    const base = {
      id: uid('concept'),
      term,
      definition: answers.definition,
      non_examples: answers.nonExamples,
      examples: answers.examples,
      attributes: answers.attributes,
      dependencies: answers.dependencies,
      mastery: 50,
      createdAt: now,
      updatedAt: now,
      posX: Math.floor(120 + Math.random() * 500),
      posY: Math.floor(120 + Math.random() * 300)
    };

    const scoreObj = scoreAttempt(answers);
    base.mastery = scoreObj.score;

    const attempt = {
      id: uid('attempt'),
      conceptId: base.id,
      answers,
      score: scoreObj.score,
      notes: scoreObj.notes,
      createdAt: now
    };

    return { concept: base, attempt, scoreObj };
  }
}

export function scoreAttempt(answers) {
  let score = 60;
  const notes = [];
  const def = answers.definition || '';

  if (def.length < 18) {
    score -= 18;
    notes.push('定義が短すぎる');
  } else {
    score += 8;
  }

  let vagueHits = 0;
  vagueWords.forEach((w) => {
    if (def.includes(w)) vagueHits += 1;
  });
  if (vagueHits > 0) {
    score -= Math.min(20, vagueHits * 6);
    notes.push('曖昧語が多い');
  }

  if ((answers.attributes || []).length < 3) {
    score -= 14;
    notes.push('本質的属性が不足');
  } else {
    score += 10;
  }

  if ((answers.examples || []).length < 2) {
    score -= 10;
    notes.push('具体例が不足');
  } else {
    score += 6;
  }

  if ((answers.nonExamples || []).length < 2) {
    score -= 10;
    notes.push('非例が不足');
  } else {
    score += 6;
  }

  if (!(answers.dependencies || []).length) {
    score -= 5;
    notes.push('依存概念が空');
  } else {
    score += 4;
  }

  if (!(answers.boundaries || '').trim()) {
    score -= 8;
    notes.push('境界条件が未入力');
  } else {
    score += 4;
  }

  score = Math.max(0, Math.min(100, score));
  if (!notes.length) notes.push('良好な定義です');
  return { score, notes: notes.join(' / ') };
}
