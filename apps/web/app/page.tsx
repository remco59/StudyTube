export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">StudyTube</p>
        <h1>From structured lesson to finished explainer.</h1>
        <p className="lede">
          StudyTube will turn a validated .studytube.json project into narration,
          motion graphics, captions and a finished 1080p video.
        </p>
        <div className="statusCard">
          <span className="statusDot" aria-hidden="true" />
          <div>
            <strong>Repository foundation</strong>
            <p>The render pipeline is being assembled in stacked pull requests.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
