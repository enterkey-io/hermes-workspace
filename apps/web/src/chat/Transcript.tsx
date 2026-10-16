import type { ReactNode } from 'react';
import { MessageBody, CopyMessage } from '../MessageBody';
import { messageDate, projectTimeline } from '../conversation';
import type { ChatMessage } from '../conversation';
export function Transcript({
  messages,
  title,
  crew,
  stream,
  running,
  children,
  authorName,
  onDownloadFile,
}: {
  messages: ChatMessage[];
  title: string;
  crew: boolean;
  stream: string;
  running: boolean;
  children?: ReactNode;
  authorName: (name: string) => string;
  onDownloadFile: (file: { id: string; name: string }) => void;
}) {
  let previous = '';
  return (
    <>
      {children}
      {projectTimeline(messages).map((item, i) => {
        if (item.kind === 'activity')
          return (
            <details className="activity-group" key={item.id}>
              <summary>
                {item.messages.some((m) => m.role === 'tool')
                  ? `${item.messages.length} tool ${item.messages.length === 1 ? 'call' : 'calls'}`
                  : 'Activity'}
              </summary>
              <ol>
                {item.messages.map((m, index) => (
                  <li key={m.id ?? index}>
                    <strong>{m.toolName ?? 'Update'}</strong>
                    {m.context && <p>{m.context}</p>}
                    {m.text.trim() && <MessageBody text={m.text} />}
                  </li>
                ))}
              </ol>
            </details>
          );
        const m = item.message;
        const date = messageDate(m.timestamp);
        const group =
          date?.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }) ?? '';
        const label = group && group !== previous;
        previous = group;
        return (
          <div
            className="message-group"
            data-message-id={m.id ?? `pending-${i}`}
            key={m.id ?? `pending-${i}`}
          >
            {label && <p className="date-divider">{group}</p>}
            <article className={`message ${m.role}`}>
              {crew && m.role === 'assistant' && (
                <strong className="message-author">
                  {m.author ? authorName(m.author) : 'Crew member'}
                </strong>
              )}
              {m.role === 'tool' && <small className="message-author">Tool</small>}
              {m.text.trim() &&
                (m.role === 'user' ? <p>{m.text}</p> : <MessageBody text={m.text} />)}
              {m.files?.map((file) => (
                <button className="message-file" key={file.id} onClick={() => onDownloadFile(file)}>
                  {file.name} ↓
                </button>
              ))}
              <div className="message-meta">
                {date && (
                  <time dateTime={date.toISOString()}>
                    {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </time>
                )}
                {m.text.trim() && <CopyMessage text={m.text} />}
              </div>
            </article>
          </div>
        );
      })}
      {stream && (
        <article className="message assistant streaming">
          {crew && <strong className="message-author">{title}</strong>}
          <MessageBody text={stream} />
          <span className="caret" aria-hidden>
            ▍
          </span>
        </article>
      )}
      {running && !stream && (
        <p className="thinking" role="status">
          <span className="thinking-dots" />
          Working…
        </p>
      )}
    </>
  );
}
