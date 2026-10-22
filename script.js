const audio = document.getElementById('audio');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const addToPlaylistBtn = document.getElementById('addToPlaylistBtn');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const repeatBadge = document.getElementById('repeatBadge');
const seekBar = document.getElementById('seekBar');
const volumeBar = document.getElementById('volumeBar');
const muteBtn = document.getElementById('muteBtn');
const volIcon = document.getElementById('volIcon');
const muteIcon = document.getElementById('muteIcon');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const cover = document.getElementById('cover');
const likeBtn = document.getElementById('likeBtn');
const player = document.getElementById('player');
const progressFill = document.getElementById('progressFill');
const trackListEl = document.getElementById('trackList');
const emptyState = document.getElementById('emptyState');
const viewTitle = document.getElementById('viewTitle');
const viewSubtitle = document.getElementById('viewSubtitle');
const playAllBtn = document.getElementById('playAllBtn');
const allTracksBtn = document.getElementById('allTracksBtn');
const allCount = document.getElementById('allCount');
const playlistList = document.getElementById('playlistList');
const newPlaylistBtn = document.getElementById('newPlaylistBtn');
const playlistModal = document.getElementById('playlistModal');
const playlistNameInput = document.getElementById('playlistNameInput');
const createPlaylistBtn = document.getElementById('createPlaylistBtn');
const cancelPlaylistBtn = document.getElementById('cancelPlaylistBtn');
const toastEl = document.getElementById('toast');

let tracks = [];
let queue = [];
let currentIndex = -1;
let currentPlaylistId = null;
let isShuffle = false;
let repeatMode = 0;
let isSeeking = false;
let lastVolume = 0.8;
let uid = 0;

const store = {
  load() {
    try { return JSON.parse(localStorage.getItem('anyplay_playlists')) || []; }
    catch { return []; }
  },
  save(data) {
    try { localStorage.setItem('anyplay_playlists', JSON.stringify(data)); return true; }
    catch { toast('Хранилище переполнено — трек слишком большой'); return false; }
  }
};
let playlists = store.load();

const colors = ['from-violet-600 to-fuchsia-700', 'from-cyan-500 to-blue-700', 'from-amber-500 to-rose-600', 'from-emerald-500 to-teal-700', 'from-pink-500 to-purple-700'];

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

function formatTime(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function colorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function createTrack(file, dataUrl) {
  const name = file.name.replace(/\.[^.]+$/, '');
  const parts = name.split(' - ');
  return {
    id: ++uid,
    title: parts.length > 1 ? parts[1].trim() : name,
    artist: parts.length > 1 ? parts[0].trim() : 'Неизвестный исполнитель',
    src: dataUrl || URL.createObjectURL(file),
    duration: 0,
    color: colorFor(name),
    isObjectUrl: !dataUrl
  };
}

async function loadFiles(files, autoplay = true) {
  const list = [...files].filter(f => f.type.startsWith('audio') || /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(f.name));
  if (!list.length) { toast('Не найдено аудиофайлов'); return; }
  for (const file of list) {
    let dataUrl = null;
    if (file.size < 12 * 1024 * 1024) {
      try { dataUrl = await fileToDataURL(file); } catch {}
    }
    tracks.push(createTrack(file, dataUrl));
  }
  renderTracks();
  renderPlaylists();
  if (autoplay) playTrack(queueOfView().findIndex(t => tracks[tracks.length - list.length] === t));
  toast(`Добавлено треков: ${list.length}`);
}

function queueOfView() {
  return currentPlaylistId ? tracks.filter(t => playlistTracks(currentPlaylistId).includes(t.id)) : tracks;
}

function playlistTracks(id) {
  const p = playlists.find(p => p.id === id);
  return p ? p.trackIds : [];
}

function playTrack(index) {
  const q = queueOfView();
  if (index < 0 || index >= q.length) return;
  queue = q;
  currentIndex = index;
  const t = queue[currentIndex];
  audio.src = t.src;
  audio.play().catch(() => {});
  trackTitle.textContent = t.title;
  trackArtist.textContent = t.artist;
  cover.className = `w-14 h-14 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20`;
  player.classList.remove('translate-y-full');
  player.classList.add('playing-glow');
  renderTracks();
  updateLikeBtn();
}

function playAll() {
  const q = queueOfView();
  if (q.length) playTrack(0);
}

function nextTrack(auto = false) {
  const q = queueOfView();
  if (!q.length) return;
  let i;
  if (isShuffle && q.length > 1) {
    do { i = Math.floor(Math.random() * q.length); } while (i === currentIndex);
  } else {
    i = currentIndex + 1;
    if (i >= q.length) {
      if (repeatMode === 2 || !auto) i = 0;
      else { audio.pause(); return; }
    }
  }
  playTrack(i);
}

function prevTrack() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  const q = queueOfView();
  playTrack((currentIndex - 1 + q.length) % q.length);
}

