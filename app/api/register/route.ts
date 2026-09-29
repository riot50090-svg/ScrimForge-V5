import{NextResponse}from"next/server";import{db}from"@/lib/db";import{code,id,wa}from"@/lib/util";import{assignRegistrationToStageOneGroup}from"@/lib/tournament";
export async function POST(req:Request){
 try{
  const b=await req.json();
  for(const k of ["captainName","teamName","contactNo"]){if(!String(b[k]||"").trim())return NextResponse.json({error:"Please fill team name, captain name and contact number."},{status:400})}
  const lobbyId=String(b.lobbyId||"").trim();if(!lobbyId)return NextResponse.json({error:"Please select a Free Fire scrim session."},{status:400});
  const captain=String(b.captainName).trim(),team=String(b.teamName).trim(),contact=String(b.contactNo).trim(),c=code();
  const client=await db.connect();
  try{
   await client.query("begin");
   const lq=await client.query(`select id,title,status,max_teams,event_type,group_size from lobbies where id=$1 for update`,[lobbyId]);
   if(!lq.rows.length){await client.query("rollback");return NextResponse.json({error:"That scrim session does not exist."},{status:404})}
   const l=lq.rows[0];
   if(["CLOSED","COMPLETED","CANCELLED"].includes(l.status)){await client.query("rollback");return NextResponse.json({error:"Registration is closed for this scrim."},{status:400})}
   const count=await client.query(`select count(*)::int count from registrations where lobby_id=$1 and status<>'REJECTED'`,[lobbyId]);
   if(Number(count.rows[0].count)>=Number(l.max_teams)){await client.query("rollback");return NextResponse.json({error:"All registration slots for this event are full."},{status:409})}
   const existing=await client.query(`select id from registrations where lobby_id=$1 and lower(team_name)=lower($2) and status<>'REJECTED' limit 1`,[lobbyId,team]);
   if(existing.rows.length){await client.query("rollback");return NextResponse.json({error:"That team is already registered for this scrim."},{status:409})}
   const regId=id();
   await client.query(`insert into registrations(id,code,player_name,team_name,whatsapp,game_id,game,lobby_id) values($1,$2,$3,$4,$5,NULL,'Free Fire',$6)`,[regId,c,captain,team,contact,lobbyId]);
   let group:any=null;
   if(l.event_type==="TOURNAMENT") group=await assignRegistrationToStageOneGroup(lobbyId,regId,team,client);
   await client.query(`insert into audit_logs(id,action,detail) values($1,'REGISTRATION_CREATED',$2)`,[id(),`${c} · ${team} · Captain: ${captain} · Free Fire · ${l.title}${group?` · ${group.name}`:""}`]);
   await client.query("commit");
   return NextResponse.json({code:c,group_name:group?.name||null,whatsappUrl:wa(`Hello ScrimForge! I registered for a Free Fire event.\nRegistration Code: ${c}. Team: ${team}. Captain: ${captain}. Contact: ${contact}.${group?` Group: ${group.name}.`:""}`)});
  }catch(e:any){await client.query("rollback");return NextResponse.json({error:e?.message||"Could not create registration."},{status:400})}finally{client.release()}
 }catch(e){console.error(e);return NextResponse.json({error:"Could not create registration."},{status:500})}
}
