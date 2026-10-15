import { COLORS, SHAPES, STATES } from './engine';
import type { Activity, Shape } from './engine';
import { AvatarScheduler, AvatarView } from './renderer';
import './style.css';
import { previewPhoto } from './photo';

const labels: Record<Activity, string> = {
  ready: 'Ready',
  thinking: 'Thinking',
  working: 'Working',
  waiting: 'Waiting',
  attention: 'Needs you',
  done: 'Done',
};
const descriptions: Record<Activity, string> = {
  ready: 'A quiet glance. Here when you need them.',
  thinking: 'A curious tilt while a response is being prepared.',
  working: 'Focused eyes and an orbit while a tool is running.',
  waiting: 'A patient sideways look while work is waiting.',
  attention: 'Eyes open. An approval or a decision needs you.',
  done: 'One small nod, then a satisfied resting expression.',
};
const names: Record<Shape, string> = {
  pebble: 'Pebble',
  beacon: 'Beacon',
  petal: 'Petal',
  kite: 'Kite',
  arch: 'Arch',
};
const root = document.querySelector<HTMLDivElement>('#lab')!;
root.innerHTML = `
  <header class="topbar"><a href="/">← Workspace</a><span class="study-label">AVATAR LAB <span> / </span> EXPLORATION 01</span><button id="pause" aria-pressed="false">Pause motion</button></header>
  <main>
    <section class="intro"><p class="eyebrow">PRESENCE, WITH PERSONALITY</p><h1>A little character.<br><span>A clear signal.</span></h1><p>Recognizable teammates. Expressive eyes.<br>Just enough movement to know what’s happening.</p></section>
    <section class="workbench" aria-label="Avatar appearance and activity preview">
      <div class="stage"><div class="stage-caption"><span>YOUR PRIMARY AGENT</span><span class="tag">Preview</span></div><div id="hero" class="hero-avatar"></div><div class="hero-caption"><h2 id="hero-name">Pebble</h2><span class="hero-status" id="hero-status">Thinking</span></div><p class="stage-footnote">The star marks your orchestrator.</p></div>
      <div class="controls"><div class="avatar-type" role="group" aria-label="Avatar type"><button id="shape-mode" aria-pressed="true">Animated shape</button><button id="photo-mode" aria-pressed="false">Photo</button></div><div class="photo-controls" hidden><input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose avatar photo" hidden><button id="choose-photo">Choose photo…</button><button id="remove-photo" hidden>Remove photo</button><p id="photo-status" role="status">Photos stay on your device in this demo. Nothing is uploaded.</p></div><div class="control-section"><div class="section-label"><h2>Give them a look</h2><span>01</span></div><p id="look-description">Choose a shape and color. Their personality stays their own.</p><div class="shape-choices" role="group" aria-label="Avatar shape" id="shapes"></div><div class="color-choices" role="group" aria-label="Avatar color" id="colors"></div><p class="choice-caption"><span id="color-name">Iris</span> · Change it anytime in Settings</p></div><div class="control-section state-section"><div class="section-label"><h2>See them in action</h2><span>02</span></div><div id="states" class="state-choices" role="group" aria-label="Simulated activity"></div><p id="state-description" class="state-description"></p><label class="check-label"><input type="checkbox" id="tour"> Cycle through the states</label></div></div>
    </section>
    <div class="notice"><span class="notice-dot"></span><p>Motion study only. Activity is simulated. Choices stay on this page and do not change your Hermes agents.</p></div>
    <section class="cast-section"><div class="section-heading"><div><p class="eyebrow">ONE FAMILY. DIFFERENT CHARACTERS.</p><h2>Meet the shapes.</h2></div><p>Same visual language, a little different energy.</p></div><div class="cast" id="cast"></div></section>
    <section class="roster-section"><div class="section-heading"><div><p class="eyebrow">A WHOLE TEAM, AT A GLANCE</p><h2>Small faces. Light footprint.</h2></div><div class="count-control" role="group" aria-label="Roster size"><button data-count="24" aria-pressed="true">24</button><button data-count="60" aria-pressed="false">60</button><button data-count="120" aria-pressed="false">120</button></div></div><div id="roster" class="roster" aria-label="Simulated agent roster"></div><div class="roster-footer"><label class="check-label"><input id="reduce" type="checkbox"> Reduce motion</label><p>Avatars outside the screen sleep. Hidden tabs stop animating.</p></div><details><summary>Performance details</summary><div class="metrics" id="metrics" aria-live="off"></div><p class="measurement-note">Live measurements from this browser: animation calculation and SVG updates only. They exclude painting, GPU cost and total CPU usage. Cross-device certification is still ahead.</p></details></section>
    <footer><span>Original vector characters · No images, models or external requests</span><span>Prototype · Not connected to Hermes</span></footer>
  </main>`;

