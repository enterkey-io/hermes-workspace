import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../chat/Icon';

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`ui-notice ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
export function PageHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <button type="button" className="icon-button" aria-label={`Close ${title}`} onClick={onClose}>
        <Icon name="close" />
      </button>
    </header>
  );
}
export function FormSection({
  title,
  children,
  description,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="form-section">
      <div className="form-section-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}
export function Tabs({
  tabs,
  value,
  onChange,
  children,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <>
      <div
        className="ui-tabs"
        role="tablist"
        onKeyDown={(e) => {
          const index = tabs.findIndex((t) => t.id === value);
          const next =
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? tabs.length - 1
                : e.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : e.key === 'ArrowLeft'
                    ? (index + tabs.length - 1) % tabs.length
                    : -1;
          if (next >= 0) {
            e.preventDefault();
            const t = tabs[next]!;
            onChange(t.id);
            document.getElementById(`${id}-${t.id}`)?.focus();
          }
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${id}-${t.id}`}
            aria-controls={`${id}-panel`}
            aria-selected={value === t.id}
            tabIndex={value === t.id ? 0 : -1}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${value}`}
        className="ui-tab-panel"
      >
        {children}
      </div>
    </>
  );
}
export type MenuItem = {
  label: string;
  action: () => void;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
};
export function Menu({
  label,
  children,
  items,
  className = '',
  disabled = false,
  upward = false,
}: {
  label: string;
  children: ReactNode;
  items: MenuItem[];
  className?: string;
  disabled?: boolean;
  upward?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 8, maxHeight: 400 });
  const id = useId();
  const dismiss = (restore = true) => {
    setOpen(false);
    if (restore)
      requestAnimationFrame(() => {
        if (trigger.current?.isConnected) trigger.current.focus();
        else
          [...document.querySelectorAll<HTMLButtonElement>('button[aria-label]')]
            .find((b) => b.getAttribute('aria-label') === label && b.getClientRects().length)
            ?.focus();
      });
  };
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = trigger.current!.getBoundingClientRect(),
        box = panel.current!.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0,
        top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? innerWidth,
        height = viewport?.height ?? innerHeight;
      const below = rect.bottom + 6,
        above = rect.top - box.height - 6;
      setPosition({
        left: Math.max(left + 8, Math.min(rect.right - box.width, left + width - box.width - 8)),
        top: Math.max(
          top + 8,
          upward && above >= top + 8
            ? above
            : below + box.height <= top + height - 8
              ? below
              : Math.max(top + 8, above),
        ),
        maxHeight: Math.max(80, height - 16),
      });
    };
    update();
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [open, upward]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (
        !panel.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        dismiss(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const portal = trigger.current?.closest('[role="dialog"]') ?? document.body;
  return (
    <span className={`menu-anchor ${className}`}>
      <button
        ref={trigger}
        type="button"
        className="icon-button menu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="menu"
            aria-label={label}
            className="ui-menu"
            style={position}
            onKeyDown={(e) => {
              const buttons = [
                ...panel.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
              ];
              const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
              const index =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? buttons.length - 1
                    : e.key === 'ArrowDown'
                      ? (current + 1) % buttons.length
                      : e.key === 'ArrowUp'
                        ? (current + buttons.length - 1) % buttons.length
                        : -1;
              if (index >= 0) {
                e.preventDefault();
                buttons[index]?.focus();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                dismiss();
              }
              if (e.key === 'Tab') {
                dismiss(false);
              }
            }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role={item.checked == null ? 'menuitem' : 'menuitemcheckbox'}
                aria-checked={item.checked}
                disabled={item.disabled}
                className={item.danger ? 'danger-text' : ''}
                onClick={() => {
                  dismiss();
                  item.action();
                }}
              >
                <span>{item.label}</span>
                {item.checked && <span aria-hidden>✓</span>}
              </button>
            ))}
          </div>,
          portal,
        )}
    </span>
  );
}