function togglePlay() {
  if (!audio.src) { playAll(); return; }
  audio.paused ? audio.play() : audio.pause();
}

function toggleLike() {
  if (currentIndex < 0) return;
  let fav = playlists.find(p => p.id === 'fav');
  if (!fav) {
    fav = { id: 'fav', name: 'Избранное', trackIds: [] };
    playlists.unshift(fav);
  }
  const t = queue[currentIndex];
  const i = fav.trackIds.indexOf(t.id);
  if (i >= 0) { fav.trackIds.splice(i, 1); toast('Удалено из избранного'); }
  else { fav.trackIds.push(t.id); toast('Добавлено в избранное'); }
  store.save(playlists);
  renderPlaylists();
  updateLikeBtn();
  if (currentPlaylistId === 'fav') renderTracks();
}

function updateLikeBtn() {
  if (currentIndex < 0) return;
  const fav = playlists.find(p => p.id === 'fav');
  const liked = fav && fav.trackIds.includes(queue[currentIndex].id);
  likeBtn.classList.toggle('text-fuchsia-400', !!liked);
  likeBtn.classList.toggle('text-slate-500', !liked);
}

function createPlaylist(name) {
  if (!name.trim()) return;
  const p = { id: 'pl_' + Date.now(), name: name.trim(), trackIds: [] };
  playlists.push(p);
  store.save(playlists);
  renderPlaylists();
  selectPlaylist(p.id);
  toast(`Плейлист «${p.name}» создан`);
}

function deletePlaylist(id) {
  playlists = playlists.filter(p => p.id !== id);
  store.save(playlists);
  if (currentPlaylistId === id) selectPlaylist(null);
  renderPlaylists();
  toast('Плейлист удалён');
}

function renamePlaylist(id, name) {
  const p = playlists.find(p => p.id === id);
  if (!p || !name.trim()) return;
  p.name = name.trim();
  store.save(playlists);
  renderPlaylists();
  renderTracks();
}

function addCurrentQueueToPlaylist(playlistId) {
  const p = playlists.find(p => p.id === playlistId);
  if (!p) return;
  let added = 0;
  for (const t of queueOfView()) {
    if (!p.trackIds.includes(t.id)) { p.trackIds.push(t.id); added++; }
  }
  if (added) {
    if (store.save(playlists)) toast(`Добавлено треков: ${added} → «${p.name}»`);
  } else toast('Все треки уже в плейлисте');
  renderPlaylists();
}

function removeTrackFromPlaylist(trackId) {
  if (!currentPlaylistId) {
    tracks = tracks.filter(t => t.id !== trackId);
    queue = queue.filter(t => t.id !== trackId);
    playlists.forEach(p => p.trackIds = p.trackIds.filter(id => id !== trackId));
    store.save(playlists);
    renderPlaylists();
  } else {
    const p = playlists.find(p => p.id === currentPlaylistId);
    p.trackIds = p.trackIds.filter(id => id !== trackId);
    store.save(playlists);
  }
  if (currentIndex >= queue.length) currentIndex = queue.length - 1;
  renderTracks();
}

function selectPlaylist(id) {
  currentPlaylistId = id;
  document.querySelectorAll('[data-pl]').forEach(el => el.classList.toggle('selected', el.dataset.pl === id));
  allTracksBtn.classList.toggle('border-violet-500', !id);
  allTracksBtn.classList.toggle('border-slate-700', !!id);
  renderTracks();
}

