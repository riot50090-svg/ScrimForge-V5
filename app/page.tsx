import Link from "next/link";
import { db } from "@/lib/db";
import { money } from "@/lib/util";
import { scheduleLabel } from "@/lib/schedule";
export const dynamic="force-dynamic";

export default async function Home(){
  const [l,r]=await Promise.all([
    db.query(`select * from lobbies where status in ('OPEN','CONFIRMED','LIVE') order by starts_at nulls last limit 6`),
    db.query(`select r.team_name,sum(r.points)::int points,sum(r.kills)::int kills,count(distinct r.match_no)::int matches_played,max(l.match_count)::int match_count from results r join lobbies l on l.id=r.lobby_id where l.game='Free Fire' group by r.team_name order by points desc,kills desc limit 8`)
  ]);
  return <main>
    <Nav/>
    <section className="hero wrap">
      <span className="pill">● FREE FIRE SCRIMS</span>
      <h1>Play the series.<br/><em>Climb.</em> Conquer.</h1>
      <p>ScrimForge is built exclusively for Garena Free Fire squad scrims. Standard scrims can stay at 12 teams, while larger tournaments automatically split into groups of 12 and can advance teams through multiple stages. Maps are announced before each match.</p>
      <div className="actions"><Link className="btn primary" href="/scrims">View Scrims</Link></div>
    </section>
    <section className="wrap section">
      <Head a="FREE FIRE MATCH CENTER" b="Upcoming Scrim Sessions" href="/scrims"/>
      <div className="grid">{l.rows.length?l.rows.map((x:any)=><article className="card" key={x.id}>
        <div className="row"><span className="tag">FREE FIRE</span><span className="status">{x.status}</span></div>
        <h3>{x.title}</h3>
        <p className="muted">Squad · {x.match_count||6} matches · {Number(x.max_teams||12)>12?`${Math.ceil(Number(x.max_teams)/(Number(x.group_size)||12))} groups of ${x.group_size||12}`:"12-team lobby"} · Maps announced per match</p>
        <div className="stats"><div><small>ENTRY</small><b>{money(x.entry_fee)}</b></div><div><small>PRIZE</small><b>{money(x.prize_pool)}</b></div><div><small>TEAMS</small><b>{x.max_teams}</b></div><div><small>START</small><b>{scheduleLabel(x)}</b></div></div>
        <Link className="wide" href={`/register?lobby=${x.id}`}>Register</Link>
      </article>):<div className="empty">No confirmed Free Fire scrim sessions yet. Create one from Admin → Lobbies.</div>}</div>
    </section>
    <section className="wrap section"><Head a="RANKINGS" b="Live Scrim Leaderboard" href="/leaderboard"/><div className="table"><div className="thead four"><span>#</span><span>Team</span><span>Matches</span><span>Points</span></div>{r.rows.length?r.rows.map((x:any,i:number)=><div className="trow" key={x.team_name}><span>#{i+1}</span><strong>{x.team_name}</strong><span>{x.matches_played}/{x.match_count||6}</span><b>{x.points}</b></div>):<div className="empty">Results will appear here after scores are entered.</div>}</div></section>
    <section className="wrap cta"><h2>Enter the next Free Fire scrim.</h2><p>One squad. A live points table. Final standings are based on total points across the matches entered for that scrim.</p><Link className="btn primary" href="/scrims">Browse Scrims</Link><a className="whatsappChannel" href="https://whatsapp.com/channel/0029VbDdaBk0bIdfjiQl763V" target="_blank" rel="noopener noreferrer">📢 Join our WhatsApp Channel</a></section>
    <footer>SCRIMFORGE V5 · FREE FIRE SQUAD SCRIMS.</footer>
  </main>
}
function Nav(){return <nav className="nav"><Link href="/" className="brand"><span className="mark">SF</span>ScrimForge <small>V5</small></Link><div className="navRight"><div className="navlinks"><Link href="/scrims">Scrims</Link><Link href="/leaderboard">Leaderboard</Link><Link href="/results">Results</Link><Link href="/rules">Rules</Link><Link href="/status">Status</Link><Link href="/admin/login">Admin</Link></div><a className="whatsappContact" href="https://wa.me/916307424233" target="_blank" rel="noopener noreferrer">🟢 WhatsApp: +91 63074 24233</a><a className="whatsappChannel" href="https://whatsapp.com/channel/0029VbDdaBk0bIdfjiQl763V" target="_blank" rel="noopener noreferrer">📢 WhatsApp Channel</a></div></nav>}
function Head({a,b,href}:{a:string,b:string,href:string}){return <div className="sectionHead"><div><span className="eyebrow">{a}</span><h2>{b}</h2></div><Link href={href}>View all →</Link></div>}
