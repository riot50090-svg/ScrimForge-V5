import{NextResponse}from"next/server";
import{admin}from"@/lib/auth";
import{db}from"@/lib/db";
import{z}from"zod";

export async function POST(req:Request){
  if(!(await admin()))return NextResponse.json({error:"Unauthorized"},{status:401});
  const b=await req.json();
  const p=z.object({
    title:z.string().min(2),
    entry_fee:z.number().int().min(0),
    prize_pool:z.number().int().min(0),
    starts_at:z.string(),
    rules:z.string().optional(),
    match_count:z.number().int().min(1).max(16).default(6)
  }).safeParse(b);
  if(!p.success)return NextResponse.json({error:"Invalid Free Fire scrim details"},{status:400});
  const x=p.data;
  await db.query(`insert into lobbies(id,title,game,mode,map,entry_fee,prize_pool,max_teams,match_count,starts_at,rules) values($1,$2,'Free Fire','Squad',NULL,$3,$4,12,$5,$6,$7)`,[
    crypto.randomUUID(),x.title,x.entry_fee,x.prize_pool,x.match_count,new Date(x.starts_at),x.rules||"Free Fire squad scrim. Match count is set by the admin (usually 6). Maps are announced by admin before each match."
  ]);
  return NextResponse.json({ok:true});
}
