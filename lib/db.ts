import {Pool} from "pg";
const g=globalThis as unknown as {pool?:Pool};
export const db=g.pool??new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?{rejectUnauthorized:false}:undefined});
if(process.env.NODE_ENV!=="production")g.pool=db;
