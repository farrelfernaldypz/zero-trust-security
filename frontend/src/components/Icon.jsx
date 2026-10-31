export default function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    grades: <><path d="M8 3h8l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3Z" /><path d="M15 3v5h5M8 13h8M8 17h5" /></>,
    transcript: <><path d="M5 3.5A2.5 2.5 0 0 1 7.5 1H20v19H7.5A2.5 2.5 0 0 0 5 22.5v-19Z" /><path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H20M9 6h7M9 10h7" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    classes: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></>,
    check: <><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="9" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22.5v-17Z" /><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 11h8" /></>,
  };

  return <svg {...common}>{icons[name] || icons.dashboard}</svg>;
}
