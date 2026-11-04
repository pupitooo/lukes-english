import {icon, labels, escapeHTML as e, resourceURL, studyURL, formatDate, getCompleted, toggleCompleted, loadCatalog} from './shared.js?v=__BUILD_VERSION__';

const $ = id => document.getElementById(id);
let groups = [], filter = new URLSearchParams(location.search).get('view') || 'all';
if (!['all', 'lessons', 'topics'].includes(filter)) filter = 'all';
const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const plural = (n, word) => n === 1 ? word : `${word}s`;

function resourceRow(r) {
  const done = getCompleted().has(r.path), download = r.kind === 'download';
  return `<li class="resource-row${done ? ' is-done' : ''}"><a class="resource-link" href="${e(download ? resourceURL(r.path) : studyURL(r.path))}"${download ? ' download' : ''}><span class="resource-icon ${e(r.kind)}">${icon(r.kind)}</span><span class="resource-copy"><strong>${e(r.title)}</strong>${r.description ? `<small>${e(r.description)}</small>` : ''}</span><span class="kind-label">${e(r.kind === 'download' ? r.extension : labels[r.kind] || r.extension)}</span><span class="row-arrow" aria-hidden="true">${download ? '↓' : '↗'}</span></a>${download ? '' : `<button class="done-toggle" type="button" data-done="${e(r.path)}" aria-label="Mark ${e(r.title)} as done" aria-pressed="${done}" title="Mark as done">${done ? '✓' : '<span></span>'}</button>`}</li>`;
}

function groupCard(g, resources) {
  const lesson = g.category === 'lessons';
  const n = g.resources.filter(r => r.kind !== 'download').length;
  const done = g.resources.filter(r => r.kind !== 'download' && getCompleted().has(r.path)).length;
  return `<article class="group-card ${lesson ? 'lesson-card' : 'topic-card'}" id="${e(g.id.replace('/', '-'))}" aria-labelledby="title-${e(g.id.replace('/', '-'))}"><div class="group-intro"><div class="group-kicker">${lesson ? `<span class="lesson-number">${String(g.number || 'L').padStart(2, '0')}</span><span>${e(formatDate(g.date))}</span>` : `<span class="topic-icon">${icon('test')}</span><span>MY TOPIC</span>`}</div><h3 id="title-${e(g.id.replace('/', '-'))}">${e(g.title)}</h3><p>${e(g.description)}</p><div class="tags">${g.tags.map(t => `<span>${e(t)}</span>`).join('')}</div><div class="group-progress"><span>${done} of ${n} done</span><progress value="${done}" max="${n || 1}" aria-label="Completed materials: ${done} of ${n}"></progress></div></div><ul class="resource-list">${resources.map(resourceRow).join('')}</ul></article>`;
}

function render() {
  const query = normalize($('search').value.trim());
  const visible = groups.filter(g => filter === 'all' || g.category === filter).map(g => {
    const groupMatch = normalize([g.title, g.description, ...g.tags, g.date, formatDate(g.date)].join(' ')).includes(query);
    return {group:g, resources:groupMatch ? g.resources : g.resources.filter(r => normalize(`${r.title} ${r.description} ${r.extension} ${labels[r.kind]}`).includes(query))};
  }).filter(item => item.resources.length);
  $('groups').innerHTML = ['lessons', 'topics'].map(category => {
    const items = visible.filter(item => item.group.category === category);
    if (!items.length) return '';
    return `<section class="category-section" aria-label="${category === 'lessons' ? 'Lessons with Luke' : 'My topics'}"><div class="category-heading"><h3>${category === 'lessons' ? 'Lessons with Luke' : 'My topics'}</h3><span>${items.length} ${category === 'lessons' ? plural(items.length, 'lesson') : plural(items.length, 'topic')}</span></div><div class="${category === 'topics' ? 'topic-grid' : 'lesson-grid'}">${items.map(({group,resources}) => groupCard(group, resources)).join('')}</div></section>`;
  }).join('');
  $('empty').hidden = !!visible.length;
  const matches = visible.reduce((n, item) => n + item.resources.length, 0);
  $('load-status').textContent = query ? `${matches} ${plural(matches, 'material')} found` : '';
  document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
}

function setFilter(value) {
  filter = value;
  const url = new URL(location.href);
  value === 'all' ? url.searchParams.delete('view') : url.searchParams.set('view', value);
  history.replaceState(null, '', url);
  render();
}

document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => setFilter(button.dataset.filter)));
document.querySelectorAll('[data-view]').forEach(link => link.addEventListener('click', () => { $('search').value = ''; setFilter(link.dataset.view); }));
$('search').addEventListener('input', render);
$('groups').addEventListener('click', event => {
  const button = event.target.closest('[data-done]');
  if (!button) return;
  const scroll = window.scrollY;
  const path = button.dataset.done;
  toggleCompleted(path);
  render();
  [...document.querySelectorAll('[data-done]')].find(b => b.dataset.done === path)?.focus({preventScroll:true});
  window.scrollTo(0, scroll);
});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
window.addEventListener('storage', () => location.reload());

try {
  ({groups} = await loadCatalog());
  $('lesson-count').textContent = groups.filter(g => g.category === 'lessons').length;
  $('test-count').textContent = groups.filter(g => g.category === 'topics').flatMap(g => g.resources).filter(r => r.kind === 'test').length;
  $('audio-count').textContent = groups.flatMap(g => g.resources).filter(r => r.kind === 'audio').length;
  const lessons = Number($('lesson-count').textContent), tests = Number($('test-count').textContent), audio = Number($('audio-count').textContent);
  $('lesson-label').textContent = `${plural(lessons, 'lesson')} with Luke`;
  $('test-label').textContent = `practice ${plural(tests, 'test')}`;
  $('audio-label').textContent = `listening ${plural(audio, 'track')}`;
  $('all-count').textContent = groups.length;
  const latest = groups.find(g => g.category === 'lessons');
  if (latest) {
    $('latest-link').href = `#${latest.id.replace('/', '-')}`;
    $('latest-link').addEventListener('click', () => { $('search').value = ''; setFilter('lessons'); });
  } else $('latest-link').hidden = true;
  render();
} catch (error) { $('load-status').textContent = `${error.message} You can also use the repository link below.`; }
