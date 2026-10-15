export function Icon({
  name,
}: {
  name:
    | 'search'
    | 'plus'
    | 'menu'
    | 'close'
    | 'send'
    | 'info'
    | 'settings'
    | 'pin'
    | 'chevron'
    | 'refresh';
}) {
  const paths = {
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    send: <path d="M12 20V4m-6 6 6-6 6 6" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v1" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="3" />
        <circle cx="15" cy="17" r="3" />
      </>
    ),
    pin: <path d="m9 3 6 0-1 6 4 4H6l4-4-1-6m3 10v8" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    refresh: (
      <>
        <path d="M20 5v5h-5M4 19v-5h5" />
        <path d="M5 9a7 7 0 0 1 12-4l3 5M4 14l3 5a7 7 0 0 0 12-4" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
