const {Client}=require('pg'); const bcrypt=require('bcryptjs');
(async()=>{if(!process.env.DATABASE_URL){console.log('DATABASE_URL missing; skipping DB init for local build.');return}
const c=new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); await c.connect();
await c.query(`CREATE TABLE IF NOT EXISTS admins(id text primary key,email text unique not null,password_hash text not null,created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS lobbies(id text primary key,title text not null,game text not null,mode text not null,map text,entry_fee int default 0,prize_pool int default 0,max_teams int default 12,match_count int default 6,starts_at timestamptz not null,status text default 'OPEN',room_id text,room_password text,rules text,created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS scrim_teams(id text primary key,lobby_id text references lobbies(id) on delete cascade,team_name text not null,captain_name text,contact_no text,created_at timestamptz default now(),unique(lobby_id,team_name));
CREATE TABLE IF NOT EXISTS registrations(id text primary key,code text unique not null,player_name text not null,team_name text not null,whatsapp text not null,game_id text,game text not null,lobby_id text references lobbies(id) on delete set null,status text default 'PENDING',payment_status text default 'UNPAID',payment_ref text,notes text,created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS results(id text primary key,lobby_id text references lobbies(id) on delete cascade,team_name text not null,match_no int not null default 1,placement int default 0,kills int default 0,points int default 0,created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS audit_logs(id text primary key,action text not null,detail text,created_at timestamptz default now());
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS match_count int NOT NULL DEFAULT 6;
-- Registration UI uses team_name + player_name(captain) + whatsapp(contact). Free Fire UID is intentionally optional/unused.
ALTER TABLE results ADD COLUMN IF NOT EXISTS match_no int NOT NULL DEFAULT 1;
UPDATE lobbies SET game='Free Fire',mode='Squad',map=NULL,max_teams=12,match_count=COALESCE(match_count,6) WHERE game IS NULL OR game<>'Free Fire' OR mode<>'Squad' OR map IS NOT NULL OR max_teams<>12 OR match_count IS NULL;
ALTER TABLE lobbies DROP CONSTRAINT IF EXISTS lobbies_match_count_check;
ALTER TABLE lobbies ADD CONSTRAINT lobbies_match_count_check CHECK(match_count BETWEEN 1 AND 16);
ALTER TABLE results DROP CONSTRAINT IF EXISTS results_match_no_check;
ALTER TABLE results ADD CONSTRAINT results_match_no_check CHECK(match_no BETWEEN 1 AND 16);
`);
const email=(process.env.ADMIN_EMAIL||'admin@scrimforge.com').toLowerCase(), pass=process.env.ADMIN_PASSWORD||'ChangeThisStrongPassword123!'; const hash=await bcrypt.hash(pass,12);
await c.query(`INSERT INTO admins(id,email,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET password_hash=$3`,[`adm_${Date.now()}`,email,hash]); await c.end(); console.log('ScrimForge DB ready.');})().catch(e=>{console.error(e);process.exit(1)});
