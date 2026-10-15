import { BODY_PATHS, blendPose, nextPoseDelay, samplePose, seedFromId } from './engine';
import type { Activity, Pose, Shape } from './engine';

const NS = 'http://www.w3.org/2000/svg';
function element<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}
const fixed = (value: number) => value.toFixed(3);
const written = new WeakMap<Element, Map<string, string>>();
function update(node: Element, key: string, value: string) {
  let cache = written.get(node);
  if (!cache) {
    cache = new Map();
    written.set(node, cache);
  }
  if (cache.get(key) === value) return;
  node.setAttribute(key, value);
  cache.set(key, value);
}

export class AvatarView {
  readonly svg = element('svg', {
    viewBox: '0 0 100 108',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  private readonly body = element('g');
  private readonly silhouette = element('path');
  private readonly face = element('g', { fill: '#222329' });
  private readonly left = element('rect', { x: '-4', y: '-9', width: '8', height: '18', rx: '4' });
  private readonly right = element('rect', { x: '-4', y: '-9', width: '8', height: '18', rx: '4' });
  private readonly orbit = element('g', {
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.5',
  });
  private readonly dots = [38, 50, 62].map((cx) =>
    element('circle', { cx: String(cx), cy: '101', r: '2' }),
  );
  private readonly attention = element('g');
  private readonly done = element('path', {
    d: 'M73 13 L77 17 L85 8',
    fill: 'none',
    stroke: '#e7eddd',
    'stroke-width': '3',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  private readonly star = element('path', {
    d: 'M82 6 L84 11 L90 12 L85 16 L86 22 L82 19 L77 22 L78 16 L74 12 L80 11 Z',
    transform: 'translate(0 71)',
    fill: '#efe8d2',
    stroke: '#191a1d',
    'stroke-width': '2',
  });
  private readonly seed: number;
  private lastPose: Pose | undefined;
  private transitionPose: Pose | undefined;
  state: Activity;
  changedAt = 0;
  nextAt = 0;

  constructor(
    id: string,
    shape: Shape,
    color: string,
    state: Activity,
    orchestrator = false,
    readonly large = false,
  ) {
    this.seed = seedFromId(id);
    this.state = state;
    this.svg.classList.add('avatar');
    this.orbit.append(
      element('ellipse', {
        cx: '50',
        cy: '51',
        rx: '46',
        ry: '41',
        'stroke-dasharray': '13 230',
        'stroke-linecap': 'round',
      }),
    );
    this.face.append(this.left, this.right);
    this.body.append(this.silhouette, this.face);
    this.attention.append(
      element('circle', {
        cx: '83',
        cy: '19',
        r: '9',
        fill: '#f2dfae',
        stroke: '#191a1d',
        'stroke-width': '2',
      }),
      element('path', {
        d: 'M83 14 V20 M83 24 V24.3',
        stroke: '#25262b',
        'stroke-width': '2.2',
        'stroke-linecap': 'round',
      }),
    );
    this.svg.append(this.orbit, this.body, ...this.dots, this.attention, this.done);
    if (orchestrator) this.svg.append(this.star);
    this.setAppearance(shape, color);
    this.render(0, true);
  }

  setAppearance(shape: Shape, color: string) {
    this.silhouette.setAttribute('d', BODY_PATHS[shape]);
    this.silhouette.setAttribute('fill', color);
    this.svg.style.color = color;
    for (const dot of this.dots) dot.setAttribute('fill', color);
  }

  setState(state: Activity, clock: number) {
    this.transitionPose = this.lastPose;
    this.state = state;
    this.changedAt = clock;
  }

  render(clock: number, reduced: boolean, crowded = false) {
    const target = samplePose(this.state, clock - this.changedAt, this.seed, reduced);
    const progress = (clock - this.changedAt) / 280;
    const pose =
      !reduced && this.transitionPose && progress < 1
        ? blendPose(this.transitionPose, target, progress)
        : target;
    this.lastPose = pose;
    const fps = this.large && !crowded ? 24 : 15;
    this.nextAt = reduced
      ? Infinity
      : clock +
        (progress < 1 && this.transitionPose
          ? 1000 / fps
          : nextPoseDelay(this.state, clock - this.changedAt, this.seed, fps));
    update(
      this.body,
      'transform',
      `translate(${fixed(pose.x)} ${fixed(pose.y)}) translate(50 50) rotate(${fixed(pose.rotation)}) scale(${fixed(pose.sx)} ${fixed(pose.sy)}) translate(-50 -50)`,
    );
    update(this.face, 'transform', `translate(${fixed(pose.gazeX)} ${fixed(pose.gazeY)})`);
    update(
      this.left,
      'transform',
      `translate(39 49) rotate(${fixed(pose.leftTilt)}) scale(1 ${fixed(pose.leftOpen)})`,
    );
    update(
      this.right,
      'transform',
      `translate(60 49) rotate(${fixed(pose.rightTilt)}) scale(1 ${fixed(pose.rightOpen)})`,
    );
    update(this.orbit, 'transform', `rotate(${fixed(pose.orbit)} 50 51)`);
    update(this.orbit, 'opacity', String(pose.orbitOpacity));
    this.dots.forEach((dot, i) => update(dot, 'opacity', String(pose.dots[i])));
    update(this.attention, 'display', this.state === 'attention' ? 'inline' : 'none');
    update(this.done, 'display', this.state === 'done' ? 'inline' : 'none');
  }
}

export interface FrameStats {
  mounted: number;
  visible: number;
  paints: number;
  callbacks: number;
  p95: number;
  fps: number;
  running: boolean;
}

/** One deadline clock. Idle rows park; observers wake newly visible faces. */
export class AvatarScheduler {
  private readonly views = new Map<Element, AvatarView>();
  private readonly visible = new Set<AvatarView>();
  private readonly observer: IntersectionObserver;
  private frame: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastReport = performance.now();
  private samples: number[] = [];
  private paints = 0;
  private totalPaints = 0;
  private callbacks = 0;
  private enabled = true;
  private reduced = false;
  private elapsed = 0;
  private resumedAt = performance.now();
  private advancing = true;
  onStats: (stats: FrameStats) => void = () => {};

  get clock() {
    return this.elapsed + (this.advancing ? performance.now() - this.resumedAt : 0);
  }

  constructor() {
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const view = this.views.get(entry.target);
        if (!view) continue;
        if (entry.isIntersecting) {
          this.visible.add(view);
          view.render(this.clock, this.reduced || !this.enabled, this.visible.size > 60);
        } else this.visible.delete(view);
      }
      this.sync();
    });
    document.addEventListener('visibilitychange', this.sync);
  }

  add(view: AvatarView) {
    this.views.set(view.svg, view);
    this.observer.observe(view.svg);
    view.render(this.clock, this.reduced || !this.enabled);
  }
  remove(view: AvatarView) {
    this.observer.unobserve(view.svg);
    this.views.delete(view.svg);
    this.visible.delete(view);
    this.sync();
  }
  configure(enabled: boolean, reduced: boolean) {
    this.enabled = enabled;
    this.reduced = reduced;
    this.sync();
    this.invalidate();
  }
  invalidate() {
    const clock = this.clock;
    for (const view of this.views.values())
      view.render(clock, this.reduced || !this.enabled, this.visible.size > 60);
    this.sync();
  }
  private shouldRun() {
    return this.enabled && !this.reduced && !document.hidden && this.visible.size > 0;
  }
  private cancel() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    if (this.timer !== null) clearTimeout(this.timer);
    this.frame = this.timer = null;
  }
  private sync = () => {
    this.cancel();
    const advancing = this.enabled && !this.reduced && !document.hidden;
    if (advancing !== this.advancing) {
      this.elapsed = this.clock;
      this.resumedAt = performance.now();
      this.advancing = advancing;
    }
    this.schedule();
    this.report();
  };
  private schedule() {
    if (!this.shouldRun()) return;
    let deadline = Infinity;
    for (const view of this.visible) deadline = Math.min(deadline, view.nextAt);
    if (!Number.isFinite(deadline)) return;
    const wait = deadline - this.clock;
    if (wait <= 8) this.frame = requestAnimationFrame(this.tick);
    else
      this.timer = setTimeout(() => {
        this.timer = null;
        this.frame = requestAnimationFrame(this.tick);
      }, wait - 8);
  }
  private report(fps = 0) {
    const sorted = [...this.samples].sort((a, b) => a - b);
    this.onStats({
      mounted: this.views.size,
      visible: this.visible.size,
      paints: this.totalPaints,
      callbacks: this.callbacks,
      p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      fps,
      running: this.shouldRun(),
    });
  }
  private tick = () => {
    this.frame = null;
    if (!this.shouldRun()) {
      this.sync();
      return;
    }
    this.callbacks++;
    const clock = this.clock;
    const start = performance.now();
    let painted = false;
    for (const view of this.visible) {
      if (view.nextAt > clock) continue;
      view.render(clock, false, this.visible.size > 60);
      painted = true;
    }
    if (painted) {
      this.samples.push(performance.now() - start);
      if (this.samples.length > 240) this.samples.shift();
      this.paints++;
      this.totalPaints++;
    }
    const time = performance.now();
    if (time - this.lastReport > 1000) {
      this.report((this.paints * 1000) / (time - this.lastReport));
      this.paints = 0;
      this.lastReport = time;
    }
    this.schedule();
  };
  destroy() {
    this.enabled = false;
    this.sync();
    document.removeEventListener('visibilitychange', this.sync);
    this.observer.disconnect();
    this.views.clear();
    this.visible.clear();
  }
}
