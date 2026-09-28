export const id=()=>crypto.randomUUID(); export const code=()=>`SF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
export const money=(n:number)=>`₹${Number(n||0).toLocaleString("en-IN")}`;
export const wa=(msg:string)=>{const n=(process.env.WHATSAPP_NUMBER||"").replace(/\D/g,"");return n?`https://wa.me/${n}?text=${encodeURIComponent(msg)}`:"#"};