function renderPlaylists() {
  playlistList.innerHTML = '';
  allCount.textContent = tracks.length;
  playlists.filter(p => p.id !== 'fav').concat(playlists.filter(p => p.id === 'fav')).forEach(p => {
    const btn = document.createElement('div');
    btn.dataset.pl = p.id;
    btn.className = `playlist-item w-full text-left px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 border border-transparent ${currentPlaylistId === p.id ? 'selected' : ''}`;
    btn.innerHTML = `
      <svg class="w-4 h-4 ${p.id === 'fav' ? 'text-fuchsia-400' : 'text-slate-400'}" fill="${p.id === 'fav' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z"/></svg>
      <span class="text-sm font-medium truncate flex-1">${p.id === 'fav' ? 'Избранное' : p.name}</span>
      <span class="text-xs text-slate-500">${p.trackIds.length}</span>
      ${p.id !== 'fav' ? `<button class="icon-btn text-slate-500" data-del="${p.id}" title="Удалить">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
      </button>` : ''}`;
    btn.addEventListener('click', e => {
      const del = e.target.closest('[data-del]');
      if (del) { deletePlaylist(del.dataset.del); return; }
      if (e.target.closest('[data-addq]')) { addCurrentQueueToPlaylist(p.id); return; }
      selectPlaylist(p.id);
    });
    if (p.id !== 'fav' && queueOfView().length) {
      const addBtn = document.createElement('button');
      addBtn.className = 'icon-btn text-slate-500';
      addBtn.dataset.addq = '1';
      addBtn.title = 'Добавить текущую очередь';
      addBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>';
      btn.insertBefore(addBtn, btn.lastElementChild);
    }
    playlistList.appendChild(btn);
  });
}

function renderTracks() {
  const q = queueOfView();
  trackListEl.innerHTML = '';
  emptyState.style.display = q.length ? 'none' : 'flex';
  const pl = currentPlaylistId ? playlists.find(p => p.id === currentPlaylistId) : null;
  viewTitle.textContent = pl ? pl.name : 'Все треки';
  viewSubtitle.textContent = q.length ? `${q.length} ${q.length === 1 ? 'трек' : q.length < 5 ? 'трека' : 'треков'}` : 'Загрузите файлы, чтобы начать';
  addToPlaylistBtn.classList.toggle('hidden', !pl || !q.length);
  q.forEach((t, i) => {
    const isActive = queue[currentIndex] && queue[currentIndex].id === t.id;
    const row = document.createElement('div');
    row.className = `track-row flex items-center gap-4 px-4 py-3 rounded-xl border border-transparent cursor-pointer transition-colors ${isActive ? 'active' : ''}`;
    row.style.animationDelay = `${i * 0.03}s`;
    row.innerHTML = `
      <div class="w-10 h-10 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center shrink-0 relative">
        ${isActive && !audio.paused
          ? '<div class="eq playing"><span></span><span></span><span></span></div>'
          : `<span class="text-sm font-bold text-white/90">${i + 1}</span>`}
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-medium text-sm truncate ${isActive ? 'text-violet-300' : ''}">${t.title}</div>
        <div class="text-xs text-slate-500 truncate">${t.artist}</div>
      </div>
      <div class="text-xs text-slate-500 font-mono">${formatTime(t.duration)}</div>
      <button class="icon-btn text-slate-500" data-remove title="Удалить">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
      </button>`;
    row.addEventListener('click', e => {
      if (e.target.closest('[data-remove]')) { removeTrackFromPlaylist(t.id); return; }
      playTrack(i);
    });
    trackListEl.appendChild(row);
  });
}

function updateProgressUI() {
  const d = audio.duration || 0;
  const c = audio.currentTime || 0;
  const pct = d ? (c / d) * 100 : 0;
  currentTimeEl.textContent = formatTime(c);
  durationEl.textContent = formatTime(d);
  progressFill.style.width = pct + '%';
  if (!isSeeking) {
    seekBar.value = d ? (c / d) * 1000 : 0;
    seekBar.style.setProperty('--fill', pct + '%');
  }
}

uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => { loadFiles(e.target.files); fileInput.value = ''; });

playBtn.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', () => nextTrack(false));
prevBtn.addEventListener('click', prevTrack);
likeBtn.addEventListener('click', toggleLike);
playAllBtn.addEventListener('click', playAll);
allTracksBtn.addEventListener('click', () => selectPlaylist(null));
addToPlaylistBtn.addEventListener('click', () => {
  const q = queueOfView();
  if (!q.length) return;
  const name = prompt('Добавить текущие треки в новый плейлист. Введите название:');
  if (name && name.trim()) {
    createPlaylist(name);
    addCurrentQueueToPlaylist(playlists[playlists.length - 1].id);
  }
});

