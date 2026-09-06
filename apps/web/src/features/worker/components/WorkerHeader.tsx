export default function WorkerHeader() {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <a className="brand" href="/" aria-label="AIS anomaly map">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>ais anomaly</span>
        </a>
        <nav className="topnav" aria-label="Primary navigation">
          <a className="topnav__link" href="/">
            Map
          </a>
          <a className="topnav__link is-active" href="/worker">
            Worker
          </a>
        </nav>
        <a className="worker-page__map-link" href="/">
          Map
        </a>
      </div>
    </header>
  );
}
