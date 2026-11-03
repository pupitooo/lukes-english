# Luke’s English

Petrova knihovna lekcí s Lukem, HTML testů, poslechu a vlastních témat.

**Web: https://pupitooo.github.io/lukes-english/**

## Přidávání materiálů

- Lekce: `content/lessons/RRRR-MM-DD/`
- Vlastní témata: `content/topics/nazev-tematu/`

Nahraj do jedné složky HTML a související MP3 nebo jiné přílohy. Názvy a vzájemné relativní odkazy zachovej. Do složky můžeš přidat `meta.json` s názvem, popisem, datem, číslem lekce, štítky a názvy jednotlivých souborů. Podívej se na existující lekci jako na vzor. Metadata jsou volitelná; nové soubory se objeví automaticky i bez nich. U HTML testu bez „test“ nebo „quiz“ v názvu můžeš nastavit `"kind": "test"`.

Po každé změně v `main` GitHub Actions vygenerují katalog, ověří místní odkazy a publikují web na GitHub Pages. Nasazuje se pouze složka `_site`, nikoli provozní soubory repozitáře. V Settings → Pages je zdrojem GitHub Actions.

Podrobný návod je také na [webu](https://pupitooo.github.io/lukes-english/help.html). Přes web GitHubu nahraj soubory do 25 MB; větší soubory do 100 MB přes Git. Git LFS není pro tyto Pages soubory určený.

## Lokální náhled

Stačí Python 3.10 nebo novější, bez externích balíčků:

```sh
python3 scripts/build.py
python3 -m http.server 8000 --directory _site
```

Otevři `http://localhost:8000`. Portál funguje i v podsložce `/lukes-english/` na GitHub Pages. Vyžaduje JavaScript. Původní testy a přílohy zůstávají obsahově beze změn. Označení hotovo je místní v daném prohlížeči; výsledky testů se nesynchronizují.

## Výchozí obsah

- Lekce 1, 2. listopadu 2026: 4 HTML materiály, 2 MP3, 1 Anki balíček.
- Conditionals: 5 vlastních testů po 20 otázkách.
- Countable & uncountable: 5 vlastních testů po 20 otázkách.

Materiály od Luka a vlastní testy jsou vložené z dodaných místních podkladů. Repozitář neuděluje další licenci k jejich obsahu.
