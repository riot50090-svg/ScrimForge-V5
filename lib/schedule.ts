export function scheduleLabel(x:any,opts?:{dateStyle?:Intl.DateTimeFormatOptions["dateStyle"];timeStyle?:Intl.DateTimeFormatOptions["timeStyle"]}){
  if(x.schedule_text)return x.schedule_text;
  if(!x.starts_at)return "To be decided";
  return new Date(x.starts_at).toLocaleString("en-IN",{dateStyle:opts?.dateStyle||"medium",timeStyle:opts?.timeStyle||"short"});
}
