"""Render Petr's own stories (content/stories/*.json) into library pages.

Markup inside a version's "en" text:
  {old|new}   a correction: shows "new" highlighted, "old" struck through on demand
  {|new}      an insertion        {old|}  a deletion
  [[text]]    highlights a tense form (present perfect etc.)
"""
import html
import json
import re
from pathlib import Path

TENSES = {
    "past": ("Past narrative",
             "Telling it as a finished story. <b>Past simple</b> (I went, he ran) moves the story forward, "
             "<b>past continuous</b> (I was walking, he was running) sets the scene, and <b>past perfect</b> "
             "(the bus still hadn’t arrived) looks back from that moment."),
    "news": ("Just happened",
             "Telling someone fresh news. <b>Present perfect</b> (I’ve just taken, it hasn’t gone) announces what "
             "happened and why it matters now. Once you give the details, switch to <b>past simple</b>. "
             "Signal words: <i>just, still, yet, already, never</i>."),
    "period": ("A period that isn’t over yet",
               "The “I’ve had a crazy week” pattern. <b>Present perfect</b> describes a time that is still running: "
               "<i>this week, today, so far</i>. Everything counts towards the present moment, so the whole story "
               "stays in present perfect."),
}


def esc(text):
    return html.escape(text, quote=False)


def mark(text):
    text = esc(text)

    def fix(m):
        old = f"<del>{m[1]}</del>" if m[1] else ""
        return f'<span class="fix">{old}<ins>{m[2]}</ins></span>'

    text = re.sub(r"\{([^{}|]*)\|([^{}|]*)\}", fix, text)
    return re.sub(r"\[\[(.+?)\]\]", r'<b class="pp">\1</b>', text)


def load_stories(root):
    stories = []
    for path in sorted((root / "content" / "stories").glob("*.json")):
        data = json.loads(path.read_text())
        data["slug"] = path.stem
        for key in ("title", "description", "original", "versions"):
            if key not in data:
                raise ValueError(f"{path.name}: missing '{key}'")
        for version in data["versions"]:
            if version["tense"] not in TENSES:
                raise ValueError(f"{path.name}: unknown tense '{version['tense']}'")
        stories.append(data)
    stories.sort(key=lambda s: (s.get("order", 999), s["title"].casefold()))
    return stories


def render_story(story):
    parts = []
    for number, version in enumerate(story["versions"], 1):
        label, explanation = TENSES[version["tense"]]
        corrected = version.get("corrected", False)
        parts.append(f'<article class="version" id="v{number}"><header><span class="version-no">Version {number}</span><h3>{label}</h3></header>')
        parts.append(f'<p class="tense">{explanation}</p>')
        if corrected:
            parts.append('<p class="legend"><span class="fix"><ins>corrected</ins></span> marks what was changed. '
                         'Switch on “Show my original wording” at the top to see it struck through.</p>')
        parts.append(f'<div class="text{" corrected" if corrected else ""}" lang="en"><p>{mark(version["en"])}</p></div>')
        parts.append(f'<details class="more"><summary>Show Czech translation</summary><div class="text cz" lang="cs"><p>{esc(version["cz"])}</p></div></details>')
        if corrected:
            parts.append(f'<details class="more"><summary>Show what I originally wrote</summary><div class="text original" lang="en"><p>{esc(story["original"])}</p></div></details>')
            changes = "".join(
                f'<h4>{esc(block["heading"])}</h4><ul>' + "".join(f"<li>{item}</li>" for item in block["items"]) + "</ul>"
                for block in story.get("changes", []))
            if changes:
                parts.append(f'<details class="more"><summary>What changed and why</summary><div class="changes">{changes}</div></details>')
        parts.append("</article>")
    body = "\n".join(parts)
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(story["title"])}</title>
  <link rel="stylesheet" href="../../../assets/style.css">
  <link rel="stylesheet" href="../../../assets/stories.css">
</head>
<body class="story-page">
  <main class="stories-main">
    <p class="eyebrow">MY OWN ENGLISH</p>
    <h1>{esc(story["title"])}</h1>
    <p class="lead">{esc(story["description"])} Written by me, corrected, and retold in other tenses. The original stays hidden until I want to see it.</p>
    <label class="toggle"><input type="checkbox" id="show-was"> Show my original wording inside the corrected text</label>
    {body}
  </main>
  <script>
    (function () {{
      var box = document.getElementById('show-was');
      function apply() {{ document.body.classList.toggle('show-was', box.checked); }}
      box.addEventListener('change', apply);
      apply();
    }})();
  </script>
</body>
</html>
'''


def build_stories(root, out):
    """Write one page per story into _site and return the library group (or None)."""
    stories = load_stories(root)
    if not stories:
        return None
    folder = out / "content" / "topics" / "my-stories"
    folder.mkdir(parents=True, exist_ok=True)
    resources = []
    for story in stories:
        target = folder / f"{story['slug']}.html"
        target.write_text(render_story(story))
        resources.append({
            "path": target.relative_to(out).as_posix(),
            "title": story["title"],
            "description": story["description"],
            "kind": "document",
            "ankiReview": False,
            "extension": "HTML",
            "bytes": target.stat().st_size,
        })
    return {
        "id": "topics/my-stories", "category": "topics", "title": "My stories",
        "description": "My own texts, corrected and retold in other tenses, each with a Czech translation.",
        "date": "", "number": None, "tags": ["Writing", "Tenses"], "resources": resources,
    }
