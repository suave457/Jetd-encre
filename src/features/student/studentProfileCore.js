// Fixed pictograms already used by the original onboarding. No uploaded image or URL.
export const STUDENT_AVATARS = Object.freeze([
  Object.freeze({ id: 'initials', label: 'Mes initiales' }),
  Object.freeze({ id: 'sparkle', label: 'Étoile' }),
  Object.freeze({ id: 'book', label: 'Livre' }),
  Object.freeze({ id: 'trophy', label: 'Trophée' }),
  Object.freeze({ id: 'pencil', label: 'Crayon' }),
]);
export function isStudentAvatar(value) {
  return typeof value === 'string' && STUDENT_AVATARS.some(avatar => avatar.id === value);
}
// Only update the confirmed account's presentation, never its identity or drafts.
export function updateStudentSessionAvatar(session,profile) {
  const user=session?.user;
  if(!session?.authenticated||user?.role!=='eleve'||user.id!==profile?.userId||user.schoolId!==profile?.schoolId||!isStudentAvatar(profile?.avatar)||user.avatar===profile.avatar)return session;
  return {...session,user:{...user,avatar:profile.avatar}};
}
// An in-flight session read may have started before the avatar write was confirmed.
export function mergeStudentSessionRead(incoming,current,readRevision,currentRevision) {
  if(readRevision===currentRevision||!current?.authenticated||current.user?.role!=='eleve')return incoming;
  return updateStudentSessionAvatar(incoming,{userId:current.user.id,schoolId:current.user.schoolId,avatar:current.user.avatar});
}