shuffleBtn.addEventListener('click', () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle('text-violet-400', isShuffle);
  shuffleBtn.classList.toggle('text-slate-500', !isShuffle);
  toast(isShuffle ? 'Перемешивание включено' : 'Перемешивание выключено');
});

repeatBtn.addEventListener('click', () => {
  repeatMode = (repeatMode + 1) % 3;
  repeatBtn.classList.toggle('text-violet-400', repeatMode > 0);
  repeatBtn.classList.toggle('text-slate-500', repeatMode === 0);
  repeatBadge.classList.toggle('hidden', repeatMode !== 1);
  toast(['Повтор выключен', 'Повтор трека', 'Повтор очереди'][repeatMode]);
});

seekBar.addEventListener('input', () => {
  isSeeking = true;
  const pct = seekBar.value / 10;
  seekBar.style.setProperty('--fill', pct + '%');
  if (audio.duration) {
    currentTimeEl.textContent = formatTime((pct / 100) * audio.duration);
    progressFill.style.width = pct + '%';
  }
});
seekBar.addEventListener('change', () => {
  if (audio.duration) audio.currentTime = (seekBar.value / 1000) * audio.duration;
  isSeeking = false;
});

volumeBar.addEventListener('input', () => {
  audio.volume = volumeBar.value / 100;
  audio.muted = false;
  volumeBar.style.setProperty('--fill', volumeBar.value + '%');
  updateVolIcon();
});

muteBtn.addEventListener('click', () => {
  if (audio.muted || audio.volume === 0) {
    audio.muted = false;
    audio.volume = lastVolume || 0.8;
    volumeBar.value = audio.volume * 100;
  } else {
    lastVolume = audio.volume;
    audio.muted = true;
    volumeBar.value = 0;
  }
  volumeBar.style.setProperty('--fill', volumeBar.value + '%');
  updateVolIcon();
});

function updateVolIcon() {
  const v = audio.muted ? 0 : audio.volume;
  volIcon.classList.toggle('hidden', v === 0);
  muteIcon.classList.toggle('hidden', v > 0);
}

newPlaylistBtn.addEventListener('click', () => {
  playlistModal.classList.remove('hidden');
  playlistModal.classList.add('flex');
  playlistNameInput.value = '';
  setTimeout(() => playlistNameInput.focus(), 50);
});

function closeModal() {
  playlistModal.classList.add('hidden');
  playlistModal.classList.remove('flex');
}

cancelPlaylistBtn.addEventListener('click', closeModal);
playlistModal.addEventListener('click', e => { if (e.target === playlistModal) closeModal(); });
createPlaylistBtn.addEventListener('click', () => { createPlaylist(playlistNameInput.value); closeModal(); });
playlistNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { createPlaylist(playlistNameInput.value); closeModal(); } });

audio.addEventListener('play', () => {
  playIcon.classList.add('hidden');
  pauseIcon.classList.remove('hidden');
  renderTracks();
});
audio.addEventListener('pause', () => {
  playIcon.classList.remove('hidden');
  pauseIcon.classList.add('hidden');
  renderTracks();
});
audio.addEventListener('timeupdate', updateProgressUI);
audio.addEventListener('loadedmetadata', () => {
  const t = queue[currentIndex];
  if (t) { t.duration = audio.duration; renderTracks(); }
  updateProgressUI();
});
audio.addEventListener('ended', () => {
  if (repeatMode === 1) { audio.currentTime = 0; audio.play(); }
  else nextTrack(true);
});
audio.addEventListener('error', () => {
  if (audio.src) { toast('Не удалось воспроизвести трек'); nextTrack(true); }
});

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight' && audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
  if (e.code === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
  if (e.code === 'ArrowUp') { e.preventDefault(); volumeBar.value = Math.min(100, +volumeBar.value + 5); volumeBar.dispatchEvent(new Event('input')); }
  if (e.code === 'ArrowDown') { e.preventDefault(); volumeBar.value = Math.max(0, +volumeBar.value - 5); volumeBar.dispatchEvent(new Event('input')); }
});

audio.volume = 0.8;
volumeBar.style.setProperty('--fill', '80%');
renderPlaylists();
renderTracks();
