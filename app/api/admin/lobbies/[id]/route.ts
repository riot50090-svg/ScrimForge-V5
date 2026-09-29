import{NextResponse}from"next/server";import{admin}from"@/lib/auth";import{db}from"@/lib/db";import{syncStageOneGroups}from"@/lib/tournament";

async function standings(stageId:string,groupId:string){
 const q=await db.query(`select e.team_name,e.registration_id,e.id entry_id,
 coalesce(sum(r.points),0)::int total_points,coalesce(sum(r.kills),0)::int kill_points,
 coalesce(sum(case when r.placement=1 then 1 else 0 end),0)::int booyahs,
 coalesce(sum(case when r.placement=1 then 12 when r.placement=2 then 9 when r.placement=3 then 8 when r.placement=4 then 7 when r.placement=5 then 6 when r.placement=6 then 5 when r.placement=7 then 4 when r.placement=8 then 3 when r.placement=9 then 2 when r.placement=10 then 1 else 0 end),0)::int placement_points,
 count(r.id)::int matches_played
 from tournament_entries e left join results r on r.team_name=e.team_name and r.stage_no=(select stage_no from tournament_stages where id=$1) and r.group_id=$2
 where e.stage_id=$1 and e.group_id=$2 and e.status in ('ACTIVE','QUALIFIED') group by e.id,e.team_name,e.registration_id order by total_points desc,booyahs desc,kill_points desc,e.team_name asc`,[stageId,groupId]);
 return q.rows.map((x:any,i:number)=>({...x,rank:i+1}));
}

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await admin()))return NextResponse.json({error:"Unauthorized"},{status:401});
 const{id}=await params;
 const l=await db.query(`select * from lobbies where id=$1`,[id]);if(!l.rows.length)return NextResponse.json({error:"Scrim not found"},{status:404});
 if(l.rows[0].event_type==="TOURNAMENT") await syncStageOneGroups(id);
 const stages=await db.query(`select * from tournament_stages where lobby_id=$1 order by stage_no`,[id]);
 const groups=await db.query(`select g.*,s.stage_no,s.name stage_name,s.qualify_per_group,s.match_count stage_match_count from tournament_groups g join tournament_stages s on s.id=g.stage_id where s.lobby_id=$1 order by s.stage_no,g.group_no`,[id]);
 const entries=await db.query(`select e.*,g.group_no,g.name group_name,s.stage_no,s.name stage_name from tournament_entries e join tournament_groups g on g.id=e.group_id join tournament_stages s on s.id=e.stage_id where s.lobby_id=$1 order by s.stage_no,g.group_no,e.team_name`,[id]);
 const outGroups=await Promise.all(groups.rows.map(async(g:any)=>({...g,teams:entries.rows.filter((e:any)=>e.group_id===g.id),standings:await standings(g.stage_id,g.id)})));
 return NextResponse.json({lobby:l.rows[0],stages:stages.rows,groups:outGroups});
}

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await admin()))return NextResponse.json({error:"Unauthorized"},{status:401});
 const{id}=await params,b=await req.json();
 if(b.action==="generate_groups"||b.action==="sync_groups"){
   const l=await db.query(`select * from lobbies where id=$1`,[id]);if(!l.rows.length)return NextResponse.json({error:"Scrim not found"},{status:404});
   if(l.rows[0].event_type!=="TOURNAMENT")return NextResponse.json({error:"This is not a tournament."},{status:400});
   const stageNo=Number(b.stage_no||1);if(stageNo!==1)return NextResponse.json({error:"Automatic registration grouping applies to Stage 1. Later stages are created from qualification results."},{status:400});
   const stage=await syncStageOneGroups(id);if(!stage)return NextResponse.json({error:"Stage 1 not found."},{status:404});
   const gs=await db.query(`select g.id,g.group_no,g.name,count(e.id)::int team_count from tournament_groups g left join tournament_entries e on e.group_id=g.id and e.status<>'REJECTED' where g.stage_id=$1 group by g.id,g.group_no,g.name order by g.group_no`,[stage.id]);
   return NextResponse.json({ok:true,groups:gs.rows});
 }
 if(b.action==="advance_stage"){
   const l=await db.query(`select * from lobbies where id=$1`,[id]);if(!l.rows.length)return NextResponse.json({error:"Scrim not found"},{status:404});
   const stageNo=Number(b.stage_no||1),s=await db.query(`select * from tournament_stages where lobby_id=$1 and stage_no=$2`,[id,stageNo]);if(!s.rows.length)return NextResponse.json({error:"Stage not found"},{status:404});
   const stage=s.rows[0];if(stage.status!="LIVE"&&stage.status!="COMPLETED")return NextResponse.json({error:"Generate groups and complete the stage before advancing teams."},{status:400});
   const gs=await db.query(`select id,group_no,name from tournament_groups where stage_id=$1 order by group_no`,[stage.id]);
   const mode=String(b.qualification_mode||"each_group");
   const qualify=Math.max(1,Number(b.qualify_per_group||stage.qualify_per_group||1));
   const qualifiers:any[]=[];
   for(const g of gs.rows){
     const rows=await standings(stage.id,g.id);if(!rows.length)return NextResponse.json({error:`No teams found in ${g.name}.`},{status:400});
     const coverage=await db.query(`select team_name,count(distinct match_no)::int matches from results where lobby_id=$1 and stage_no=$2 and group_id=$3 group by team_name`,[id,stageNo,g.id]);
     const covered=new Map(coverage.rows.map((x:any)=>[x.team_name,Number(x.matches)]));
     const missing=rows.filter((r:any)=>Number(covered.get(r.team_name)||0)<Number(stage.match_count||1));
     if(missing.length)return NextResponse.json({error:`${g.name} is not complete. Enter all ${stage.match_count} match results for every team before advancing.`},{status:400});
     if(mode==="each_group")qualifiers.push(...rows.slice(0,qualify));
     else (g._rows=rows);
   }
   if(mode==="top_overall"){
     const all=gs.rows.flatMap((g:any)=>g._rows||[]);all.sort((a:any,b:any)=>Number(b.total_points)-Number(a.total_points)||Number(b.booyahs)-Number(a.booyahs)||Number(b.kill_points)-Number(a.kill_points)||a.team_name.localeCompare(b.team_name));
     qualifiers.push(...all.slice(0,Math.max(1,Number(b.qualify_total||qualify))));
   }
   if(!qualifiers.length)return NextResponse.json({error:"No teams qualified."},{status:400});
   const nextNo=stageNo+1;const nextExisting=await db.query(`select id from tournament_stages where lobby_id=$1 and stage_no=$2`,[id,nextNo]);if(nextExisting.rows.length)return NextResponse.json({error:"The next stage already exists. Use the existing stage or create it after changing the stage flow."},{status:409});
   const nextGroups=Math.max(1,Number(b.next_groups||Math.ceil(qualifiers.length/12))),nextSize=Math.max(1,Number(b.next_group_size||12));
   if(qualifiers.length>nextGroups*nextSize)return NextResponse.json({error:`${qualifiers.length} teams do not fit into ${nextGroups} groups of ${nextSize}. Increase the group count/size.`},{status:400});
   const nextMode=["balanced","random","snake"].includes(String(b.next_distribution_mode))?String(b.next_distribution_mode):"balanced";
   const nextName=String(b.next_stage_name||`Stage ${nextNo}`).trim()||`Stage ${nextNo}`;
   await db.query("begin");try{
     await db.query(`update tournament_stages set status='COMPLETED',completed_at=now(),qualify_per_group=$2,qualification_mode=$3 where id=$1`,[stage.id,qualify,mode]);
     await db.query(`update tournament_entries set qualified=false,status='ELIMINATED' where stage_id=$1`,[stage.id]);
     for(const q of qualifiers)await db.query(`update tournament_entries set qualified=true,status='QUALIFIED',final_rank=$2 where id=$1`,[q.entry_id,q.rank]);
     const nextStageId=crypto.randomUUID();
     await db.query(`insert into tournament_stages(id,lobby_id,stage_no,name,match_count,qualify_per_group,group_size,status,distribution_mode,source_stage_no,qualification_mode,source_pool) values($1,$2,$3,$4,$5,$6,$7,'LIVE',$8,$9,'each_group','qualified')`,[nextStageId,id,nextNo,nextName,Number(b.next_match_count||stage.match_count||2),Math.max(1,Number(b.next_qualify_per_group||Math.floor(nextSize/2))),nextSize,nextMode,stageNo]);
     for(let i=0;i<nextGroups;i++)await db.query(`insert into tournament_groups(id,stage_id,group_no,name,status) values($1,$2,$3,$4,'OPEN')`,[crypto.randomUUID(),nextStageId,i+1,`Group ${i+1}`]);
     const ng=await db.query(`select id,group_no from tournament_groups where stage_id=$1 order by group_no`,[nextStageId]);
     let seeded=[...qualifiers];
     if(nextMode==='random')seeded.sort(()=>Math.random()-0.5);else seeded.sort((a:any,b:any)=>Number(b.total_points)-Number(a.total_points)||Number(b.booyahs)-Number(a.booyahs)||Number(b.kill_points)-Number(a.kill_points)||a.team_name.localeCompare(b.team_name));
     for(let i=0;i<seeded.length;i++){
       let g;if(nextMode==='snake'){const round=Math.floor(i/ng.rows.length),pos=i%ng.rows.length;g=ng.rows[round%2===0?pos:ng.rows.length-1-pos]}else g=ng.rows[i%ng.rows.length];
       await db.query(`insert into tournament_entries(id,stage_id,group_id,registration_id,team_name,seed,status) values($1,$2,$3,$4,$5,$6,'ACTIVE')`,[crypto.randomUUID(),nextStageId,g.id,seeded[i].registration_id,i+1]);
     }
     await db.query(`update lobbies set current_stage=$2 where id=$1`,[id,nextNo]);
     await db.query(`insert into audit_logs(id,action,detail) values($1,'STAGE_ADVANCED',$2)`,[crypto.randomUUID(),`${l.rows[0].title} · Stage ${stageNo} → ${nextNo} · ${qualifiers.length} qualified · ${nextGroups} groups × ${nextSize}`]);
     await db.query("commit");return NextResponse.json({ok:true,qualified:qualifiers.length,next_stage:nextNo,groups:nextGroups,group_size:nextSize});
   }catch(e){await db.query("rollback");throw e}
 }
 if(b.action==="complete_stage"){
   const stageNo=Number(b.stage_no||1);await db.query(`update tournament_stages set status='COMPLETED',completed_at=now() where lobby_id=$1 and stage_no=$2`,[id,stageNo]);return NextResponse.json({ok:true});
 }
 const allowed:[string,string][]=[["status","status"],["room_id","room_id"],["room_password","room_password"]];const sets:string[]=[],vals:any[]=[];for(const[k,col]of allowed)if(b[k]!==undefined){vals.push(b[k]);sets.push(`${col}=$${vals.length}`)}if(!sets.length)return NextResponse.json({error:"Nothing to update"},{status:400});vals.push(id);await db.query(`update lobbies set ${sets.join(",")} where id=$${vals.length}`,vals);await db.query(`insert into audit_logs(id,action,detail) values($1,$2,$3)`,[crypto.randomUUID(),b.status==="CLOSED"?"SCRIM_CLOSED":"SCRIM_UPDATED",`${id} · ${b.status||"updated"}`]);return NextResponse.json({ok:true});
}
export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){if(!(await admin()))return NextResponse.json({error:"Unauthorized"},{status:401});const{id}=await params;const q=await db.query(`select title from lobbies where id=$1`,[id]);if(!q.rows.length)return NextResponse.json({error:"Scrim not found"},{status:404});await db.query(`insert into audit_logs(id,action,detail) values($1,'SCRIM_DELETED',$2)`,[crypto.randomUUID(),`${q.rows[0].title} · ${id}`]);await db.query(`delete from lobbies where id=$1`,[id]);return NextResponse.json({ok:true})}
