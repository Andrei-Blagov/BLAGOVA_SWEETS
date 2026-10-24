// Staff reads use the same trust boundary as the public projection. Preserve
// historical bodies/roles, but never turn a legacy source string into evidence.
export function projectStaffMessage(message){
 const assistant=message.sender==='assistant'||message.sender==='system';
 return {...message,source:null,unverified:assistant&&message.assistant_policy!=='handoff-v1'};
}
