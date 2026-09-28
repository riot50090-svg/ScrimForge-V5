import{NextResponse}from"next/server";
import{admin}from"@/lib/auth";
import{db}from"@/lib/db";
const PLACEMENT:Record<number,number>={1:12,2:9,3:8,4:7,5:6,6:5,7:4,8:3,9:2,10:1,11:0,12:0};

export async function GET(req:Request){
  if(!(await admin()))return NextResponse.json({error:"Unauthorized"},{status:401});
  const u=new URL(req.url),lobby=String(u.searchParams.get("lobby_id")||"").trim();
  if(!lobby)return NextResponse.json({error:"Lobby is required"},{status:400});
  const q=await db.query(`select team_name,sum(points)::int total_points,sum(kills)::int kill_points,sum(case when placement=1 then 1 else 0 end)::int booyahs,sum(case when placement=1 then 12 when placement=2 then 9 when placement=3 then 8 when placement=4 then 7 when placement=5 then 6 when placement=6 then 5 when placement=7 then 4 when placement=8 then 3 when placement=9 then 2 when placement=10 then 1 else 0 end)::int placement_points,count(*)::int matches_played from results where lobby_id=$1 group by team_name order by total_points desc,booyahs desc,kill_points desc,team_name asc`,[lobby]);
  return NextResponse.json(q.rows.map((x:any,i:number)=>({...x,rank:i+1})));
}

export async function POST(req:Request){
  if(!(await admin()))return NextResponse.json({error:"Unauthorized"},{status:401});
  const b=await req.json();
  const matchNo=Number(b.match_no),placement=Number(b.placement),kills=Number(b.kills);
  if(!b.lobby_id||!b.team_name)return NextResponse.json({error:"Lobby and team are required"},{status:400});
  const l=await db.query(`select match_count,game from lobbies where id=$1`,[b.lobby_id]);
  if(!l.rows.length)return NextResponse.json({error:"Scrim session not found"},{status:404});
  if(l.rows[0].game!=="Free Fire")return NextResponse.json({error:"This leaderboard is for Free Fire only"},{status:400});
  const matchCount=Number(l.rows[0].match_count||6);
  if(!Number.isInteger(matchNo)||matchNo<1||matchNo>matchCount)return NextResponse.json({error:`Match number must be between 1 and ${matchCount}`},{status:400});
  if(!Number.isInteger(placement)||placement<1||placement>12)return NextResponse.json({error:"Placement must be 1-12"},{status:400});
  if(!Number.isInteger(kills)||kills<0)return NextResponse.json({error:"Kills cannot be negative"},{status:400});
  const team=String(b.team_name).trim();
  const exists=await db.query(`select 1 from scrim_teams where lobby_id=$1 and team_name=$2 limit 1`,[b.lobby_id,team]);
  if(!exists.rows.length)return NextResponse.json({error:"That team is not registered in this scrim"},{status:400});
  const occupied=await db.query(`select team_name from results where lobby_id=$1 and match_no=$2 and placement=$3 and team_name<>$4 limit 1`,[b.lobby_id,matchNo,placement,team]);
  if(occupied.rows.length)return NextResponse.json({error:`Placement ${placement} is already assigned to ${occupied.rows[0].team_name} for Match ${matchNo}`},{status:400});
  const points=PLACEMENT[placement]+kills;
  await db.query(`delete from results where lobby_id=$1 and match_no=$2 and team_name=$3`,[b.lobby_id,matchNo,team]);
  await db.query(`insert into results(id,lobby_id,team_name,match_no,placement,kills,points) values($1,$2,$3,$4,$5,$6,$7)`,[crypto.randomUUID(),b.lobby_id,team,matchNo,placement,kills,points]);
  await db.query(`insert into audit_logs(id,action,detail) values($1,'LIVE_SCORE_UPDATED',$2)`,[crypto.randomUUID(),`${team} · Match ${matchNo} · ${points} pts`]);
  return NextResponse.json({ok:true,points});
}
