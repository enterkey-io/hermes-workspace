import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { IconButton } from './components/ui/icon-button';

function CodeBlock({ children }: { children?: ReactNode }) {
  const code = useRef<HTMLPreElement>(null);
  const [status, setStatus] = useState('Copy code');
  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>Code</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard
              .writeText(code.current?.textContent ?? '')
              .then(() => setStatus('Copied'))
              .catch(() => setStatus('Select code to copy'));
          }}
        >
          {status}
        </button>
      </div>
      <pre ref={code}>{children}</pre>
    </div>
  );
}

/** No raw HTML, remote image loading, embeds or automatic requests from bot output. */
export function MessageBody({ text }: { text: string }) {
  return (
    <div className="message-body">
      <Markdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          img: ({ alt }) => (
            <span className="image-placeholder">[Image: {alt || 'not loaded'}]</span>
          ),
          a: ({ href, children }) =>
            href && /^https?:\/\//i.test(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

export function CopyMessage({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      className="copy-message"
      label={copied ? 'Copied' : 'Copy message'}
      icon={copied ? Check : Copy}
      quiet
      onClick={() => {
        void navigator.clipboard
          .writeText(text)
          .then(() => setCopied(true))
          .catch(() => setCopied(false));
      }}
    />
  );
}
