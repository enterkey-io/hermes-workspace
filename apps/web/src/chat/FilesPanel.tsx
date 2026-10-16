import { useEffect, useState } from 'react';
import type { BotBridgeClient } from '@hermes-client/protocol';
import { Notice } from '../ui/primitives';
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
}: {
  client: BotBridgeClient;
  sessionId: string;
  version: number;
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
      {error && (
        <Notice error>
          {error}
          <button onClick={() => setRetry((x) => x + 1)}>Try again</button>
        </Notice>
      )}
      {loading ? (
        <Notice>Loading files…</Notice>
      ) : !files.length ? (
        <p className="empty-note">No files shared here yet.</p>
      ) : (
        <ul className="file-list">
          {files.map((file) => (
            <li key={file.id}>
              <span>
                <strong>{file.name}</strong>
                <small>{fileSize(file.size)} · Shared in this chat</small>
              </span>
              <button
                disabled={!!busy}
                aria-label={`Download ${file.name}`}
                onClick={() => void download(file)}
              >
                {busy === file.id ? 'Downloading…' : 'Download'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
