export default function WorkerIntro() {
  return (
    <section className="intro">
      <div className="intro__heading">
        <p className="eyebrow">BACKGROUND INGESTION</p>
        <h1>Worker control</h1>
      </div>
      <div className="intro__aside">
        <span className="intro__rule" aria-hidden="true" />
        <p>
          Monitor and control the three regional AIS subscriptions without
          interrupting map access to positions already stored in PostgreSQL.
        </p>
      </div>
    </section>
  );
}
