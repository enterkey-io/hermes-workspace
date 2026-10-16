import type { ReactNode } from 'react';
import type { BotBridgeClient } from '@hermes-client/protocol';
import type { Appearance } from '../workspace';
import { AvatarChooser } from '../AgentAvatar';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';

export type ProfileDraft = { name: string; handle: string; appearance: Appearance; photo: string };
export function PebbleProfileFields({
  value,
  onChange,
  client,
  profile,
  onAvatarBusy,
  revision,
  children,
}: {
  value: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
  client?: BotBridgeClient;
  profile?: string;
  onAvatarBusy: (busy: boolean) => void;
  revision?: number;
  children?: ReactNode;
}) {
  return (
    <div className="pebble-profile-fields">
      <div className="profile-identity-fields">
        <label>
          Name
          <Input
            required
            maxLength={80}
            autoComplete="off"
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </label>
        <label>
          Handle
          <span className="handle-input">
            <span aria-hidden="true">@</span>
            <Input
              required
              aria-label="Handle"
              minLength={2}
              maxLength={32}
              pattern="[a-z][a-z0-9_-]{1,31}"
              autoCapitalize="none"
              autoComplete="off"
              value={value.handle}
              onChange={(e) => onChange({ handle: e.target.value })}
            />
          </span>
        </label>
        {children}
      </div>
      <AvatarChooser
        look={value.appearance}
        photo={value.photo}
        onChange={(appearance) => onChange({ appearance })}
        onPhoto={(photo) => onChange({ photo })}
        onBusyChange={onAvatarBusy}
        revision={revision}
        {...(client ? { client } : {})}
        {...(profile ? { profile } : {})}
      />
    </div>
  );
}
export function RoleBasics({
  title,
  description,
  onChange,
}: {
  title: string;
  description: string;
  onChange: (patch: { title?: string; description?: string }) => void;
}) {
  return (
    <>
      <label>
        Title
        <Input
          maxLength={1000}
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Researcher"
        />
      </label>
      <label>
        Description
        <Textarea
          aria-label="Description"
          rows={3}
          maxLength={1000}
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </label>
    </>
  );
}
