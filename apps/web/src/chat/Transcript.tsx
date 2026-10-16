import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { MessageBody, CopyMessage } from '../MessageBody';
import { messageDate, projectTimeline } from '../conversation';
import type { ChatMessage } from '../conversation';
export function Transcript({
  messages,
  title,
  crew,
  stream,
  running,
  activity,
  children,
  authorName,
  onDownloadFile,
}: {
  messages: ChatMessage[];
  title: string;
  crew: boolean;
  stream: string;
  running: boolean;
  activity: string;
  children?: ReactNode;
  authorName: (name: string) => string;
  onDownloadFile: (file: { id: string; name: string }) => void;
}) {
  const reduced = useReducedMotion();
  let previous = '';
  return (
    <div className="pc-messages">
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
          <motion.div
            className={`pc-message message-group ${m.role}`}
            initial={m.id?.startsWith('pending-') && !reduced ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            data-message-id={m.id ?? `pending-${i}`}
            key={m.renderKey ?? m.id ?? `pending-${i}`}
          >
            {label && <p className="pc-date date-divider">{group}</p>}
            <article className={`pc-bubble message ${m.role}`}>
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
              <div className="pc-message-meta message-meta">
                {date && (
                  <time dateTime={date.toISOString()}>
                    {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </time>
                )}
              </div>
            </article>
            {m.text.trim() && (
              <div className="pc-message-actions">
                <CopyMessage text={m.text} />
              </div>
            )}
          </motion.div>
        );
      })}
      {stream && (
        <article className="pc-message assistant streaming">
          <div className="pc-bubble">
            {crew && <strong className="message-author">{title}</strong>}
            <MessageBody text={stream} />
            <span className="caret" aria-hidden>
              ▍
            </span>
          </div>
        </article>
      )}
      <div className="pc-activity-lane">
        {running && !stream && (
          <p className="pc-activity" role="status">
            {activity === 'Stop requested'
              ? 'Stopping'
              : activity.startsWith('Using ')
                ? 'Working'
                : 'Thinking'}
          </p>
        )}
      </div>
    </div>
  );
}
