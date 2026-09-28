import{NextResponse}from"next/server";
import{db}from"@/lib/db";
export const dynamic="force-dynamic";
export async function GET(req:Request){
  const u=new URL(req.url),lobby=String(u.searchParams.get("lobby_id")||"").trim();
  if(!lobby)return NextResponse.json({error:"Lobby is required"},{status:400});
  const l=await db.query(`select id,title,match_count,game from lobbies where id=$1`,[lobby]);
  if(!l.rows.length)return NextResponse.json({error:"Scrim session not found"},{status:404});
  const q=await db.query(`select team_name,sum(points)::int total_points,sum(kills)::int kill_points,sum(case when placement=1 then 1 else 0 end)::int booyahs,sum(case when placement=1 then 12 when placement=2 then 9 when placement=3 then 8 when placement=4 then 7 when placement=5 then 6 when placement=6 then 5 when placement=7 then 4 when placement=8 then 3 when placement=9 then 2 when placement=10 then 1 else 0 end)::int placement_points,count(*)::int matches_played from results where lobby_id=$1 group by team_name order by total_points desc,booyahs desc,kill_points desc,team_name asc`,[lobby]);
  return NextResponse.json({lobby:l.rows[0],rows:q.rows.map((x:any,i:number)=>({...x,rank:i+1}))});
}
