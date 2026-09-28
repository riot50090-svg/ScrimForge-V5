import {cookies} from "next/headers"; import {SignJWT,jwtVerify} from "jose";
const secret=new TextEncoder().encode(process.env.AUTH_SECRET||"change-this-secret-now"); const name="sf_admin";
export async function login(id:string){const t=await new SignJWT({id}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("7d").sign(secret);(await cookies()).set(name,t,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:604800})}
export async function admin(){try{const t=(await cookies()).get(name)?.value;if(!t)return null;const {payload}=await jwtVerify(t,secret);return typeof payload.id==="string"?payload.id:null}catch{return null}}
export async function logout(){(await cookies()).delete(name)}
