import { Button } from '../components/ui/button';
import { useEffect, useState } from 'react';
import type { BotBridgeClient } from '@hermes-client/protocol';
import { Notice } from '../ui/primitives';
import { LoadingBar } from '../components/ui/loading-bar';
export type SharedFile = {
  id: string;
  name: string;
  kind: string;
  size: number;
  state: string;
  created?: number;
};
export function fileSize(size: number) {
  return size < 1024
    ? `${size} B`
    : size < 1024 * 1024
      ? `${Math.ceil(size / 1024)} KB`
      : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
export function FilesPanel({
  client,
  sessionId,
  version,
  focusId,
}: {
  client: BotBridgeClient;
  sessionId: string;
  version: number;
  focusId?: string | undefined;
}) {
  const [files, setFiles] = useState<SharedFile[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState('');
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    void client
      .invoke('files.list', { session_id: sessionId })
      .then((v) => {
        const list = (v as { files: SharedFile[] }).files;
        if (!Array.isArray(list)) throw new Error();
        if (live) setFiles(list);
      })
      .catch(() => {
        if (live) setError('Files could not be loaded.');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [client, sessionId, version, retry]);
  useEffect(() => {
    if (focusId && !loading)
      document
        .querySelector<HTMLElement>(`[data-file-id="${CSS.escape(focusId)}"]`)
        ?.scrollIntoView({
          block: 'center',
          behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth',
        });
  }, [focusId, loading, files]);
  async function download(file: SharedFile) {
    setBusy(file.id);
    setError('');
    try {
      const blob = await client.downloadFile(sessionId, file.id),
        url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('This file could not be downloaded.');
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="files-panel">
      <LoadingBar active={loading} label="Loading files" />
      {error && (
        <Notice error>
          {error}
          <Button variant="secondary" onClick={() => setRetry((x) => x + 1)}>
            Try again
          </Button>
        </Notice>
      )}
      {!loading && !files.length ? (
        <p className="empty-note">No files shared here yet.</p>
      ) : (
        <ul className="file-list">
          {files.map((file) => (
            <li key={file.id} data-file-id={file.id}>
              <span>
                <strong>{file.name}</strong>
                <small>{fileSize(file.size)} · Shared in this chat</small>
              </span>
              <Button
                variant="secondary"
                disabled={!!busy}
                aria-label={`Download ${file.name}`}
                onClick={() => void download(file)}
              >
                {busy === file.id ? 'Downloading…' : 'Download'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
