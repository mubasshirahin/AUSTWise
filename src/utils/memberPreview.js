// Shared data for the member mini stats card (MemberAvatarPreview) — used by
// the Student Directory, Notice Board and every other profile icon.
import { createAwid } from './authStorage';
import { formatSemesterLabel } from './semester';
import { getDepartmentLabel } from '../features/community/directoryUtils';

/** Student ID from an @aust.edu email, the same way the profile reads it. */
export function extractStudentId(member) {
  const email = member?.email || '';
  if (email.includes('@aust.edu')) {
    const prefix = email.split('@')[0] || '';
    const id = prefix.replace(/^[a-z.]+/i, '');
    if (id) return id;
  }
  return member?.id || '';
}

/** Mini-card rows: [label, value]; empty values are hidden by the card. */
export function getMemberPreviewStats(member = {}) {
  const sem = Number(member.semester) || 0;
  let awid = member.awid || '';
  if (!awid && member.department) {
    try { awid = createAwid(member.department); } catch { awid = ''; }
  }
  return [
    ['Department', member.department ? getDepartmentLabel(member.department) : ''],
    ['AUST ID', extractStudentId(member)],
    ['AWID', awid],
    ['Semester', sem ? `Year ${formatSemesterLabel(sem)} (Semester ${sem})` : ''],
    ['Lab', member.labSection || member.section],
    ['Batch', member.batch || member.batchName || member.batchNo],
    ['Blood', member.bloodGroup],
  ];
}

/** Directory member by id, or null. */
export function findMember(members, id) {
  if (!id || !Array.isArray(members)) return null;
  return members.find((m) => m && (m.id === id || m.studentId === id)) || null;
}

/**
 * The CR/SR behind a notice: directory record merged over what the notice
 * itself stores. Null when the notice has no poster (admin notices).
 */
export function resolveNoticePoster(notice, members) {
  if (!notice?.postedByName) return null;
  const fromNotice = {
    id: notice.postedBy,
    name: notice.postedByName,
    role: notice.postedByRole,
    avatar: notice.postedByAvatar || undefined,
    section: notice.postedBySection,
    labSection: notice.postedByLabSection,
  };
  const found = findMember(members, notice.postedBy);
  if (!found) return fromNotice;
  const merged = { ...fromNotice };
  Object.entries(found).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') merged[k] = v; });
  return merged;
}
