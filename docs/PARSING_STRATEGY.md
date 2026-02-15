# Parsing Strategy – Akitakata Assembly Minutes

## Observed Pattern

Based on current PDFs:

* Speaker names appear at the beginning of speech blocks.
* Format example:

山根 ○○
（発言本文）

or

議長 ○○
（発言本文）

---

## Step 1: Text Normalization

* Remove header/footer repeating patterns
* Normalize full-width/half-width characters
* Remove excessive line breaks

---

## Step 2: Speaker Detection Heuristics

Candidate pattern:

* ^[一-龥々]+[ 　]+[一-龥々]+
* Or lines ending with "議員", "市長", "議長"

Regex example (conceptual):

^([一-龥々]+(?:\s*[一-龥々]+)?)\s*(議員|市長|議長)?

---

## Step 3: Speech Segmentation Logic

Algorithm:

1. Iterate line by line
2. If matches speaker pattern:

   * Start new speech block
3. Else:

   * Append to current speech block

---

## Step 4: Speaker Normalization

* Trim whitespace
* Remove role suffix (議員, 市長)
* Match existing speakers by:

  * Exact match
  * Levenshtein distance (optional later)

---

## Step 5: Confidence Score

Confidence rules:

* High: Explicit pattern match
* Medium: Pattern + role match
* Low: Heuristic fallback

Store confidence in `speeches.confidence`

---

## Failure Handling

If segmentation confidence < threshold:

* Mark document.status = failed
* Log in ingestion_runs
* Preserve extracted raw text for manual review

---

## Important Principle

Parsing should be:

* Deterministic
* Re-runnable
* Versioned (parser_version stored later if needed)

We optimize for reproducibility over perfection.