function button(text: string, label: string): HTMLButtonElement {
  const node = document.createElement('button');
  node.textContent = text;
  node.setAttribute('aria-label', label);
  return node;
}
const scheduler = new AvatarScheduler();
let shape: Shape = 'pebble';
let color: (typeof COLORS)[number] = COLORS[0];
let paused = false;
let reducedByUser = false;
let state: Activity = 'thinking';
let photoData: string | null = null;
let photoMode = false;
let photoRequest = 0;
let tourTimer: ReturnType<typeof setTimeout> | undefined;
const reducePreference = matchMedia('(prefers-reduced-motion: reduce)');
const hero = new AvatarView('primary-agent-study', shape, color.hex, state, true, true);
document.querySelector('#hero')!.append(hero.svg);
scheduler.add(hero);
const mini = new AvatarView('onboarding-row', shape, color.hex, 'ready', true);
const shapeButtons = new Map<Shape, HTMLButtonElement>();
const colorButtons: HTMLButtonElement[] = [];
const stateButtons = new Map<Activity, HTMLButtonElement>();

for (const candidate of SHAPES) {
  const pick = button('', names[candidate]);
  const still = new AvatarView(`shape-${candidate}`, candidate, '#b8b9bf', 'ready');
  still.svg.classList.add('shape-thumb');
  pick.append(still.svg);
  pick.setAttribute('aria-pressed', String(candidate === shape));
  pick.title = names[candidate];
  pick.addEventListener('click', () => {
    shape = candidate;
    setPhotoMode(false);
    for (const [key, node] of shapeButtons)
      node.setAttribute('aria-pressed', String(key === shape));
    hero.setAppearance(shape, color.hex);
    mini.setAppearance(shape, color.hex);
    document.querySelector('#hero-name')!.textContent = names[shape];
    scheduler.invalidate();
  });
  shapeButtons.set(candidate, pick);
  document.querySelector('#shapes')!.append(pick);
}
for (const candidate of COLORS) {
  const pick = button('', candidate.label);
  pick.style.setProperty('--swatch', candidate.hex);
  pick.setAttribute('aria-pressed', String(candidate.id === color.id));
  pick.title = candidate.label;
  pick.addEventListener('click', () => {
    color = candidate;
    setPhotoMode(false);
    colorButtons.forEach((node, i) =>
      node.setAttribute('aria-pressed', String(COLORS[i]?.id === color.id)),
    );
    hero.setAppearance(shape, color.hex);
    mini.setAppearance(shape, color.hex);
    document.querySelector('#color-name')!.textContent = color.label;
  });
  colorButtons.push(pick);
  document.querySelector('#colors')!.append(pick);
}
function chooseState(next: Activity) {
  state = next;
  hero.setState(next, scheduler.clock);
  for (const [key, node] of stateButtons) node.setAttribute('aria-pressed', String(key === next));
  document.querySelector('#state-description')!.textContent = descriptions[next];
  document.querySelector('#hero-status')!.textContent = labels[next];
  scheduler.invalidate();
}
for (const next of STATES) {
  const pick = button(labels[next], labels[next]);
  pick.addEventListener('click', () => {
    tour.checked = false;
    clearTimeout(tourTimer);
    chooseState(next);
  });
  stateButtons.set(next, pick);
  document.querySelector('#states')!.append(pick);
}
chooseState(state);
const castStates: Activity[] = ['ready', 'working', 'attention', 'waiting', 'done'];
for (const [i, candidate] of SHAPES.entries()) {
  const card = document.createElement('article');
  const activity = castStates[i]!;
  const view = new AvatarView(
    `cast-${candidate}`,
    candidate,
    COLORS[(i + 1) % COLORS.length]!.hex,
    activity,
  );
  card.append(view.svg);
  const name = document.createElement('h3');
  name.textContent = names[candidate];
  const caption = document.createElement('p');
  caption.textContent = labels[activity];
  card.append(name, caption);
  document.querySelector('#cast')!.append(card);
  scheduler.add(view);
}
let rosterViews: AvatarView[] = [];
function populateRoster(count: number) {
  for (const view of rosterViews) scheduler.remove(view);
  rosterViews = [];
  const roster = document.querySelector('#roster')!;
  roster.replaceChildren();
  for (let i = 0; i < count; i++) {
    const item = document.createElement('div');
    item.className = 'roster-agent';
    const activity = STATES[i % STATES.length]!;
    const view =
      i === 0
        ? mini
        : new AvatarView(
            `roster-agent-${i}`,
            SHAPES[i % SHAPES.length]!,
            COLORS[i % COLORS.length]!.hex,
            activity,
          );
    const caption = document.createElement('div');
    const name = document.createElement('span');
    name.textContent =
      i === 0 ? 'Your primary agent' : `Teammate ${String(i + 1).padStart(2, '0')}`;
    const status = document.createElement('small');
    status.textContent = labels[view.state];
    caption.append(name, status);
    item.append(view.svg, caption);
    if (i === 0 && photoMode && photoData) item.replaceChild(photoNode(true), view.svg);
    roster.append(item);
    rosterViews.push(view);
    if (i !== 0 || !photoMode) scheduler.add(view);
  }
}
populateRoster(24);
document.querySelectorAll<HTMLButtonElement>('[data-count]').forEach((node) =>
  node.addEventListener('click', () => {
    const count = Number(node.dataset.count);
    document
      .querySelectorAll<HTMLButtonElement>('[data-count]')
      .forEach((pick) => pick.setAttribute('aria-pressed', String(pick === node)));
    populateRoster(count);
  }),
);
const tour = document.querySelector<HTMLInputElement>('#tour')!;
const reduce = document.querySelector<HTMLInputElement>('#reduce')!;
const pause = document.querySelector<HTMLButtonElement>('#pause')!;
function scheduleTour() {
  clearTimeout(tourTimer);
  if (!tour.checked || paused || reducePreference.matches || reducedByUser || document.hidden)
    return;
  tourTimer = setTimeout(() => {
    chooseState(STATES[(STATES.indexOf(state) + 1) % STATES.length]!);
    scheduleTour();
  }, 4000);
}
function syncMotion() {
  const effectiveReduced = reducePreference.matches || reducedByUser;
  reduce.checked = effectiveReduced;
  reduce.disabled = reducePreference.matches;
  reduce.title = reducePreference.matches
    ? 'Reduced motion is enabled in your device settings.'
    : '';
  pause.textContent = paused ? 'Resume motion' : 'Pause motion';
  pause.setAttribute('aria-pressed', String(paused));
  scheduler.configure(!paused, effectiveReduced);
  scheduleTour();
}
tour.addEventListener('change', scheduleTour);
pause.addEventListener('click', () => {
  paused = !paused;
  syncMotion();
});
reduce.addEventListener('change', () => {
  reducedByUser = reduce.checked;
  syncMotion();
});
reducePreference.addEventListener('change', syncMotion);
document.addEventListener('visibilitychange', scheduleTour);
scheduler.onStats = (stats) => {
  const metrics = document.querySelector<HTMLDivElement>('#metrics')!;
  metrics.dataset.paints = String(stats.paints);
  metrics.dataset.callbacks = String(stats.callbacks);
  metrics.dataset.running = String(stats.running);
  metrics.dataset.visible = String(stats.visible);
  metrics.dataset.mounted = String(stats.mounted);
  metrics.dataset.p95 = String(stats.p95);
  metrics.dataset.fps = String(stats.fps);
  metrics.textContent = `${stats.visible} / ${stats.mounted} animated faces visible · ${stats.running ? `${stats.fps.toFixed(0)} updates/s` : 'Motion paused'} · p95 update ${stats.p95.toFixed(2)} ms · One shared clock`;
};
syncMotion();
function photoNode(small = false) {
  const wrapper = document.createElement('span');
  wrapper.className = small ? 'photo-wrap small' : 'photo-wrap';
  const image = document.createElement('img');
  image.src = photoData!;
  image.alt = '';
  image.className = 'photo-avatar';
  const badge = document.createElement('span');
  badge.className = 'photo-star';
  badge.textContent = '★';
  badge.setAttribute('aria-hidden', 'true');
  wrapper.append(image, badge);
  return wrapper;
}
function setPhotoMode(enabled: boolean) {
  if (!enabled) photoRequest++;
  photoMode = enabled && !!photoData;
  root.dataset.avatarKind = photoMode ? 'photo' : 'shape';
  document.querySelector<HTMLElement>('.photo-controls')!.hidden = !photoMode;
  document.querySelector('#look-description')!.textContent = photoMode
    ? 'A still photo, with activity shown below it. Switch back to a shape anytime.'
    : 'Choose a shape and color. Their personality stays their own.';
  const heroSlot = document.querySelector('#hero')!;
  const miniSlot = document.querySelector('#roster .roster-agent')!;
  scheduler.remove(hero);
  scheduler.remove(mini);
  if (photoMode) {
    heroSlot.replaceChildren(photoNode());
    miniSlot.firstElementChild?.replaceWith(photoNode(true));
  } else {
    heroSlot.replaceChildren(hero.svg);
    miniSlot.firstElementChild?.replaceWith(mini.svg);
    scheduler.add(hero);
    scheduler.add(mini);
  }
  document.querySelector('#hero-name')!.textContent = photoMode ? 'Photo avatar' : names[shape];
  document.querySelector('#shape-mode')!.setAttribute('aria-pressed', String(!photoMode));
  document.querySelector('#photo-mode')!.setAttribute('aria-pressed', String(photoMode));
  document.querySelector<HTMLButtonElement>('#remove-photo')!.hidden = !photoData;
}
const photoFile = document.querySelector<HTMLInputElement>('#photo-file')!;
document.querySelector('#shape-mode')!.addEventListener('click', () => setPhotoMode(false));
document.querySelector('#photo-mode')!.addEventListener('click', () => {
  if (photoData) setPhotoMode(true);
  else photoFile.click();
});
document.querySelector('#choose-photo')!.addEventListener('click', () => photoFile.click());
document.querySelector('#remove-photo')!.addEventListener('click', () => {
  photoRequest++;
  photoData = null;
  photoFile.value = '';
  setPhotoMode(false);
  document.querySelector('#photo-status')!.textContent = 'Photo removed. Nothing was uploaded.';
});
photoFile.addEventListener('change', async () => {
  const file = photoFile.files?.[0];
  if (!file) return;
  const request = ++photoRequest;
  const status = document.querySelector('#photo-status')!;
  document.querySelector<HTMLElement>('.photo-controls')!.hidden = false;
  status.textContent = 'Preparing your local preview…';
  try {
    const prepared = await previewPhoto(file);
    if (request !== photoRequest) return;
    photoData = prepared;
    setPhotoMode(true);
    status.textContent = 'Private local preview. Nothing uploaded.';
  } catch (error) {
    if (request === photoRequest)
      status.textContent =
        error instanceof Error ? error.message : 'That photo could not be opened.';
  }
  photoFile.value = '';
});
window.addEventListener('pagehide', (event) => {
  clearTimeout(tourTimer);
  if (event.persisted) return;
  scheduler.destroy();
  reducePreference.removeEventListener('change', syncMotion);
  document.removeEventListener('visibilitychange', scheduleTour);
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) syncMotion();
});
