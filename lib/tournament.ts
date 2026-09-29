import { db } from "@/lib/db";

export async function ensureStageOneGroups(lobbyId: string, maxTeams: number, groupSize = 12, client: any = db) {
  const stageQ = await client.query(`select * from tournament_stages where lobby_id=$1 and stage_no=1`, [lobbyId]);
  if (!stageQ.rows.length) return null;
  const stage = stageQ.rows[0];
  const size = Math.max(1, Number(groupSize || stage.group_size || 12));
  const count = Math.max(1, Math.ceil(Number(maxTeams || 12) / size));
  await client.query(`update tournament_stages set group_size=$2 where id=$1`, [stage.id, size]);
  for (let i = 1; i <= count; i++) {
    await client.query(
      `insert into tournament_groups(id,stage_id,group_no,name,status) values($1,$2,$3,$4,'OPEN') on conflict(stage_id,group_no) do nothing`,
      [crypto.randomUUID(), stage.id, i, `Group ${i}`]
    );
  }
  return { ...stage, group_size: size, group_count: count };
}

export async function assignRegistrationToStageOneGroup(lobbyId: string, registrationId: string, teamName: string, client: any = db) {
  const lobbyQ = await client.query(`select id,max_teams,group_size,event_type from lobbies where id=$1`, [lobbyId]);
  if (!lobbyQ.rows.length || lobbyQ.rows[0].event_type !== "TOURNAMENT") return null;
  const lobby = lobbyQ.rows[0];
  const stage = await ensureStageOneGroups(lobbyId, Number(lobby.max_teams), Number(lobby.group_size || 12), client);
  if (!stage) return null;

  const existing = await client.query(
    `select e.id,e.group_id,g.group_no,g.name from tournament_entries e join tournament_groups g on g.id=e.group_id where e.stage_id=$1 and e.registration_id=$2 and e.status<>'REJECTED' limit 1`,
    [stage.id, registrationId]
  );
  if (existing.rows.length) return existing.rows[0];

  const groups = await client.query(
    `select g.id,g.group_no,g.name,count(e.id)::int team_count
       from tournament_groups g
       left join tournament_entries e on e.group_id=g.id and e.status<>'REJECTED'
      where g.stage_id=$1
      group by g.id,g.group_no,g.name
      order by g.group_no asc`,
    [stage.id]
  );
  const target = groups.rows.find((g: any) => Number(g.team_count) < Number(stage.group_size || 12));
  if (!target) throw new Error("All tournament groups are full.");

  await client.query(`update tournament_stages set status='LIVE' where id=$1 and status='PENDING'`, [stage.id]);
  const entry = await client.query(
    `insert into tournament_entries(id,stage_id,group_id,registration_id,team_name,seed,status)
     values($1,$2,$3,$4,$5,$6,'PENDING') returning id,group_id`,
    [crypto.randomUUID(), stage.id, target.id, registrationId, teamName, Number(target.team_count) + 1]
  );
  return { ...target, entry_id: entry.rows[0].id };
}

export async function syncStageOneGroups(lobbyId: string, client: any = db) {
  const lobbyQ = await client.query(`select * from lobbies where id=$1`, [lobbyId]);
  if (!lobbyQ.rows.length || lobbyQ.rows[0].event_type !== "TOURNAMENT") return null;
  const lobby = lobbyQ.rows[0];
  const stage = await ensureStageOneGroups(lobbyId, Number(lobby.max_teams), Number(lobby.group_size || 12), client);
  if (!stage) return null;

  const regs = await client.query(
    `select id,team_name,created_at from registrations where lobby_id=$1 and status<>'REJECTED' order by created_at asc,id asc`,
    [lobbyId]
  );
  for (const r of regs.rows) {
    await assignRegistrationToStageOneGroup(lobbyId, r.id, r.team_name, client);
  }
  return stage;
}
