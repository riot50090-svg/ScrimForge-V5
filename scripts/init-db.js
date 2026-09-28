const {Client}=require('pg'); const bcrypt=require('bcryptjs');
(async()=>{if(!process.env.DATABASE_URL){console.log('DATABASE_URL missing; skipping DB init for local build.');return}
const c=new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); await c.connect();
await c.query(`CREATE TABLE IF NOT EXISTS admins(id text primary key,email text unique not null,password_hash text not null,created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS lobbies(id text primary key,title text not null,game text not null,mode text not null,map text,entry_fee int default 0,prize_pool int default 0,max_teams int default 25,starts_at timestamptz not null,status text default 'OPEN',room_id text,room_password text,rules text,created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS registrations(id text primary key,code text unique not null,player_name text not null,team_name text not null,whatsapp text not null,game_id text,game text not null,lobby_id text references lobbies(id) on delete set null,status text default 'PENDING',payment_status text default 'UNPAID',payment_ref text,notes text,created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS results(id text primary key,lobby_id text references lobbies(id) on delete cascade,team_name text not null,placement int default 0,kills int default 0,points int default 0,created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS audit_logs(id text primary key,action text not null,detail text,created_at timestamptz default now());`);
const email=(process.env.ADMIN_EMAIL||'admin@scrimforge.com').toLowerCase(), pass=process.env.ADMIN_PASSWORD||'ChangeThisStrongPassword123!'; const hash=await bcrypt.hash(pass,12);
await c.query(`INSERT INTO admins(id,email,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET password_hash=$3`,[`adm_${Date.now()}`,email,hash]); await c.end(); console.log('ScrimForge DB ready.');})().catch(e=>{console.error(e);process.exit(1)});
