#!/usr/bin/env python3
"""Build the library from content folders; Python's standard library is enough."""
import json
import hashlib
import os
import re
import shutil
from datetime import date
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_site"
EXTENSIONS = {
    ".html", ".htm", ".mp3", ".m4a", ".wav", ".ogg", ".mp4", ".webm",
    ".pdf", ".zip", ".txt", ".md", ".docx", ".xlsx", ".pptx",
    ".css", ".js", ".json", ".png", ".jpg", ".jpeg", ".gif", ".svg",
    ".webp", ".woff", ".woff2", ".vtt", ".srt",
}
SUPPORT = {".css", ".js", ".json", ".woff", ".woff2", ".vtt", ".srt"}


class HTMLInfo(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_title = False
        self.title = ""
        self.links = []

    def handle_starttag(self, tag, attrs):
        self.in_title = tag == "title"
        for key, value in attrs:
            if key in {"href", "src", "poster"} and value:
                self.links.append(value)

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


def natural_key(text):
    return [int(x) if x.isdigit() else x.casefold() for x in re.split(r"(\d+)", text)]


def kind_for(path):
    ext = path.suffix.lower()
    if ext in {".html", ".htm"}:
        return "test" if re.search(r"test|quiz", path.stem, re.I) else "document"
    if ext in {".mp3", ".m4a", ".wav", ".ogg"}:
        return "audio"
    if ext in {".mp4", ".webm"}:
        return "video"
    if ext == ".pdf":
        return "pdf"
    return "download"


def enhance_test(destination):
    """Add review tools to supported quizzes without editing the supplied source."""
    text = destination.read_text()
    if not (re.search(r"\b(?:const|let|var)\s+Q\s*=", text)
            and re.search(r'''id=["'](?:questions|quiz)["']''', text)):
        return False
    assets = Path(os.path.relpath(OUT / "assets", destination.parent)).as_posix()
    style = f'<link rel="stylesheet" href="{escape(assets)}/review.css">'
    script = f'<script defer src="{escape(assets)}/review.js"></script>'
    text = re.sub(r"</head\s*>", lambda m: style + m.group(), text, count=1, flags=re.I)
    text = re.sub(r"</body\s*>", lambda m: script + m.group(), text, count=1, flags=re.I)
    destination.write_text(text)
    return True


def build():
    digest = hashlib.sha256()
    sources = [ROOT / 'scripts' / 'build.py']
    for directory in ('site', 'content'):
        sources.extend(path for path in (ROOT / directory).rglob('*')
                       if path.is_file() and not any(part.startswith('.') for part in path.relative_to(ROOT).parts))
    for source in sorted(sources):
        digest.update(source.relative_to(ROOT).as_posix().encode())
        digest.update(source.read_bytes())
    version = digest.hexdigest()[:12]
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(ROOT / "site", OUT)
    groups = []
    for category in ("lessons", "topics"):
        base = ROOT / "content" / category
        if not base.exists():
            continue
        for folder in sorted(base.iterdir()):
            if not folder.is_dir() or folder.name.startswith("."):
                continue
            meta_path = folder / "meta.json"
            meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
            group_date = meta.get("date", folder.name[:10] if category == "lessons" else "")
            if group_date:
                date.fromisoformat(group_date)
            resources = []
            preferred_order = {name: index for index, name in enumerate(meta.get("files", {}))}
            def file_order(path):
                relative = path.relative_to(folder).as_posix()
                return preferred_order.get(relative, len(preferred_order)), natural_key(relative)
            for path in sorted(folder.rglob("*"), key=file_order):
                rel = path.relative_to(folder)
                if path.is_symlink():
                    raise ValueError(f"Symbolic links aren't supported: {path}")
                if not path.is_file() or any(x.startswith(".") for x in rel.parts):
                    continue
                if path == meta_path or path.suffix.lower() not in EXTENSIONS:
                    continue
                destination = OUT / path.relative_to(ROOT)
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, destination)
                if path.suffix.lower() in SUPPORT:
                    continue
                title = path.stem.replace("_", " ")
                if path.suffix.lower() in {".html", ".htm"}:
                    info = HTMLInfo()
                    info.feed(path.read_text())
                    title = info.title.strip() or title
                override = meta.get("files", {}).get(rel.as_posix(), {})
                kind = override.get("kind", kind_for(path))
                review = enhance_test(destination) if kind == "test" else False
                resources.append({
                    "path": path.relative_to(ROOT).as_posix(),
                    "title": override.get("title", title),
                    "description": override.get("description", ""),
                    "kind": kind,
                    "ankiReview": review,
                    "extension": path.suffix[1:].upper(),
                    "bytes": destination.stat().st_size,
                })
            if resources:
                groups.append({
                    "id": f"{category}/{folder.name}", "category": category,
                    "title": meta.get("title", folder.name.replace("-", " ")),
                    "description": meta.get("description", ""), "date": group_date,
                    "number": meta.get("number"), "tags": meta.get("tags", []),
                    "resources": resources,
                })
    groups.sort(key=lambda g: (g["category"] != "lessons", g["title"].casefold()))
    lessons = sorted((g for g in groups if g["category"] == "lessons"), key=lambda g: g["date"], reverse=True)
    groups = lessons + [g for g in groups if g["category"] == "topics"]
    # New builds get fresh HTML, JS and CSS URLs, including standalone quiz pages.
    for path in OUT.rglob('*'):
        if path.is_file() and path.suffix.lower() in {'.html', '.htm', '.js'}:
            text = path.read_text().replace('__BUILD_VERSION__', version)
            if path.suffix.lower() in {'.html', '.htm'}:
                def versioned_link(match):
                    url = urlsplit(match[2])
                    if url.scheme or url.netloc:
                        return match[0]
                    return f'{match[1]}{match[2]}?v={version}{match[3]}'
                text = re.sub(r'''((?:src|href)=["'])([^"']+\.(?:js|css|html?))(["'])''',
                              versioned_link, text)
            path.write_text(text)
    for group in groups:
        for resource in group['resources']:
            resource['bytes'] = (OUT / resource['path']).stat().st_size
    catalog = {"version": 2, "build": version, "groups": groups}
    (OUT / "assets" / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    (OUT / ".nojekyll").touch()
    validate_links()
    print(f"Built {len(groups)} groups, {sum(len(g['resources']) for g in groups)} materials → {OUT}")


def validate_links():
    for path in OUT.rglob("*.html"):
        info = HTMLInfo()
        info.feed(path.read_text())
        for link in info.links:
            url = urlsplit(link)
            if url.scheme or url.netloc or not url.path:
                continue
            target = OUT / unquote(url.path).lstrip("/") if url.path.startswith("/") else path.parent / unquote(url.path)
            if not target.exists():
                raise ValueError(f"Missing link in {path.relative_to(OUT)}: {link}")


if __name__ == "__main__":
    build()
