# NEUMANN-OS (MVP: Definition Engine)

Windows低スペック端末（Surface Go3想定）でも動作するよう、**依存ライブラリなし / ビルド不要 / index.html直開き**で動作するMVPです。

## 仮定（曖昧点への合理的な前提）
1. エッジ作成時の `type` はMVP簡略化のためランダム割当（`depends_on | implies | contrasts | example_of`）とした。将来はUI選択式に拡張。
2. Night Sessionの時間管理は実時計測ではなく、進行ガイド（フェーズ遷移）で実装。
3. 手動採点上書きはチャット入力 `override:80` 形式で最新概念へ適用。
4. CanvasはPCブラウザ（マウス操作）を主対象。タッチ最適化は今後拡張。

## ファイル構成
- `index.html` : 全体UI（チャット、サイドパネル、Canvas）
- `style.css` : 軽量スタイル
- `app.js` : 全体制御、Night Session、Export/Import
- `storage.js` : IndexedDBラッパ（失敗時localStorageフォールバック）
- `engine.js` : Definition Engine質問フロー、簡易採点
- `graph.js` : Canvas描画・ドラッグ・エッジ追加・削除

## 起動方法
1. このフォルダの `index.html` をブラウザで開く。
2. すぐにチャットで用語入力可能。

## 超初心者向け：まずここだけ読めばOK

このアプリは **Webページ1枚（`index.html`）** です。  
インストーラーはありません。まず「自分のPCにファイルを置く」→「`index.html`を開く」の順です。

### A. まだ自分のPCにファイルがない場合（GitHubから持ってくる）
1. GitHubのリポジトリ画面を開く
2. 緑の **Code** ボタンを押す
3. **Download ZIP** を押す
4. ダウンロードしたZIPを右クリックして **すべて展開**
5. 展開先フォルダを開く
6. `personalapp`（または同等のフォルダ）内の `index.html` を探す

### B. すでにファイルがある場合（最短）
1. `index.html` をダブルクリック
2. ブラウザで画面が出たら成功

### C. ダブルクリックで開けない/真っ白なとき（保険）
1. `index.html` があるフォルダでターミナルを開く
2. 次を実行

```bash
python -m http.server 8000
```

3. ブラウザで次を開く

```text
http://127.0.0.1:8000/index.html
```

### D. よくあるミス
- `index.htm` ではなく **`index.html`** が正しい
- ZIPの中身を展開せずに直接開いている（先に展開する）
- フォルダごとではなく、1ファイルだけ移動している（全ファイル同じフォルダに置く）

### E. 起動できたかの確認
- 画面に「NEUMANN-OS」が見える
- チャット入力欄に用語（例: `抽象化`）を入れて送信できる
- 右側にCanvasの概念地図エリアがある

## 使い方
### 1) Definition Engine（チャット式）
1. チャット欄で用語を入力（例: `抽象化`）
2. 固定6問に回答
   - Q1 定義文
   - Q2 属性3つ（カンマ区切り）
   - Q3 具体例2つ
   - Q4 非例2つ
   - Q5 境界条件
   - Q6 依存概念最大3つ
3. 回答完了で `Concept` と `DefinitionAttempt` を保存し、ルールベース採点（0-100）
4. 必要なら `override:数値` で最新概念のmasteryを手動上書き

### 2) 概念地図（Canvas）
- ノード追加: 「ノード追加」
- ノード移動: ドラッグ
- エッジ追加: 「エッジ追加モード」→ ノードを2つ順にクリック
- 削除: 「削除モード」→ ノードまたはエッジをクリック
- ノード詳細: 通常モードでノードをクリック

### 3) 弱点レーダー
- 「弱点順を表示」でmastery低い順をチャットに表示
- Night Session中の出題候補にも低masteryを使用

### 4) Night Session（60分ガイド）
- Startボタンで開始
- 次へボタンでフェーズ遷移
  1. 0-5分: 今日の25分タスク3つを入力
  2. 5-45分: 低mastery概念中心に定義訓練（3-5個目安）
  3. 45-55分: 概念地図でエッジ追加
  4. 55-60分: 学びと明日の一手を入力してSessionLog保存

### 5) 永続化
- IndexedDBを優先使用
- 使えない環境ではlocalStorageにフォールバック

### 6) Export / Import
- Export: 全データをJSONダウンロード
- Import: JSON読み込みで全復元（置換）

## データ仕様
### Concept
```json
{ "id":"", "term":"", "definition":"", "non_examples":[], "examples":[], "attributes":[], "dependencies":[], "mastery":0, "createdAt":"", "updatedAt":"", "posX":0, "posY":0 }
```

### Edge
```json
{ "id":"", "fromConceptId":"", "toConceptId":"", "type":"depends_on" }
```

### DefinitionAttempt
```json
{ "id":"", "conceptId":"", "answers": {"definition":"", "attributes":[], "examples":[], "nonExamples":[], "boundaries":"", "dependencies":[]}, "score":0, "notes":"", "createdAt":"" }
```

### SessionLog
```json
{ "id":"", "date":"YYYY-MM-DD", "plan":["task1","task2","task3"], "attempts":["attemptId"], "summary":"", "createdAt":"" }
```

## 手動テスト手順
1. 起動方法
   - `index.html` を開く
2. 新規概念→定義訓練完走→採点→保存
   - 用語入力→6問回答→スコア表示とノード追加確認
3. 概念地図でノード移動→Edge追加
   - ノードをドラッグ移動、エッジ追加モードで2ノード選択
4. 再起動してデータ保持
   - タブを閉じて再度 `index.html` を開く
5. Export→Importで復元
   - Export JSON保存→データ変更→Importして元に戻ること確認

## トラブル時の切り分けチェックリスト（上から順に）
1. `index.html` と `app.js` `engine.js` `graph.js` `storage.js` `style.css` が同じフォルダにあるか
2. ファイル名が `index.htm` になっていないか
3. ブラウザを変えて再試行（Edge/Chrome）
4. 直開きでダメなら `python -m http.server 8000` 方式で開く
5. それでもダメなら、ブラウザ開発者ツール（F12）のConsoleエラーを確認

## 今後の拡張案
1. エッジタイプ選択UI（モーダル）
2. 採点ロジック改善（文長だけでなくキーワード網羅率）
3. ノード検索・ズーム・パン
4. Night Sessionのタイマー実装
5. Concept詳細編集UI（定義/属性/例の再編集）
