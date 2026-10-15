import type { ReactNode } from 'react';
import { MessageBody, CopyMessage } from '../MessageBody';
import { messageDate } from '../conversation';
import type { ChatMessage } from '../conversation';
export function Transcript({
  messages,
  title,
  crew,
  stream,
  running,
  children,
  authorName,
}: {
  messages: ChatMessage[];
  title: string;
  crew: boolean;
  stream: string;
  running: boolean;
  children?: ReactNode;
  authorName: (name: string) => string;
}) {
  let previous = '';
  return (
    <>
      {children}
      {messages.map((m, i) => {
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
          <div className="message-group" key={m.id ?? `pending-${i}`}>
            {label && <p className="date-divider">{group}</p>}
            <article className={`message ${m.role}`}>
              {crew && m.role === 'assistant' && (
                <strong className="message-author">
                  {m.author ? authorName(m.author) : 'Crew member'}
                </strong>
              )}
              {m.role === 'tool' && <small className="message-author">Tool</small>}
              {m.role === 'user' ? <p>{m.text}</p> : <MessageBody text={m.text} />}
              <div className="message-meta">
                {date && (
                  <time dateTime={date.toISOString()}>
                    {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </time>
                )}
                <CopyMessage text={m.text} />
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
