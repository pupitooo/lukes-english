export const icons = {
  test: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m9 9 1 1 3-3M9 15h6M9 18h4"/>',
  document: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v6h5M9 13h6M9 17h6"/>',
  audio: '<path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  pdf: '<path d="M14 3H5v18h14V8zM14 3v6h5M8 14h8M8 17h5"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
};
export const labels = {test: 'Test', document: 'Notes', audio: 'Listening', download: 'Download', pdf: 'PDF', video: 'Video'};
export function icon(kind) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[kind] || icons.download}</svg>`; }
export function escapeHTML(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export const resourceURL = path => path.split('/').map(encodeURIComponent).join('/');
export const studyURL = path => `study.html?file=${encodeURIComponent(path)}`;
export function formatDate(value) { return value ? new Intl.DateTimeFormat('en-US', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)) : ''; }
export function fileSize(bytes) { return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`; }
export async function loadCatalog() {
  const response = await fetch('assets/catalog.json');
  if (!response.ok) throw new Error('Unable to load materials. Please refresh the page.');
  return response.json();
}
const storageKey = 'lukes-english:completed:v1';
let completed;
export function getCompleted() {
  if (!completed) {
    try { const saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); completed = new Set(Array.isArray(saved) ? saved.filter(x => typeof x === 'string') : []); }
    catch { completed = new Set(); }
  }
  return completed;
}
export function toggleCompleted(path) {
  const set = getCompleted();
  set.has(path) ? set.delete(path) : set.add(path);
  try { localStorage.setItem(storageKey, JSON.stringify([...set])); }
  catch { document.querySelector('#storage-note')?.replaceChildren('This browser cannot save done markers. They will last until you close this page.'); }
  return set.has(path);
}
