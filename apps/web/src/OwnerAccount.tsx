import { useState } from 'react';
import { ownerRequest } from './OwnerShell';
export function OwnerAccount() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <section className="owner-account">
      <h2>Change password</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage('');
          try {
            if (next !== confirm) throw new Error('The new passwords don’t match.');
            await ownerRequest('/api/auth/change-password', {
              currentPassword: current,
              newPassword: next,
              revokeOtherSessions: true,
            });
            setCurrent('');
            setNext('');
            setConfirm('');
            setMessage('Password changed. Other devices will be signed out within five minutes.');
          } catch (e) {
            setMessage(e instanceof Error ? e.message : 'Password could not be changed.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Current password
          <input
            required
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label>
          New password
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <label>
          Confirm new password
          <input
            required
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button disabled={busy}>Change password</button>
      </form>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await ownerRequest('/api/auth/revoke-other-sessions', {});
            setMessage('Other devices will be signed out within five minutes.');
          } catch {
            setMessage('Session revocation could not be confirmed.');
          } finally {
            setBusy(false);
          }
        }}
      >
        Sign out other devices
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
