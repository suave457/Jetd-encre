// Only call on the local library branch. An explicit withdrawal overrides legacy codes.
export function libraryGate(manual,school){
  return `COALESCE((SELECT la.active FROM pilot_library_assignments la WHERE la.manual_id=${manual} AND la.school_id=${school}),
    CASE WHEN COALESCE((SELECT ld.assignment_mode FROM pilot_library_documents ld WHERE ld.manual_id=${manual}),'legacy')='explicit' THEN 0 ELSE 1 END)=1`;
}
