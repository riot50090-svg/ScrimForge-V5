export default function Home() {
  const scrims = [
    {
      name: "Nightfall Scrims",
      game: "BGMI",
      entry: "₹50",
      prize: "₹1,000",
      status: "OPEN",
    },
    {
      name: "Forge Rush",
      game: "BGMI",
      entry: "₹100",
      prize: "₹2,500",
      status: "OPEN",
    },
    {
      name: "Elite Clash",
      game: "Coming Soon",
      entry: "—",
      prize: "—",
      status: "SOON",
    },
  ];

  const leaderboard = [
    { rank: 1, team: "Team Alpha", points: 1240 },
    { rank: 2, team: "Shadow X", points: 1185 },
    { rank: 3, team: "Nova Esports", points: 1090 },
    { rank: 4, team: "Titan Squad", points: 980 },
  ];

  return (
    <main>
      <nav className="navbar">
        <div className="nav-brand">
          <span className="brand-mark">SF</span>
          <span>ScrimForge</span>
          <small>V5</small>
        </div>

        <div className="nav-links">
          <a href="#scrims">Scrims</a>
          <a href="#leaderboard">Leaderboard</a>
          <a href="#results">Results</a>
          <a href="#rules">Rules</a>
          <a href="#register">Register</a>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-badge">NEXT-GEN SCRIM PLATFORM</div>

        <h1>
          Compete.
          <br />
          <span>Climb.</span>
          <br />
          Conquer.
        </h1>

        <p>
          Competitive scrims, live results and rankings — all in one
          powerful platform built for serious players.
        </p>

        <div className="hero-actions">
          <a className="btn btn-primary" href="#scrims">
            Explore Scrims
          </a>
          <a className="btn btn-secondary" href="#register">
            Register Now
          </a>
        </div>
      </section>

      <section className="section" id="scrims">
        <div className="section-heading">
          <div>
            <span className="eyebrow">COMPETE NOW</span>
            <h2>Available Scrims</h2>
          </div>
          <span className="live-dot">● LIVE</span>
        </div>

        <div className="scrim-grid">
          {scrims.map((scrim) => (
            <article className="scrim-card" key={scrim.name}>
              <div className="card-top">
                <span className="game-tag">{scrim.game}</span>
                <span
                  className={
                    scrim.status === "OPEN"
                      ? "status-open"
                      : "status-soon"
                  }
                >
                  {scrim.status}
                </span>
              </div>

              <h3>{scrim.name}</h3>

              <div className="scrim-info">
                <div>
                  <span>ENTRY</span>
                  <strong>{scrim.entry}</strong>
                </div>
                <div>
                  <span>PRIZE POOL</span>
                  <strong>{scrim.prize}</strong>
                </div>
              </div>

              <a className="card-button" href="#register">
                {scrim.status === "OPEN" ? "Join Scrim →" : "Coming Soon"}
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="leaderboard">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SEASON RANKINGS</span>
            <h2>Live Leaderboard</h2>
          </div>
        </div>

        <div className="leaderboard">
          <div className="leaderboard-header">
            <span>RANK</span>
            <span>TEAM</span>
            <span>POINTS</span>
          </div>

          {leaderboard.map((player) => (
            <div className="leaderboard-row" key={player.rank}>
              <span className="rank">#{player.rank}</span>
              <strong>{player.team}</strong>
              <span>{player.points}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="results">
        <div className="info-panel">
          <span className="eyebrow">MATCH CENTER</span>
          <h2>Results & Match Updates</h2>
          <p>
            Track completed matches, scores and tournament progress from
            one central place.
          </p>
        </div>
      </section>

      <section className="section" id="rules">
        <div className="info-panel">
          <span className="eyebrow">PLAY FAIR</span>
          <h2>Rules & Guidelines</h2>
          <p>
            Match rules, registration requirements and competitive
            guidelines will be available here.
          </p>
        </div>
      </section>

      <section className="cta-section" id="register">
        <div className="cta-card">
          <span className="eyebrow">READY?</span>
          <h2>Enter the Forge.</h2>
          <p>
            Register for upcoming scrims and prove your squad belongs at
            the top.
          </p>
          <a className="btn btn-primary" href="#">
            Register Your Squad →
          </a>
        </div>
      </section>

      <footer>
        <div className="footer-brand">SCRIMFORGE V5</div>
        <p>Competitive gaming. Forged differently.</p>
      </footer>
    </main>
  );
}
