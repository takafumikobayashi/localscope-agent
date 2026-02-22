# LocalScope Agent – PRD

---

## 1. プロダクト概要

LocalScope Agent は、地方自治体の議会会議録・公開資料を取り込み、構造化し、
AIエージェントが読解・分析・評価できる形に変換する **エージェントファースト型の市政インテリジェンス基盤** である。

「人間にとって見やすいダッシュボード」から「議会を解析・評価・思考できるAI基盤」へ。
最初の対象自治体は **安芸高田市**。

---

## 2. 背景と課題

地方議会の議事録は公開されているが、実質的に活用困難な状態にある：

- PDFで配布されており検索性が低い
- 非構造化のため発言者・議題・決議を横断的に分析できない
- 意思決定の流れを時系列で追跡できない
- AIエージェントが直接消費できるAPIが存在しない

**公開されている ≠ 使える** — この乖離を解消することが本プロジェクトの出発点。

---

## 3. ビジョン

> 議会を「可視化するダッシュボード」から「解析・評価・思考できるAI基盤」へ。

LocalScope Agent は段階的に進化する：

| フェーズ | 定義 |
|---|---|
| Phase 1 | 可視化 — 構造化・要約・ダッシュボード |
| Phase 1.5 | 多角分析 — 議題抽出・一般質問分析・発言者スタイル |
| **Phase 2A** | **Agent 基盤 — MCP / Agent API / スタイル分類** |
| **Phase 2B** | **解析 AI — 議会活動指標 / AI コメンテーター / 反論生成** |
| Phase 3 | 民主主義OS — 自治体横断・学習型予測・外部公開 |

---

## 4. 実装状況（Phase 1 / 1.5 完了）

### Phase 1 ✅ 構造化 + AI 要約

- PDF 自動取得・テキスト抽出
- 発言者解決（6段階マッチング + SpeakerAlias 辞書）
- 発言データの構造化保存（speeches テーブル）
- GPT-4o による AI 要約・トピック抽出（document_summaries）

### Phase 1.5 ✅ 多角分析 + 可視化

- 議題・審議結果の AI 抽出（agendaItems — 可決/否決/継続審査）
- 一般質問の AI 抽出（generalQuestions）
- Web UI ダッシュボード（発言統計・トピックトレンド・発言者ランキング）
- 議事録一覧（年度・会議種別フィルタ・審議事項・一般質問表示）
- Analytics（発言数推移・会期強度・立場別分布・発言スタイル散布図）

---

## 5. Phase 2 — AI Agent Platform 化

### 5.1 ビジョン

Human UI Layer（ダッシュボード）と Agent API Layer を完全分離し、
LocalScope を **他AIエージェントから呼び出せるシビックインテリジェンス基盤** とする。

### 5.2 アーキテクチャ

```bash
[ Human UI Layer ]
    ダッシュボード / Analytics / Documents

[ Agent API Layer ]  ← Phase 2 で新設
    Structured Query API  ... 構造化データ取得
    Insight API           ... 集計済み指標
    Evaluation API        ... 活動指標スコア算出
    Reasoning API         ... 構造評価コメント生成（Phase 2B）

[ Knowledge Layer ]
    speeches / sessions / resolutions
    topic clusters / speaker metrics

[ AI Processing Layer ]
    活動指標エンジン / スタイル分類器 / 構造評価コメント生成
```

---

## 6. Phase 2A — Agent 基盤（優先実装）

### 6.1 MCP 対応

外部 AI エージェントや Claude / Codex から LocalScope のデータを呼び出せるようにする。
現時点で同種の仕組みを持つ地方議会データ基盤はほぼ存在しない。

**Phase 2A で提供するエンドポイント：**

```bash
get_session_summary(session_id)      # 会期要約・トピック
get_session_metrics(session_id)      # 発言数・話者数・文字数等
get_general_questions(session_id)    # 一般質問一覧
get_resolutions(session_id)          # 審議結果一覧
get_speaker_profile(speaker_id)      # 発言者プロフィール・発言統計
get_speaker_style(speaker_id)        # スタイル分類結果
```

