import{NextResponse}from"next/server";
import{admin}from"@/lib/auth";
import{db}from"@/lib/db";
import{z}from"zod";

export async function POST(req:Request){
  if(!(await admin()))return NextResponse.json({error:"Unauthorized"},{status:401});
  const b=await req.json();
  const p=z.object({
    title:z.string().min(2),entry_fee:z.number().int().min(0),prize_pool:z.number().int().min(0),
    schedule_mode:z.enum(["datetime","tbd","custom"]),starts_at:z.string().optional(),schedule_text:z.string().optional(),
    rules:z.string().optional(),match_count:z.number().int().min(1).max(16).default(6),
    max_teams:z.number().int().min(1).max(1000).default(12),event_type:z.enum(["SCRIM","TOURNAMENT"]).default("SCRIM")
  }).safeParse(b);
  if(!p.success)return NextResponse.json({error:"Invalid Free Fire event details"},{status:400});
  const x=p.data;
  let startsAt:Date|null=null,scheduleText:string|null=null;
  if(x.schedule_mode==="datetime"){
    if(!x.starts_at)return NextResponse.json({error:"Please choose a start date and time."},{status:400});
    startsAt=new Date(x.starts_at); if(Number.isNaN(startsAt.getTime()))return NextResponse.json({error:"Invalid start date and time."},{status:400});
  }else if(x.schedule_mode==="tbd")scheduleText="To be decided";else scheduleText=x.schedule_text?.trim()||"To be decided";
  const id=crypto.randomUUID();
  await db.query(`insert into lobbies(id,title,game,mode,map,entry_fee,prize_pool,max_teams,match_count,starts_at,schedule_text,rules,event_type,group_size) values($1,$2,'Free Fire','Squad',NULL,$3,$4,$5,$6,$7,$8,$9,$10,12)`,[
    id,x.title,x.entry_fee,x.prize_pool,x.max_teams,x.match_count,startsAt,scheduleText,x.rules||"Free Fire squad event. Maps are announced by admin before each match.",x.event_type
  ]);
  const stageId=crypto.randomUUID();
  await db.query(`insert into tournament_stages(id,lobby_id,stage_no,name,match_count,qualify_per_group,group_size,status) values($1,$2,1,$3,$4,$5,12,'PENDING')`,[stageId,id,x.event_type==="TOURNAMENT"?"Stage 1":"Main Stage",x.match_count,4]);
  if(x.event_type==="TOURNAMENT"){
    const groupCount=Math.max(1,Math.ceil(Number(x.max_teams)/12));
    for(let i=1;i<=groupCount;i++)await db.query(`insert into tournament_groups(id,stage_id,group_no,name,status) values($1,$2,$3,$4,'OPEN') on conflict(stage_id,group_no) do nothing`,[crypto.randomUUID(),stageId,i,`Group ${i}`]);
  }
  return NextResponse.json({ok:true,id});
}
