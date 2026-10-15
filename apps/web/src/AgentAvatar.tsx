import { useEffect, useRef, useState } from 'react';
import { AvatarView, AvatarScheduler } from './avatar-lab/renderer';
import { COLORS, SHAPES } from './avatar-lab/engine';
import type { Activity } from './avatar-lab/engine';
import type { Appearance } from './workspace';
import type { BotBridgeClient } from '@hermes-client/protocol';
let clock: AvatarScheduler | undefined;
let users = 0;
function acquire() {
  if (!clock) clock = new AvatarScheduler();
  users++;
  return clock;
}
function release() {
  if (--users === 0) {
    clock?.destroy();
    clock = undefined;
  }
}
export function AgentAvatar({
  id,
  look,
  state = 'ready',
  orchestrator = false,
  photo,
  client,
  profile,
  large = false,
}: {
  id: string;
  look: Appearance;
  state?: Activity;
  orchestrator?: boolean;
  photo?: string;
  client?: BotBridgeClient;
  profile?: string;
  large?: boolean;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const view = useRef<AvatarView | undefined>(undefined);
  const [savedPhoto, setSavedPhoto] = useState('');
  useEffect(() => {
    let live = true;
    if (look.kind === 'photo' && !photo && client && profile)
      void client
        .invoke('bots.appearance.get', { profile })
        .then((data) => {
          if (
            live &&
            data &&
            typeof data === 'object' &&
            'data' in data &&
            typeof data.data === 'string' &&
            /^data:image\/(png|jpeg|webp);base64,/.test(data.data)
          )
            setSavedPhoto(data.data);
        })
        .catch(() => undefined);
    return () => {
      live = false;
      setSavedPhoto('');
    };
  }, [look.kind, photo, client, profile]);
  const image = look.kind === 'photo' ? photo || savedPhoto : '';
  useEffect(() => {
    if (!host.current || image) return;
    const scheduler = acquire();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => scheduler.configure(true, motion.matches);
    update();
    motion.addEventListener('change', update);
    const avatar = new AvatarView(
      id,
      SHAPES.includes(look.shape) ? look.shape : 'pebble',
      COLORS.find((c) => c.id === look.color)?.hex ?? COLORS[0].hex,
      state,
      orchestrator,
      large,
    );
    view.current = avatar;
    host.current.append(avatar.svg);
    scheduler.add(avatar);
    return () => {
      scheduler.remove(avatar);
      avatar.svg.remove();
      view.current = undefined;
      motion.removeEventListener('change', update);
      release();
    };
  }, [id, image, look.shape, look.color, orchestrator, large]);
  useEffect(() => {
    if (view.current && clock) {
      view.current.setState(state, clock.clock);
      clock.invalidate();
    }
  }, [state]);
  return (
    <span className={`agent-avatar ${large ? 'large' : ''}`} ref={host}>
      {image && (
        <>
          <img src={image} alt="" />
          {orchestrator && (
            <span className="avatar-star" aria-label="Orchestrator">
              ★
            </span>
          )}
          {state !== 'ready' && (
            <span className="photo-status" aria-label={state}>
              ●
            </span>
          )}
        </>
      )}
    </span>
  );
}
export function AvatarChooser({
  look,
  onChange,
  photo,
  onPhoto,
  client,
  profile,
  hasPhoto = false,
  onBusyChange,
}: {
  look: Appearance;
  onChange: (v: Appearance) => void;
  photo: string;
  onPhoto: (v: string) => void;
  client?: BotBridgeClient;
  profile?: string;
  hasPhoto?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [storedPhoto, setStoredPhoto] = useState('');
  useEffect(() => {
    let live = true;
    if (client && profile)
      void client
        .invoke('bots.appearance.get', { profile })
        .then((value) => {
          const data = value as { data?: unknown };
          if (
            live &&
            typeof data.data === 'string' &&
            /^data:image\/(png|jpeg|webp);base64,/.test(data.data)
          )
            setStoredPhoto(data.data);
        })
        .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [client, profile]);
  const [error, setError] = useState('');
  const [decoding, setDecoding] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  function choose(value: Appearance) {
    generation.current++;
    setDecoding(false);
    onBusyChange?.(false);
    onChange(value);
  }
  return (
    <div className="appearance-picker">
      <AgentAvatar
        id="appearance-preview"
        look={look}
        photo={photo || storedPhoto}
        {...(client ? { client } : {})}
        {...(profile ? { profile } : {})}
        large
        orchestrator
      />
      <div className="choice-row" aria-label="Avatar style">
        <button
          type="button"
          aria-pressed={look.kind === 'shape'}
          onClick={() => choose({ ...look, kind: 'shape' })}
        >
          Animated shape
        </button>
        {(photo || storedPhoto || hasPhoto) && (
          <button
            type="button"
            aria-pressed={look.kind === 'photo'}
            onClick={() => choose({ ...look, kind: 'photo' })}
          >
            Photo
          </button>
        )}
        <label className="photo-choice">
          Choose photo
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={decoding}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const ticket = ++generation.current;
              setDecoding(true);
              onBusyChange?.(true);
              setError('');
              try {
                const { previewPhoto } = await import('./avatar-lab/photo');
                const result = await previewPhoto(file);
                if (generation.current === ticket) {
                  onPhoto(result);
                  onChange({ ...look, kind: 'photo' });
                }
              } catch {
                if (generation.current === ticket)
                  setError('Choose a PNG, JPEG or WebP image up to 5 MB.');
              } finally {
                if (generation.current === ticket) {
                  setDecoding(false);
                  onBusyChange?.(false);
                }
              }
            }}
          />
        </label>
      </div>
      {look.kind === 'shape' && (
        <>
          <div className="choice-row" aria-label="Avatar shape">
            {SHAPES.map((shape) => (
              <button
                key={shape}
                type="button"
                aria-pressed={look.shape === shape}
                onClick={() => choose({ ...look, shape })}
              >
                {shape}
              </button>
            ))}
          </div>
          <div className="choice-row" aria-label="Avatar color">
            {COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                aria-pressed={look.color === color.id}
                onClick={() => choose({ ...look, color: color.id })}
              >
                <span style={{ background: color.hex }} className="color-chip" />
                {color.label}
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <small>
        Your photo goes directly to your Hermes when you save. Switching to a shape keeps the saved
        photo.
      </small>
    </div>
  );
}
