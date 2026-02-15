# LocalScope Agent – PRD

**Japanese Version**:

## 1. プロダクト概要

LocalScope Agent は、地方自治体の議会会議録や公開資料を取り込み、構造化し、AIエージェントが読解可能な形に変換するエージェントファースト型の市政インテリジェンス基盤である。
本プロジェクトは、自治体の意思決定プロセスを「人間にとって見やすい」だけでなく、「機械にとっても解釈可能」な状態に変換することを目的とする。
最初の対象自治体は 安芸高田市 とする。

## 2. 背景と課題

現在、多くの地方議会の議事録はPDF形式で公開されている。
しかし：

* 検索性が低い
* 構造化されていない
* 発言者ごとの分析が困難
* 意思決定の流れを追跡できない
* AIエージェントが直接活用できない

という課題がある。
公開されているにもかかわらず、「実質的に活用困難」な状態にある。

## 3. ビジョン

人間とAIの双方が読める自治体へ。

地方自治体の意思決定を、単なる公開情報から「構造化された市政インテリジェンス」へと進化させる。
LocalScope Agent は、

* 公開情報を機械可読化し
* 意思決定を追跡可能にし
* 将来的にエージェントが自治体政策を横断分析できる基盤を構築する

ことを目指す。

## 4. MVP設計

### Phase 1（B）– 構造化まで

目的：PDF議事録を構造化データへ変換する

機能：

* PDF自動取得
* テキスト抽出
* 発言者ごとの分割
* 発言回数カウント
* セッション単位の保存
* Supabaseへの保存

成果物：

* 検索可能な発言データ
* 議員ごとの発言数統計

### Phase 2（C）– AI要約

目的：AIによる市政理解の補助

機能：

* 会期ごとの要約生成
* 一般質問のテーマ抽出
* トピック分類
* キーワードベースの意思決定動向抽出

成果物：

* セッション要約
* 議員別発言傾向
* テーマ別議論可視化データ

### Phase 3（D）– ダッシュボード可視化

目的：意思決定の流れを直感的に理解可能にする

機能：

* 発言数グラフ
* テーマ別ヒートマップ
* 会期タイムライン
* キーワード推移グラフ

成果物：

* Next.jsベースの可視化UI
* 構造化API

## 5. 技術方針

Frontend:

* Next.js (App Router)
* Server Components優先

Backend:

* Next.js API Routes
* Supabase (PostgreSQL)
* Prisma ORM

PDF処理:

* Node.jsベース
* 必要に応じPython補助

AI:

* LLM API活用
* 将来的にAgent連携

設計原則:

* Agent-first
* API-first
* 機械可読優先
* 公開情報のみ利用

## 6. 将来拡張

* 他自治体への横展開
* パブリックコメント統合
* 予算データ連携
* API公開
* エージェント向けMCP対応
* 横断的自治体比較

## 7. 成功指標

短期：

* PDF → 構造化データ変換成功
* 発言者抽出精度80%以上
* 安芸高田市の会期データ全件取り込み

中期：

* 自治体横展開可能な設計
* 市政トピックの追跡可能化
* エージェントが自治体動向を分析可能

**English Version**:

## 1. Product Overview

LocalScope Agent is an agent-first civic intelligence platform that ingests, structures, and analyzes publicly available municipal records such as assembly minutes and public consultation documents.

Its purpose is to transform local government decision-making from static PDF documents into structured, searchable, and machine-readable intelligence.
The initial target municipality is Akitakata City (Japan).

## 2. Problem Statement

Municipal assembly records are publicly available, yet:

* They are distributed as static PDFs
* They are not structured
* Speaker-level analysis is difficult
* Decision flows are hard to trace
* AI agents cannot directly consume them

Public does not equal usable.

## 3. Vision

Toward municipalities readable by both humans and AI.
LocalScope Agent converts unstructured civic documents into structured, queryable, machine-readable knowledge.

It aims to build infrastructure where:

* Municipal decisions can be tracked
* Discussions can be analyzed longitudinally
* AI agents can assist in civic understanding

## 4. MVP Roadmap

### Phase 1 (B) – Structuring

Goal: Convert PDF minutes into structured speech data.

Features:

* PDF ingestion
* Text extraction
* Speaker segmentation
* Speech count statistics
* Session-level storage
* Supabase persistence

Output:

* Searchable speech dataset
* Per-councilor speech statistics

### Phase 2 (C) – AI Summarization

Goal: Enable AI-assisted civic interpretation.

Features:

* Session summaries
* Topic extraction
* Thematic classification
* Keyword-based trend detection

Output:

* Structured summaries
* Thematic discussion mapping

### Phase 3 (D) – Visualization Dashboard

Goal: Make decision dynamics intuitively understandable.

Features:

* Speech count graphs
* Topic heatmaps
* Session timelines
* Keyword trend charts

Output:

* Next.js visualization interface
* Structured REST API

## 5. Architecture Principles

* Agent-first
* API-first
* Machine-readable by default
* Public data only
* Extensible to other municipalities

Tech stack:

* Next.js
* Supabase
* Prisma
* LLM APIs

## 6. Future Expansion

* Multi-municipality support
* Public comment integration
* Budget integration
* Agent-facing API
* Cross-municipal comparison
* MCP compatibility

## 7. Success Metrics

Short-term:

* Accurate speaker extraction
* Complete ingestion of Akitakata sessions
* Searchable structured database

Mid-term:

* Replicable architecture
* AI-driven policy trend analysis
* Agent-readable civic knowledge