**Phase 3 以降に追加予定：**

```bash
evaluate_session(session_id)         # 活動指標スコア（複数自治体比較後）
generate_commentary(session_id)      # 構造評価コメント
compare_municipalities(ids[])        # 自治体横断比較
```

### 6.2 Agent Skill 化

自然言語クエリを構造化 API に変換して応答するスキル群：

- 「R7-4回の議会の特徴は？」→ セッション指標 API
- 「支所廃止について市長の立場は？」→ トピック×発言者クエリ
- 「教育分野で最も活動している議員は？」→ スピーカー集約クエリ

### 6.3 議員スタイル分類

発言データから議員の「議会活動スタイル」を分類する。
speeches テーブルの既存データで SQL + 統計ベースの実装が可能（LLM 不要）。

**分類軸：** 発言件数 / 平均文字数 / 質問・批判・提案比率 / 分野集中度

**スタイルタイプ：**

| タイプ | 特徴 |
|---|---|
| 政策提案型 | 独自提案が多い |
| 行政監視型 | 追及・確認質問が多い |
| 批判型 | 反対表明・問題指摘中心 |
| 調整型 | 賛同・整理発言が多い |
| 地域特化型 | 特定地域・分野に集中 |

**注意：** スタイル分類は議員の議会活動の傾向を記述するものであり、
活動の優劣を評価するものではない。各タイプは役割の違いを表す。

---

## 7. Phase 2B — 解析 AI（段階的実装）

### 7.1 議会活動指標エンジン

会期の活動特性を複数の指標で定量化する。

**設計原則：**

- 指標は「記述」であり「評価」ではない
- 算出ロジックをすべて公開し再現可能にする
- 単一スコアへの集約はしない（政治的中立性のため）
- 比較対象（自分自身の時系列）を明示する

**指標一覧：**

| 指標 | 定義 |
|---|---|
| 発言集中度 | 上位3名の発言比率（%） |
| 質疑応答比率 | 議員発言 vs 行政発言の比率 |
| トピック多様性 | ユニークトピック数 / 総発言数 |
| 市民生活関連比率 | 生活・福祉・教育トピックの割合 |
| 一般質問密度 | 一般質問件数 / 会期発言総数 |

**出力例：**

```bash
R6-3回定例会 活動指標

発言集中度：    上位3名で 61%（前回比 -4pt）
質疑応答比率：  議員 58% / 行政 42%
トピック多様性：0.34（前回比 +0.05）
市民生活関連：  29%
一般質問密度：  0.18
```

**スコアを 1 つの数値に集約しない理由：**
何を「良い議会」とするかは価値判断であり、LocalScope の役割は
事実の記述と可視化であって評価ではない。

### 7.2 市民 AI コメンテーター

感情コメントではなく「構造評価コメント」を自動生成する。

**対象：** 一般質問単位・議題単位での議論構造の記述

**出力例：**

```bash
本議論では財政的裏付けの具体性が限定的でした。
市長答弁は現状説明が中心で、代替案提示は1件でした。
同テーマは前回定例会でも議題となっており、進捗に変化はありません。
```

**安全設計原則：**

- 個人への言及はデータの引用のみ（「A議員の発言件数は X 件」）
- 推測・憶測・感情表現の禁止
- 「〜と思われる」「〜の可能性がある」等の曖昧表現の禁止
- 比較はすべて同一データソース内に限定

### 7.3 反論生成 Agent

**位置付け：** 思考補助ツール。議会の外で学習・研究目的に使用するもの。

**対象ユーザー：** 市民・研究者・ジャーナリスト（議員向けではない）

**機能：**

- 議論の論点を構造化して提示
- 別の政策アプローチを提示（「他自治体では XX という方法も取られている」）
- 問いを立てるためのフレームを提示（「この議論で問われていない論点は何か」）

**スコープ外（実装しない）：**

- 現実の議会審議への直接介入を促すコンテンツ
- 特定の議員・行政の主張を優位にする誘導
- 「正解の反論」の断定

---

