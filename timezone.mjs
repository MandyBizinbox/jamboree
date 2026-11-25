/** South African input date/time to Polish local date/time, using actual DST for the travel date. */
export function polishDateTimeFromSouthAfrica(date,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!/^\d{2}:\d{2}$/.test(time||''))return null;
 const [y,m,d]=date.split('-').map(Number),[hh,mm]=time.split(':').map(Number);
 if(hh>23||mm>59||m<1||m>12||d<1||d>31)return null;
 const instant=new Date(Date.UTC(y,m-1,d,hh-2,mm));
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant).map(x=>[x.type,x.value]));
 return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
