// Helpers shared by the Alumni, Student and Faculty directories.

const DEPARTMENT_FULL_NAMES = {
  CSE: 'Department of Computer Science and Engineering',
  EEE: 'Department of Electrical and Electronic Engineering',
  CE: 'Department of Civil Engineering',
  ME: 'Department of Mechanical Engineering',
  IPE: 'Department of Industrial and Production Engineering',
  TE: 'Department of Textile Engineering',
  ARCH: 'Department of Architecture',
  BBA: 'Department of Business Administration',
};

export function getDepartmentLabel(value) {
  const department = String(value || '').trim();
  if (!department) return 'Department not specified';

  const nameOrCode = department.replace(/^department\s+of\s+/i, '').trim();
  return DEPARTMENT_FULL_NAMES[nameOrCode.toUpperCase()] || `Department of ${nameOrCode}`;
}

export function getMemberInitials(member) {
  if (member.initials) return member.initials;
  const initials = String(member.name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || '?';
}