## 8. Phase 3 以降 — 民主主義 OS

Phase 2 が完成し **複数自治体のデータが蓄積された後** に着手する。

- **政策影響予測：** 複数自治体の比較データが揃って初めて意味を持つ。単一自治体では基準がなく予測の信頼性を確保できない
- **自治体横断比較：** 同一フォーマットで複数自治体を横断分析
- **学習型スタイル分類：** ML モデルによる精度向上
- **シビック AI 基盤の外部公開：** API・MCP の一般公開
- **民主主義 OS：** 議会データの標準フォーマット化・共有インフラ化

---

## 9. 非推奨機能（スコープ外）

以下は本プロダクトの設計哲学に反するため実装しない：

- 市民自由投稿掲示板
- 感情コメント・評価表示
- SNS 型評価（いいね・拡散）
- 投票型評価機能
- 「良い議会 / 悪い議会」の断定的スコアリング

---

## 10. 技術方針

**Frontend:** Next.js 16 (App Router) / React 19 / Server Components 優先

**Backend:** Next.js API Routes / Supabase (PostgreSQL) / Prisma ORM

**AI:** AI SDK (`ai`, `@ai-sdk/openai`) / GPT-4o / 将来: Embeddings + Vector Search

**MCP:** Model Context Protocol サーバー実装（Phase 2A）

**設計原則:**

- Agent-first / API-first
- 機械可読優先
- **事実の記述と価値判断の分離**
- 算出ロジックの透明性・再現可能性
- 公開情報のみ利用

---

## 11. Phase 2 実装優先順位

```bash
Phase 2A（先行実装）
  1. Agent API Layer 分離（Structured Query / Insight API）
  2. MCP サーバー実装
  3. 議員スタイル分類（SQL + 統計ベース）

Phase 2B（段階的実装）
  4. 議会活動指標エンジン（複数指標、単一スコアなし）
  5. 市民 AI コメンテーター（構造評価コメント）
  6. 反論生成 Agent（思考補助、スコープ明確化）

Phase 3 へ移動
  - 政策影響予測（複数自治体データ蓄積後）
  - 議会比較スコアリング（比較基準確立後）
```

---

## 12. 成功指標

**Phase 1 / 1.5（完了）:**

- ✅ PDF → 構造化データ変換
- ✅ 発言者解決精度（SpeakerResolver 6段階）
- ✅ 安芸高田市の会期データ全件取り込み
- ✅ AI 要約・議題・一般質問の自動抽出

**Phase 2A:**

- MCP エンドポイントから外部 AI が LocalScope データを呼び出せる
- Agent API Layer 経由で構造化クエリが機能する
- 議員スタイル分類が全発言者に対して出力される

**Phase 2B:**

- 会期ごとの活動指標が時系列で確認できる
- AI コメンテーターが事実ベースのコメントを生成できる
- 反論生成 Agent が思考補助として機能する

**Phase 3:**

- 複数自治体への横展開
- 政策影響予測の信頼できる出力
- AI エージェントによる自治体政策横断分析の実現

---

## English Summary

LocalScope Agent is an agent-first civic intelligence platform that ingests, structures, and enables AI-driven analysis of municipal assembly records.

**Current state (Phase 1 / 1.5 complete):** PDF ingestion → speaker resolution → structured storage → AI summarization (GPT-4o) → agenda/resolution extraction → visualization dashboard.

**Phase 2A goal:** Build the Agent Platform foundation — Agent API Layer separation, MCP compatibility, and speaker style classification (statistics-based, no LLM required).

**Phase 2B goal:** Add analytical AI capabilities — session activity metrics (multi-dimensional, no single composite score), AI structural commentary, and counter-argument assistance for civic learning.

**Key design constraint:** Metrics describe, not judge. "What kind of council was this?" is a factual question. "Was this a good council?" is a value judgment — outside LocalScope's scope.

**Phase 3 vision:** Cross-municipal civic AI infrastructure — policy impact prediction, comparative analysis, and a "Democratic OS" where AI agents can analyze and surface insights across local governments.
