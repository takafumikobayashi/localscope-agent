# LocalScope Agent – ERD

## Design Principles

* Preserve original public documents (PDF) for auditability and reproducibility
* Transform unstructured text into structured speech-level records
* Make data machine-readable and agent-ready
* Keep architecture extensible to multiple municipalities

---

## Core Entities (MVP: Phase 1)

### municipalities

Stores municipality-level information.

| Column        | Type            | Notes            |
| ------------- | --------------- | ---------------- |
| id            | uuid (pk)       |                  |
| name_ja       | text            | 例: 安芸高田市     |
| name_en       | text (nullable) |                  |
| prefecture_ja | text            |                  |
| code_jis      | text (nullable) | Future expansion |
| created_at    | timestamptz     |                  |
| updated_at    | timestamptz     |                  |

Index:

* (prefecture_ja, name_ja)

---

### sources

Represents source pages listing documents (e.g. meeting minutes page).

| Column          | Type        | Notes                                                         |
| --------------- | ----------- | ------------------------------------------------------------- |
| id              | uuid (pk)   |                                                               |
| municipality_id | uuid (fk)   |                                                               |
| source_type     | enum        | assembly_minutes / committee_minutes / public_comment / other |
| title           | text        |                                                               |
| url             | text        |                                                               |
| is_active       | boolean     |                                                               |
| created_at      | timestamptz |                                                               |
| updated_at      | timestamptz |                                                               |

Index:

* (municipality_id, source_type, is_active)

---

### sessions

Represents assembly sessions or committee meetings.

| Column          | Type            | Notes                                                  |
| --------------- | --------------- | ------------------------------------------------------ |
| id              | uuid (pk)       |                                                        |
| municipality_id | uuid (fk)       |                                                        |
| fiscal_year     | int             |                                                        |
| session_name    | text            |                                                        |
| session_type    | enum            | regular / extra / committee / budget_committee / other |
| held_on         | date (nullable) |                                                        |
| start_on        | date (nullable) |                                                        |
| end_on          | date (nullable) |                                                        |
| created_at      | timestamptz     |                                                        |
| updated_at      | timestamptz     |                                                        |

Index:

* (municipality_id, fiscal_year, session_type)

---

### documents

Represents a single PDF document.

| Column           | Type                | Notes                                                         |
| ---------------- | ------------------- | ------------------------------------------------------------- |
| id               | uuid (pk)           |                                                               |
| municipality_id  | uuid (fk)           |                                                               |
| source_id        | uuid (fk)           |                                                               |
| session_id       | uuid (fk, nullable) |                                                               |
| document_type    | enum                | minutes / committee_minutes / public_comment / report / other |
| title            | text                |                                                               |
| url              | text                |                                                               |
| published_on     | date (nullable)     |                                                               |
| document_version | text (nullable)     |                                                               |
| status           | enum                | discovered / downloaded / extracted / parsed / failed         |
| created_at       | timestamptz         |                                                               |
| updated_at       | timestamptz         |                                                               |

Unique:

* url (if stable)

---

### document_assets

Stores storage information of downloaded PDFs.

| Column           | Type          | Notes                                 |
| ---------------- | ------------- | ------------------------------------- |
| document_id      | uuid (pk, fk) |                                       |
| storage_provider | enum          | supabase_storage / s3 / local / other |
| storage_path     | text          |                                       |
| content_sha256   | text          |                                       |
| content_type     | text          |                                       |
| bytes            | bigint        |                                       |
| downloaded_at    | timestamptz   |                                       |

Index:

* (content_sha256)

---

### speakers

Represents identified speakers.

| Column          | Type            | Notes                                                   |
| --------------- | --------------- | ------------------------------------------------------- |
| id              | uuid (pk)       |                                                         |
| municipality_id | uuid (fk)       |                                                         |
| name_ja         | text            |                                                         |
| role            | enum            | councilor / mayor / executive / chair / staff / unknown |
| party           | text (nullable) |                                                         |
| term_start_on   | date (nullable) |                                                         |
| term_end_on     | date (nullable) |                                                         |
| created_at      | timestamptz     |                                                         |
| updated_at      | timestamptz     |                                                         |

Index:

* (municipality_id, name_ja)

---

### speeches

Core entity: speech-level structured record.

| Column            | Type                | Notes                       |
| ----------------- | ------------------- | --------------------------- |
| id                | uuid (pk)           |                             |
| document_id       | uuid (fk)           |                             |
| session_id        | uuid (fk, nullable) |                             |
| speaker_id        | uuid (fk, nullable) |                             |
| speaker_name_raw  | text                |                             |
| sequence          | int                 | Order within document       |
| speech_text       | text                |                             |
| speech_text_clean | text (nullable)     |                             |
| page_start        | int (nullable)      |                             |
| page_end          | int (nullable)      |                             |
| confidence        | numeric (nullable)  | Speaker matching confidence |
| created_at        | timestamptz         |                             |

Index:

* (document_id, sequence)

Search:

* Full-text index on speech_text_clean (PostgreSQL FTS)

---

## Phase 2 Entities (AI Layer)

### summaries

| Column         | Type            | Notes                           |
| -------------- | --------------- | ------------------------------- |
| id             | uuid (pk)       |                                 |
| scope_type     | enum            | document / session              |
| document_id    | uuid (nullable) |                                 |
| session_id     | uuid (nullable) |                                 |
| summary_type   | enum            | executive / bullet / topic_list |
| model          | text            |                                 |
| prompt_version | text            |                                 |
| content        | text            |                                 |
| created_at     | timestamptz     |                                 |

---

### topics

| Column          | Type            |
| --------------- | --------------- |
| id              | uuid (pk)       |
| municipality_id | uuid (fk)       |
| label_ja        | text            |
| label_en        | text (nullable) |

---

### speech_topics

| Column    | Type               |
| --------- | ------------------ |
| speech_id | uuid (fk)          |
| topic_id  | uuid (fk)          |
| score     | numeric (nullable) |

Unique:

* (speech_id, topic_id)

---

## Operational Table

### ingestion_runs

Tracks ingestion executions.

| Column          | Type        |                             |
| --------------- | ----------- | --------------------------- |
| id              | uuid (pk)   |                             |
| municipality_id | uuid (fk)   |                             |
| started_at      | timestamptz |                             |
| finished_at     | timestamptz |                             |
| trigger         | enum        | manual / schedule / webhook |
| status          | enum        | success / partial / failed  |
| log             | jsonb       |                             |

Index:

* (municipality_id, started_at desc)

---

## Data Flow Overview

PDF (public site)
→ documents
→ document_assets
→ text extraction
→ speeches
→ summaries
→ visualization / API

---

LocalScope Agent transforms public documents into structured, agent-readable civic intelligence.
