import {loadCatalog, escapeHTML as e, resourceURL, studyURL, icon, labels, fileSize, getCompleted, toggleCompleted} from './shared.js';
const $ = id => document.getElementById(id);
let activePath;
function updateDone() {
  const done = getCompleted().has(activePath);
  $('mark-done').setAttribute('aria-pressed', String(done));
  $('mark-done').textContent = done ? '✓ Hotovo' : 'Označit jako hotové';
}
$('mark-done').addEventListener('click', () => { toggleCompleted(activePath); updateDone(); });
$('resource-picker').addEventListener('change', event => { location.href = studyURL(event.target.value); });
try {
  const {groups} = await loadCatalog();
  activePath = new URLSearchParams(location.search).get('file');
  const group = groups.find(g => g.resources.some(r => r.path === activePath));
  if (!group) throw new Error('Tento materiál v knihovně není.');
  const resource = group.resources.find(r => r.path === activePath);
  const url = resourceURL(resource.path);
  document.title = `${resource.title} · Luke's English`;
  $('group-title').textContent = group.title;
  $('group-category').textContent = group.category === 'lessons' ? 'LEKCE S LUKEM' : 'VLASTNÍ TÉMA';
  $('resource-title').textContent = resource.title;
  $('original').href = url;
  document.querySelector('.back-link').href = `./#${group.id.replace('/', '-')}`;
  $('siblings').innerHTML = group.resources.map(r => `<li><a href="${e(studyURL(r.path))}"${r.path === activePath ? ' aria-current="page"' : ''}>${icon(r.kind)}<span>${e(r.title)}</span></a></li>`).join('');
  $('resource-picker').innerHTML = group.resources.map(r => `<option value="${e(r.path)}"${r.path === activePath ? ' selected' : ''}>${e(r.title)} · ${e(labels[r.kind] || r.extension)}</option>`).join('');
  document.querySelector('.mobile-picker').hidden = false;
  document.querySelector('.reader-toolbar').hidden = false;
  updateDone();
  if (['test','document','pdf'].includes(resource.kind)) {
    const frame = document.createElement('iframe');
    frame.title = resource.title;
    frame.src = url;
    // Keep the portal heading and selected item in sync with links inside the original tests.
    frame.addEventListener('load', () => {
      try {
        const current = new URL(frame.contentWindow.location.href);
        const sibling = group.resources.find(r => new URL(resourceURL(r.path), location.href).href === current.href);
        if (sibling && sibling.path !== activePath) location.replace(studyURL(sibling.path));
      } catch { /* PDF readers or external destinations may not expose their location. */ }
    });
    $('stage').replaceChildren(frame);
  } else {
    const media = ['audio','video'].includes(resource.kind) ? `<${resource.kind} controls preload="metadata" src="${e(url)}">Tvůj prohlížeč přehrávač nepodporuje. Stáhni si soubor níže.</${resource.kind}>` : '';
    $('stage').innerHTML = `<section class="media-card"><span class="resource-icon ${e(resource.kind)}">${icon(resource.kind)}</span><p class="eyebrow">${e(labels[resource.kind] || resource.extension)}</p><h3>${e(resource.title)}</h3><p>${e(resource.description)}</p>${media}<p class="media-meta">${e(resource.extension)} · ${e(fileSize(resource.bytes))}</p><a class="button" href="${e(url)}" download>Stáhnout ${e(resource.extension)} <span aria-hidden="true">↓</span></a></section>`;
  }
} catch (error) {
  $('stage').innerHTML = `<p class="reader-status" role="alert">${e(error.message)} <a href="./">Zpět do knihovny</a></p>`;
}
