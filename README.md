# Luke’s English

Petr’s library of lessons with Luke, interactive HTML tests, listening practice and personal topics.

**[Open the study space](https://pupitooo.github.io/lukes-english/)**

## Adding materials

- Lessons: `content/lessons/YYYY-MM-DD/`
- Personal topics: `content/topics/topic-name/`

Upload related HTML, MP3 and other attachments into one folder. Preserve filenames and relative links. Optional `meta.json` provides a title, description, date, lesson number, tags and file labels; use the existing lesson as an example. New files are discovered even without metadata. For a quiz without “test” or “quiz” in its filename, set `"kind": "test"`.

Every push to `main` builds the catalog, checks local links and publishes `_site` through GitHub Actions. Pages uses GitHub Actions as its source. The site interface and metadata are English; tests, answer explanations and related review controls may use Czech.

See the [upload guide](https://pupitooo.github.io/lukes-english/help.html). Web uploads support files up to 25 MiB; use Git for larger files up to 100 MiB. Do not use Git LFS for Pages assets.

## Anki review

The build adds shared review tools to the eleven current quizzes. Their source HTML stays unchanged. Each graded question gets a checkbox; incorrect answers are selected by default and correct answers can be included manually. Conditional questions are reviewed only after both halves are graded. Baseline questions become available after submission. Changing a baseline answer requires resubmission. A new attempt resets the selection.

The generated prompt contains only selected graded questions, answer choices, the user’s answers, the answer key, available explanations and a stable attempt/question identifier. It requests production cards, deduplication and the existing local Anki workflow. No results are uploaded, and the site does not directly change Anki.

Copy uses the Clipboard API with a manual selection fallback. Native sharing is shown where available. A documented `codex://threads/new?prompt=...` link pre-fills the desktop composer; it is hidden on mobile, where copying/pasting or the system share sheet is available. No message is automatically submitted.

Review supports the supplied classic `Q`-array quiz formats with `#questions` or `#quiz`. Other uploaded HTML still opens normally; it does not acquire a new grading engine automatically.

## Local preview

Python 3.9 or newer is sufficient; no external packages are required:

```sh
python3 scripts/build.py
python3 -m http.server 8000 --directory _site
```

Open `http://localhost:8000`. All paths also work under the GitHub Pages `/lukes-english/` prefix. JavaScript is required. Done markers stay in the current browser; test results are not synchronized.

## Initial content

- Lesson 1, November 2, 2026: 4 HTML materials, 2 MP3 files, 1 Anki deck.
- Conditionals: 5 personal tests of 20 sentences, with two answers per sentence.
- Countable & uncountable: 5 personal tests of 20 questions.

Materials come from the supplied local lesson files and personal tests. This repository grants no additional license to their content.
