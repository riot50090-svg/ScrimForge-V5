import{NextResponse}from"next/server";import{admin}from"@/lib/auth";import{db}from"@/lib/db";

async function standings(stageId:string,groupId:string){
 const q=await db.query(`select e.team_name,e.registration_id,e.id entry_id,
 coalesce(sum(r.points),0)::int total_points,coalesce(sum(r.kills),0)::int kill_points,
 coalesce(sum(case when r.placement=1 then 1 else 0 end),0)::int booyahs,
 coalesce(sum(case when r.placement=1 then 12 when r.placement=2 then 9 when r.placement=3 then 8 when r.placement=4 then 7 when r.placement=5 then 6 when r.placement=6 then 5 when r.placement=7 then 4 when r.placement=8 then 3 when r.placement=9 then 2 when r.placement=10 then 1 else 0 end),0)::int placement_points,
 count(r.id)::int matches_played
 from tournament_entries e left join results r on r.team_name=e.team_name and r.stage_no=(select stage_no from tournament_stages where id=$1) and (r.group_id=$2 or (r.group_id is null and r.group_no=(select group_no from tournament_groups where id=$2)))
 where e.stage_id=$1 and e.group_id=$2 group by e.id,e.team_name,e.registration_id order by total_points desc,booyahs desc,kill_points desc,e.team_name asc`,[stageId,groupId]);
 return q.rows.map((x:any,i:number)=>({...x,rank:i+1}));
}

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await admin()))return NextResponse.json({error:"Unauthorized"},{status:401});
 const{id}=await params;
 const l=await db.query(`select * from lobbies where id=$1`,[id]);if(!l.rows.length)return NextResponse.json({error:"Scrim not found"},{status:404});
 const stages=await db.query(`select * from tournament_stages where lobby_id=$1 order by stage_no`,[id]);
 const groups=await db.query(`select g.*,s.stage_no,s.name stage_name,s.qualify_per_group,s.match_count stage_match_count from tournament_groups g join tournament_stages s on s.id=g.stage_id where s.lobby_id=$1 order by s.stage_no,g.group_no`,[id]);
 const entries=await db.query(`select e.*,g.group_no,g.name group_name,s.stage_no,s.name stage_name from tournament_entries e join tournament_groups g on g.id=e.group_id join tournament_stages s on s.id=e.stage_id where s.lobby_id=$1 order by s.stage_no,g.group_no,e.team_name`,[id]);
 const pools=await db.query(`select p.*,coalesce(json_agg(json_build_object('id',pe.id,'registration_id',pe.registration_id,'team_name',pe.team_name,'rank',pe.rank) order by pe.rank) filter (where pe.id is not null),'[]') members from tournament_pools p left join tournament_pool_entries pe on pe.pool_id=p.id where p.lobby_id=$1 group by p.id order by p.created_at`,[id]);
 const outGroups=await Promise.all(groups.rows.map(async(g:any)=>({...g,teams:entries.rows.filter((e:any)=>e.group_id===g.id),standings:await standings(g.stage_id,g.id)})));
 return NextResponse.json({lobby:l.rows[0],stages:stages.rows,groups:outGroups,pools:pools.rows});
}

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await admin()))return NextResponse.json({error:"Unauthorized"},{status:401});
 const{id}=await params,b=await req.json();
 if(b.action==="update_stage"){
   const stageNo=Number(b.stage_no||1),matchCount=Math.max(1,Math.min(16,Number(b.match_count||1))),qualify=Math.max(1,Number(b.qualify_per_group||1));
   const s=await db.query(`select id,group_size from tournament_stages where lobby_id=$1 and stage_no=$2`,[id,stageNo]);
   if(!s.rows.length)return NextResponse.json({error:"Stage not found"},{status:404});
   if(qualify>Number(s.rows[0].group_size||12))return NextResponse.json({error:"Qualifiers per group cannot exceed the teams per group."},{status:400});
   await db.query(`update tournament_stages set match_count=$3,qualify_per_group=$4,next_match_count=case when $5::int is null then next_match_count else greatest(1,least(16,$5::int)) end,next_group_count=case when $6::int is null then next_group_count else greatest(1,$6::int) end,next_group_size=case when $7::int is null then next_group_size else greatest(1,$7::int) end,next_stage_name=case when $8::text is null then next_stage_name else nullif($8::text,'') end,next_qualification_mode=case when $9::text is null then next_qualification_mode else $9::text end,next_qualify_per_group=case when $10::int is null then next_qualify_per_group else greatest(1,$10::int) end,next_qualify_total=case when $11::int is null then next_qualify_total else greatest(1,$11::int) end,next_distribution_mode=case when $12::text is null then next_distribution_mode else $12::text end where lobby_id=$1 and stage_no=$2`,[id,stageNo,matchCount,qualify,b.next_match_count==null?null:Number(b.next_match_count),b.next_group_count==null?null:Number(b.next_group_count),b.next_group_size==null?null:Number(b.next_group_size),b.next_stage_name==null?null:String(b.next_stage_name),b.next_qualification_mode==null?null:String(b.next_qualification_mode),b.next_qualify_per_group==null?null:Number(b.next_qualify_per_group),b.next_qualify_total==null?null:Number(b.next_qualify_total),b.next_distribution_mode==null?null:String(b.next_distribution_mode)]);
   if(stageNo===1)await db.query(`update lobbies set match_count=$2 where id=$1`,[id,matchCount]);
   return NextResponse.json({ok:true,stage_no:stageNo,match_count:matchCount,qualify_per_group:qualify});
 }
 if(b.action==="generate_groups"){
   const l=await db.query(`select * from lobbies where id=$1`,[id]);if(!l.rows.length)return NextResponse.json({error:"Scrim not found"},{status:404});
   const stageNo=Number(b.stage_no||1);const s=await db.query(`select * from tournament_stages where lobby_id=$1 and stage_no=$2`,[id,stageNo]);if(!s.rows.length)return NextResponse.json({error:"Stage not found"},{status:404});
   const stage=s.rows[0];const regs=await db.query(`select id,team_name from registrations where lobby_id=$1 and status='CONFIRMED' order by created_at asc`,[id]);
   if(!regs.rows.length)return NextResponse.json({error:"No confirmed teams are available to group."},{status:400});
   if(stageNo===1&&regs.rows.length>Number(l.rows[0].max_teams))return NextResponse.json({error:"Confirmed teams exceed the event capacity."},{status:400});
   const existing=await db.query(`select count(*)::int count from tournament_entries where stage_id=$1`,[stage.id]);if(existing.rows[0].count>0)return NextResponse.json({error:"Groups already generated for this stage. Delete/rebuild is disabled after assignment."},{status:409});
   await db.query("begin");try{
     const size=Math.max(1,Number(stage.group_size||12)),shuffled=[...regs.rows];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}const count=Math.ceil(shuffled.length/size);
     for(let i=0;i<count;i++)await db.query(`insert into tournament_groups(id,stage_id,group_no,name,status) values($1,$2,$3,$4,'OPEN')`,[crypto.randomUUID(),stage.id,i+1,`Group ${i+1}`]);
     const gs=await db.query(`select id,group_no from tournament_groups where stage_id=$1 order by group_no`,[stage.id]);
     for(let i=0;i<shuffled.length;i++){const g=gs.rows[Math.floor(i/size)];await db.query(`insert into tournament_entries(id,stage_id,group_id,registration_id,team_name,seed,status) values($1,$2,$3,$4,$5,$6,'ACTIVE')`,[crypto.randomUUID(),stage.id,g.id,shuffled[i].id,shuffled[i].team_name,i+1]);}
     await db.query(`update tournament_stages set status='LIVE' where id=$1`,[stage.id]);
     await db.query(`insert into audit_logs(id,action,detail) values($1,'GROUPS_GENERATED',$2)`,[crypto.randomUUID(),`${l.rows[0].title} · Stage ${stageNo} · ${count} groups · ${regs.rows.length} teams`]);
     await db.query("commit");return NextResponse.json({ok:true,groups:count});
   }catch(e){await db.query("rollback");throw e}
 }
 if(b.action==="create_qualification_pool"){
  const stageNo=Number(b.stage_no||1),total=Math.max(1,Number(b.qualify_total||0));
  const s=await db.query(`select * from tournament_stages where lobby_id=$1 and stage_no=$2`,[id,stageNo]);
  if(!s.rows.length)return NextResponse.json({error:"Stage not found"},{status:404});
  const stage=s.rows[0],gs=await db.query(`select id,group_no,name from tournament_groups where stage_id=$1 order by group_no`,[stage.id]);
  if(!gs.rows.length)return NextResponse.json({error:"No groups found for this stage."},{status:400});
  const existing=await db.query(`select id from tournament_pools where lobby_id=$1 and source_stage_no=$2 and role='QUALIFICATION' and status='OPEN'`,[id,stageNo]);
  if(existing.rows.length)return NextResponse.json({error:"A qualification pool already exists for this stage."},{status:409});
  const all:any[]=[];
  for(const g of gs.rows){
    const rows=await standings(stage.id,g.id);if(!rows.length)return NextResponse.json({error:`No teams found in ${g.name}.`},{status:400});
    const coverage=await db.query(`select team_name,count(distinct match_no)::int matches from results where lobby_id=$1 and stage_no=$2 and (group_id=$3 or (group_id is null and group_no=$4)) group by team_name`,[id,stageNo,g.id,g.group_no]);
    const covered=new Map(coverage.rows.map((x:any)=>[x.team_name,Number(x.matches)]));
    const missing=rows.filter((r:any)=>Number(covered.get(r.team_name)||0)<Number(stage.match_count||1));
    if(missing.length)return NextResponse.json({error:`${g.name} is not complete. Enter all ${stage.match_count} match results for every team before creating the qualification pool.`},{status:400});
    all.push(...rows);
  }
  all.sort((a:any,b:any)=>Number(b.total_points)-Number(a.total_points)||Number(b.booyahs)-Number(a.booyahs)||Number(b.kill_points)-Number(a.kill_points)||a.team_name.localeCompare(b.team_name));
  if(total>=all.length)return NextResponse.json({error:`Select fewer than all ${all.length} teams to create a qualification pool.`},{status:400});
  const selected=all.slice(0,total),poolId=crypto.randomUUID(),l=await db.query(`select title from lobbies where id=$1`,[id]);
  const client=await db.connect();try{await client.query("begin");
    await client.query(`insert into tournament_pools(id,lobby_id,source_stage_no,name,role,status,previous_qualify_per_group) values($1,$2,$3,$4,'QUALIFICATION','OPEN',$5)`,[poolId,id,stageNo,`${b.pool_name||`Top ${total} Qualification Pool`}`,Number(stage.qualify_per_group||1)]);
    await client.query(`update tournament_stages set status='COMPLETED',completed_at=now(),qualification_mode='top_overall' where id=$1`,[stage.id]);
    await client.query(`update tournament_entries set qualified=false,status='ELIMINATED' where stage_id=$1`,[stage.id]);
    for(let i=0;i<selected.length;i++){const q=selected[i];await client.query(`insert into tournament_pool_entries(id,pool_id,registration_id,team_name,rank) values($1,$2,$3,$4,$5)`,[crypto.randomUUID(),poolId,q.registration_id,q.team_name,i+1]);await client.query(`update tournament_entries set qualified=true,status='QUALIFIED',final_rank=$2 where stage_id=$1 and registration_id=$3`,[stage.id,i+1,q.registration_id]);}
    await client.query(`insert into audit_logs(id,action,detail) values($1,'QUALIFICATION_POOL_CREATED',$2)`,[crypto.randomUUID(),`${l.rows[0].title} · Stage ${stageNo} · Top ${selected.length} qualification pool created from ${all.length} teams`]);
    await client.query("commit");return NextResponse.json({ok:true,pool_id:poolId,qualified:selected.length,total:all.length});
  }catch(e){try{await client.query("rollback")}catch{}throw e}finally{client.release()}
 }
 if(b.action==="reset_qualification_pool") {
  try {
    const stageNo=Number(b.stage_no||0);
    const p=await db.query(`select id,name,previous_qualify_per_group from tournament_pools where lobby_id=$1 and source_stage_no=$2 and role='QUALIFICATION' and status='OPEN' order by created_at desc limit 1`,[id,stageNo]);
    if(!p.rows.length)return NextResponse.json({error:"No open qualification pool exists for this stage."},{status:404});
    const s=await db.query(`select id,name from tournament_stages where lobby_id=$1 and stage_no=$2`,[id,stageNo]);
    if(!s.rows.length)return NextResponse.json({error:"Stage not found."},{status:404});
    const later=await db.query(`select stage_no from tournament_stages where lobby_id=$1 and stage_no>$2 limit 1`,[id,stageNo]);
    if(later.rows.length)return NextResponse.json({error:`Stage ${later.rows[0].stage_no} already exists. Delete that later stage before resetting this qualification pool.`},{status:400});
    const client=await db.connect();
    try {
      await client.query("begin");
      await client.query(`delete from tournament_pools where id=$1`,[p.rows[0].id]);
      await client.query(`update tournament_entries set qualified=false,status='ACTIVE',final_rank=null where stage_id=$1`,[s.rows[0].id]);
      await client.query(`update tournament_stages set status='LIVE',completed_at=null,qualification_mode='each_group',qualify_per_group=$2 where id=$1`,[s.rows[0].id,Math.max(1,Number(p.rows[0].previous_qualify_per_group||1))]);
      const l=await client.query(`select title from lobbies where id=$1`,[id]);
      await client.query(`insert into audit_logs(id,action,detail) values($1,'QUALIFICATION_POOL_RESET',$2)`,[crypto.randomUUID(),`${l.rows[0]?.title||id} · Stage ${stageNo} · qualification pool reset`]);
      await client.query("commit");
      return NextResponse.json({ok:true,stage_no:stageNo});
    }catch(e){try{await client.query("rollback")}catch{}throw e}finally{client.release()}
  }catch(e:any){console.error("RESET QUALIFICATION POOL ERROR",e);return NextResponse.json({error:e?.message||"Could not reset the qualification pool."},{status:500})}
 }
 if(b.action==="advance_stage"){
  try{
   const l=await db.query(`select * from lobbies where id=$1`,[id]);if(!l.rows.length)return NextResponse.json({error:"Scrim not found"},{status:404});
   const stageNo=Number(b.stage_no||1),s=await db.query(`select * from tournament_stages where lobby_id=$1 and stage_no=$2`,[id,stageNo]);if(!s.rows.length)return NextResponse.json({error:"Stage not found"},{status:404});
   const stage=s.rows[0];if(stage.status!="LIVE"&&stage.status!="COMPLETED")return NextResponse.json({error:"Generate groups and complete the stage before advancing teams."},{status:400});
   const gs=await db.query(`select id,group_no,name from tournament_groups where stage_id=$1 order by group_no`,[stage.id]);
   const mode=String(b.qualification_mode||"each_group");
   const qualify=Math.max(1,Number(b.qualify_per_group||stage.qualify_per_group||1));
   const qualifiers:any[]=[];
   const poolSourceId=mode==="split"?String(b.source_pool_id||""):"";
   if(!(mode==="split"&&poolSourceId)) for(const g of gs.rows){
     const rows=await standings(stage.id,g.id);if(!rows.length)return NextResponse.json({error:`No teams found in ${g.name}.`},{status:400});
     const coverage=await db.query(`select team_name,count(distinct match_no)::int matches from results where lobby_id=$1 and stage_no=$2 and (group_id=$3 or (group_id is null and group_no=$4)) group by team_name`,[id,stageNo,g.id,g.group_no]);
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
   if(mode==="split") {
     const directCount=Math.max(1,Number(b.direct_qualifiers||0));
     let all:any[]=[];
     if(poolSourceId){
       const pool=await db.query(`select p.id,p.source_stage_no,p.role,pe.registration_id,pe.team_name,pe.rank from tournament_pools p join tournament_pool_entries pe on pe.pool_id=p.id where p.id=$1 and p.lobby_id=$2 and p.source_stage_no=$3 and p.role='QUALIFICATION' and p.status='OPEN' order by pe.rank`,[poolSourceId,id,stageNo]);
       if(!pool.rows.length)return NextResponse.json({error:"Qualification pool not found for this stage."},{status:404});
       all=pool.rows.map((x:any)=>({registration_id:x.registration_id,team_name:x.team_name,rank:x.rank,total_points:0,booyahs:0,kill_points:0}));
     }else{
       all=gs.rows.flatMap((g:any)=>g._rows||[]);
       all.sort((a:any,b:any)=>Number(b.total_points)-Number(a.total_points)||Number(b.booyahs)-Number(a.booyahs)||Number(b.kill_points)-Number(a.kill_points)||a.team_name.localeCompare(b.team_name));
     }
     if(directCount>=all.length)return NextResponse.json({error:`Split needs at least one Last Chance team. ${all.length} teams are available, but ${directCount} direct finalists were selected.`},{status:400});
     const direct=all.slice(0,directCount), remaining=all.slice(directCount);
     const nextNo=stageNo+1;const nextExisting=await db.query(`select id from tournament_stages where lobby_id=$1 and stage_no=$2`,[id,nextNo]);if(nextExisting.rows.length)return NextResponse.json({error:"The next stage already exists."},{status:409});
     const nextGroups=Math.max(1,Number(b.next_groups||Math.ceil(remaining.length/12))),nextSize=Math.max(1,Number(b.next_group_size||12));
     if(remaining.length>nextGroups*nextSize)return NextResponse.json({error:`${remaining.length} remaining teams do not fit into ${nextGroups} groups of ${nextSize}. You selected ${nextGroups} groups × ${nextSize} teams = ${nextGroups*nextSize} places.`},{status:400});
     const splitQual=Math.max(1,Number(b.next_qualify_per_group||3));
     if(splitQual>nextSize)return NextResponse.json({error:`Last Chance qualifiers per group (${splitQual}) cannot exceed the group size (${nextSize}).`},{status:400});
     const nextMode=["balanced","random","snake"].includes(String(b.next_distribution_mode))?String(b.next_distribution_mode):"balanced";
     const nextName=String(b.next_stage_name||`Last Chance`).trim()||`Last Chance`;
     const client=await db.connect();try{await client.query("begin");
       await client.query(`update tournament_stages set status='COMPLETED',completed_at=now(),qualify_per_group=$2,qualification_mode='split' where id=$1`,[stage.id,directCount]);
       await client.query(`update tournament_entries set qualified=false,status='ELIMINATED' where stage_id=$1`,[stage.id]);
       const directPoolId=crypto.randomUUID(),remainPoolId=crypto.randomUUID();
       await client.query(`insert into tournament_pools(id,lobby_id,source_stage_no,name,role,status) values($1,$2,$3,$4,'DIRECT_FINALISTS','OPEN'),($5,$2,$3,$6,'REMAINING','OPEN')`,[directPoolId,id,stageNo,`Direct Finalists`,remainPoolId,`Last Chance Pool`]);
       if(poolSourceId)await client.query(`update tournament_pools set status='CONSUMED' where id=$1`,[poolSourceId]);
       for(let i=0;i<direct.length;i++){const q=direct[i];await client.query(`insert into tournament_pool_entries(id,pool_id,registration_id,team_name,rank) values($1,$2,$3,$4,$5)`,[crypto.randomUUID(),directPoolId,q.registration_id,q.team_name,i+1]);await client.query(`update tournament_entries set qualified=true,status='QUALIFIED',final_rank=$2 where stage_id=$1 and registration_id=$3`,[stage.id,i+1,q.registration_id]);}
       for(let i=0;i<remaining.length;i++){const q=remaining[i];await client.query(`insert into tournament_pool_entries(id,pool_id,registration_id,team_name,rank) values($1,$2,$3,$4,$5)`,[crypto.randomUUID(),remainPoolId,q.registration_id,q.team_name,direct.length+i+1]);await client.query(`update tournament_entries set qualified=false,status='REMAINING',final_rank=$2 where stage_id=$1 and registration_id=$3`,[stage.id,direct.length+i+1,q.registration_id]);}
       const nextStageId=crypto.randomUUID();
       await client.query(`insert into tournament_stages(id,lobby_id,stage_no,name,match_count,qualify_per_group,group_size,status,distribution_mode,source_stage_no,qualification_mode,source_pool,source_pool_id,direct_pool_id) values($1,$2,$3,$4,$5,$6,$7,'LIVE',$8,$9,'each_group','remaining',$10,$11)`,[nextStageId,id,nextNo,nextName,Math.max(1,Math.min(16,Number(b.next_match_count??stage.next_match_count??1))),splitQual,nextSize,nextMode,stageNo,remainPoolId,directPoolId]);
       for(let i=0;i<nextGroups;i++)await client.query(`insert into tournament_groups(id,stage_id,group_no,name,status) values($1,$2,$3,$4,'OPEN')`,[crypto.randomUUID(),nextStageId,i+1,`Group ${i+1}`]);
       const ng=await client.query(`select id,group_no from tournament_groups where stage_id=$1 order by group_no`,[nextStageId]);let seeded=[...remaining];
       if(nextMode==='random')seeded.sort(()=>Math.random()-0.5);else seeded.sort((a:any,b:any)=>Number(b.total_points)-Number(a.total_points)||Number(b.booyahs)-Number(a.booyahs)||Number(b.kill_points)-Number(a.kill_points)||a.team_name.localeCompare(b.team_name));
       for(let i=0;i<seeded.length;i++){let g;if(nextMode==='snake'){const round=Math.floor(i/ng.rows.length),pos=i%ng.rows.length;g=ng.rows[round%2===0?pos:ng.rows.length-1-pos]}else g=ng.rows[i%ng.rows.length];await client.query(`insert into tournament_entries(id,stage_id,group_id,registration_id,team_name,seed,status) values($1,$2,$3,$4,$5,$6,'ACTIVE')`,[crypto.randomUUID(),nextStageId,g.id,seeded[i].registration_id,seeded[i].team_name,i+1]);}
       await client.query(`update lobbies set current_stage=$2 where id=$1`,[id,nextNo]);await client.query(`insert into audit_logs(id,action,detail) values($1,'STAGE_SPLIT',$2)`,[crypto.randomUUID(),`${l.rows[0].title} · Stage ${stageNo} split · ${direct.length} direct finalists · ${remaining.length} Last Chance teams`]);await client.query("commit");return NextResponse.json({ok:true,split:true,direct:direct.length,remaining:remaining.length,next_stage:nextNo,groups:nextGroups,group_size:nextSize,pool_id:directPoolId});
     }catch(e){try{await client.query("rollback")}catch{}throw e}finally{client.release()}
   }
   if(!qualifiers.length)return NextResponse.json({error:"No teams qualified."},{status:400});
   const nextNo=stageNo+1;const nextExisting=await db.query(`select id from tournament_stages where lobby_id=$1 and stage_no=$2`,[id,nextNo]);if(nextExisting.rows.length)return NextResponse.json({error:"The next stage already exists. Use the existing stage or create it after changing the stage flow."},{status:409});
   const nextGroups=Math.max(1,Number(b.next_groups||Math.ceil(qualifiers.length/12))),nextSize=Math.max(1,Number(b.next_group_size||12));
   if(qualifiers.length>nextGroups*nextSize)return NextResponse.json({error:`${qualifiers.length} teams do not fit into ${nextGroups} groups of ${nextSize}. Increase the group count/size.`},{status:400});
   const nextMode=["balanced","random","snake"].includes(String(b.next_distribution_mode))?String(b.next_distribution_mode):"balanced";
   const nextName=String(b.next_stage_name||`Stage ${nextNo}`).trim()||`Stage ${nextNo}`;
   const client=await db.connect();try{
     await client.query("begin");
     await client.query(`update tournament_stages set status='COMPLETED',completed_at=now(),qualify_per_group=$2,qualification_mode=$3 where id=$1`,[stage.id,qualify,mode]);
     await client.query(`update tournament_entries set qualified=false,status='ELIMINATED' where stage_id=$1`,[stage.id]);
     for(const q of qualifiers)await client.query(`update tournament_entries set qualified=true,status='QUALIFIED',final_rank=$2 where id=$1`,[q.entry_id,q.rank]);
     const nextStageId=crypto.randomUUID();
     await client.query(`insert into tournament_stages(id,lobby_id,stage_no,name,match_count,qualify_per_group,group_size,status,distribution_mode,source_stage_no,qualification_mode,source_pool) values($1,$2,$3,$4,$5,$6,$7,'LIVE',$8,$9,$10,'qualified')`,[nextStageId,id,nextNo,nextName,Math.max(1,Math.min(16,Number(b.next_match_count ?? stage.next_match_count ?? 1))),Math.max(1,Number(b.next_qualify_per_group||stage.next_qualify_per_group||Math.floor(nextSize/2))),nextSize,nextMode,stageNo,mode]);
     for(let i=0;i<nextGroups;i++)await client.query(`insert into tournament_groups(id,stage_id,group_no,name,status) values($1,$2,$3,$4,'OPEN')`,[crypto.randomUUID(),nextStageId,i+1,`Group ${i+1}`]);
     const ng=await client.query(`select id,group_no from tournament_groups where stage_id=$1 order by group_no`,[nextStageId]);
     let seeded=[...qualifiers];
     if(nextMode==='random')seeded.sort(()=>Math.random()-0.5);else seeded.sort((a:any,b:any)=>Number(b.total_points)-Number(a.total_points)||Number(b.booyahs)-Number(a.booyahs)||Number(b.kill_points)-Number(a.kill_points)||a.team_name.localeCompare(b.team_name));
     for(let i=0;i<seeded.length;i++){
       let g;if(nextMode==='snake'){const round=Math.floor(i/ng.rows.length),pos=i%ng.rows.length;g=ng.rows[round%2===0?pos:ng.rows.length-1-pos]}else g=ng.rows[i%ng.rows.length];
       await client.query(`insert into tournament_entries(id,stage_id,group_id,registration_id,team_name,seed,status) values($1,$2,$3,$4,$5,$6,'ACTIVE')`,[crypto.randomUUID(),nextStageId,g.id,seeded[i].registration_id,seeded[i].team_name,i+1]);
     }
     await client.query(`update lobbies set current_stage=$2 where id=$1`,[id,nextNo]);
     await client.query(`insert into audit_logs(id,action,detail) values($1,'STAGE_ADVANCED',$2)`,[crypto.randomUUID(),`${l.rows[0].title} · Stage ${stageNo} → ${nextNo} · ${qualifiers.length} qualified · ${nextGroups} groups × ${nextSize}`]);
     await client.query("commit");return NextResponse.json({ok:true,qualified:qualifiers.length,next_stage:nextNo,groups:nextGroups,group_size:nextSize});
   }catch(e){try{await client.query("rollback")}catch{}throw e}finally{client.release()}
 }catch(e:any){console.error("ADVANCE STAGE ERROR",e);return NextResponse.json({error:e?.message||"Could not create the next stage. Check the stage settings and try again."},{status:500})}
 }
 if(b.action==="merge_direct_pool") {
   try {
     const l=await db.query(`select * from lobbies where id=$1`,[id]);if(!l.rows.length)return NextResponse.json({error:"Scrim not found"},{status:404});
     const stageNo=Number(b.stage_no||1),s=await db.query(`select * from tournament_stages where lobby_id=$1 and stage_no=$2`,[id,stageNo]);if(!s.rows.length)return NextResponse.json({error:"Stage not found"},{status:404});
     const stage=s.rows[0],poolId=String(b.direct_pool_id||stage.direct_pool_id||"");if(!poolId)return NextResponse.json({error:"No direct finalist pool is linked to this stage."},{status:400});
     const direct=await db.query(`select registration_id,team_name,rank from tournament_pool_entries where pool_id=$1 order by rank`,[poolId]);
     const gs=await db.query(`select id,group_no,name from tournament_groups where stage_id=$1 order by group_no`,[stage.id]);
     const mode=String(b.qualification_mode||"each_group"),qualify=Math.max(1,Number(b.qualify_per_group||stage.qualify_per_group||3));const qualifiers:any[]=[];
     for(const g of gs.rows){const rows=await standings(stage.id,g.id);const coverage=await db.query(`select team_name,count(distinct match_no)::int matches from results where lobby_id=$1 and stage_no=$2 and (group_id=$3 or (group_id is null and group_no=$4)) group by team_name`,[id,stageNo,g.id,g.group_no]);const covered=new Map(coverage.rows.map((x:any)=>[x.team_name,Number(x.matches)]));const missing=rows.filter((r:any)=>Number(covered.get(r.team_name)||0)<Number(stage.match_count||1));if(missing.length)return NextResponse.json({error:`${g.name} is not complete. Enter all ${stage.match_count} match results for every team before advancing.`},{status:400});if(mode==="each_group")qualifiers.push(...rows.slice(0,qualify));else(g._rows=rows);}
     if(mode==="top_overall"){const all=gs.rows.flatMap((g:any)=>g._rows||[]);all.sort((a:any,b:any)=>Number(b.total_points)-Number(a.total_points)||Number(b.booyahs)-Number(a.booyahs)||Number(b.kill_points)-Number(a.kill_points)||a.team_name.localeCompare(b.team_name));qualifiers.push(...all.slice(0,Math.max(1,Number(b.qualify_total||qualify))));}
     const finalTeams=[...direct.rows.map((x:any)=>({registration_id:x.registration_id,team_name:x.team_name})),...qualifiers.map((x:any)=>({registration_id:x.registration_id,team_name:x.team_name}))];if(!finalTeams.length)return NextResponse.json({error:"No teams available for the merged final."},{status:400});
     const nextNo=stageNo+1,exists=await db.query(`select id from tournament_stages where lobby_id=$1 and stage_no=$2`,[id,nextNo]);if(exists.rows.length)return NextResponse.json({error:"The merged final stage already exists."},{status:409});
     const nextGroups=Math.max(1,Number(b.next_groups||1)),nextSize=Math.max(1,Number(b.next_group_size||finalTeams.length));if(finalTeams.length>nextGroups*nextSize)return NextResponse.json({error:`${finalTeams.length} final teams do not fit into the configured final groups.`},{status:400});
     const nextMode=["balanced","random","snake"].includes(String(b.next_distribution_mode))?String(b.next_distribution_mode):"balanced",nextName=String(b.next_stage_name||"Grand Final").trim()||"Grand Final";const client=await db.connect();try{await client.query("begin");await client.query(`update tournament_stages set status='COMPLETED',completed_at=now() where id=$1`,[stage.id]);const nextId=crypto.randomUUID();await client.query(`insert into tournament_stages(id,lobby_id,stage_no,name,match_count,qualify_per_group,group_size,status,distribution_mode,source_stage_no,qualification_mode,source_pool) values($1,$2,$3,$4,$5,$6,$7,'LIVE',$8,$9,'each_group','merged')`,[nextId,id,nextNo,nextName,Math.max(1,Math.min(16,Number(b.next_match_count||1))),Math.max(1,Number(b.next_qualify_per_group||finalTeams.length)),nextSize,nextMode,stageNo]);for(let i=0;i<nextGroups;i++)await client.query(`insert into tournament_groups(id,stage_id,group_no,name,status) values($1,$2,$3,$4,'OPEN')`,[crypto.randomUUID(),nextId,i+1,`Group ${i+1}`]);const ng=await client.query(`select id,group_no from tournament_groups where stage_id=$1 order by group_no`,[nextId]);let seeded=[...finalTeams];if(nextMode==='random')seeded.sort(()=>Math.random()-0.5);for(let i=0;i<seeded.length;i++){const g=ng.rows[i%ng.rows.length];await client.query(`insert into tournament_entries(id,stage_id,group_id,registration_id,team_name,seed,status) values($1,$2,$3,$4,$5,$6,'ACTIVE')`,[crypto.randomUUID(),nextId,g.id,seeded[i].registration_id,seeded[i].team_name,i+1]);}await client.query(`update lobbies set current_stage=$2 where id=$1`,[id,nextNo]);await client.query(`insert into audit_logs(id,action,detail) values($1,'STAGE_MERGED',$2)`,[crypto.randomUUID(),`${l.rows[0].title} · Last Chance Stage ${stageNo} → ${nextNo} · ${finalTeams.length} merged final teams`]);await client.query("commit");return NextResponse.json({ok:true,next_stage:nextNo,teams:finalTeams.length});}catch(e){try{await client.query("rollback")}catch{}throw e}finally{client.release()}
   }catch(e:any){console.error("MERGE FINAL ERROR",e);return NextResponse.json({error:e?.message||"Could not create merged final."},{status:500})}
 }
 if(b.action==="delete_stage") {
   try {
     const stageNo=Number(b.stage_no||0);
     if(stageNo<=1)return NextResponse.json({error:"Stage 1 is the base stage and cannot be deleted."},{status:400});
     const latest=await db.query(`select id,stage_no,name,source_pool_id,direct_pool_id from tournament_stages where lobby_id=$1 order by stage_no desc limit 1`,[id]);
     if(!latest.rows.length)return NextResponse.json({error:"No tournament stages found."},{status:404});
     const stage=latest.rows[0];
     if(Number(stage.stage_no)!==stageNo)return NextResponse.json({error:`Only the latest stage can be deleted. Delete Stage ${stage.stage_no} first.`},{status:400});
     const l=await db.query(`select title from lobbies where id=$1`,[id]);
     const client=await db.connect();
     try {
       await client.query("begin");
       await client.query(`delete from results where lobby_id=$1 and stage_no=$2`,[id,stageNo]);
       await client.query(`delete from tournament_stages where id=$1`,[stage.id]);
       if(stage.source_pool_id)await client.query(`delete from tournament_pools where id=$1`,[stage.source_pool_id]);
       if(stage.direct_pool_id)await client.query(`delete from tournament_pools where id=$1`,[stage.direct_pool_id]);
       const previous=await client.query(`select coalesce(max(stage_no),1)::int stage_no from tournament_stages where lobby_id=$1`,[id]);
       await client.query(`update lobbies set current_stage=$2 where id=$1`,[id,previous.rows[0].stage_no]);
       await client.query(`insert into audit_logs(id,action,detail) values($1,'STAGE_DELETED',$2)`,[crypto.randomUUID(),`${l.rows[0]?.title||id} · Stage ${stageNo} · ${stage.name}`]);
       await client.query("commit");
       return NextResponse.json({ok:true,deleted_stage:stageNo,current_stage:previous.rows[0].stage_no});
     }catch(e){try{await client.query("rollback")}catch{}throw e}finally{client.release()}
   }catch(e:any){console.error("DELETE STAGE ERROR",e);return NextResponse.json({error:e?.message||"Could not delete the stage."},{status:500})}
 }
 if(b.action==="complete_stage"){
   const stageNo=Number(b.stage_no||1);await db.query(`update tournament_stages set status='COMPLETED',completed_at=now() where lobby_id=$1 and stage_no=$2`,[id,stageNo]);return NextResponse.json({ok:true});
 }
 const allowed:[string,string][]=[["status","status"],["room_id","room_id"],["room_password","room_password"]];const sets:string[]=[],vals:any[]=[];for(const[k,col]of allowed)if(b[k]!==undefined){vals.push(b[k]);sets.push(`${col}=$${vals.length}`)}if(!sets.length)return NextResponse.json({error:"Nothing to update"},{status:400});vals.push(id);await db.query(`update lobbies set ${sets.join(",")} where id=$${vals.length}`,vals);await db.query(`insert into audit_logs(id,action,detail) values($1,$2,$3)`,[crypto.randomUUID(),b.status==="CLOSED"?"SCRIM_CLOSED":"SCRIM_UPDATED",`${id} · ${b.status||"updated"}`]);return NextResponse.json({ok:true});
}
export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){if(!(await admin()))return NextResponse.json({error:"Unauthorized"},{status:401});const{id}=await params;const q=await db.query(`select title from lobbies where id=$1`,[id]);if(!q.rows.length)return NextResponse.json({error:"Scrim not found"},{status:404});await db.query(`insert into audit_logs(id,action,detail) values($1,'SCRIM_DELETED',$2)`,[crypto.randomUUID(),`${q.rows[0].title} · ${id}`]);await db.query(`delete from lobbies where id=$1`,[id]);return NextResponse.json({ok:true})}
