/** Correct legacy alumni records that placed the sample job title in Company. */
export function getAlumniEmployment(profile = {}) {
  const designation = String(profile.designation || '').trim();
  const company = String(profile.company || '').trim();
  const looksLikeLegacyDesignation = !designation && company.toLowerCase() === 'software engineer';
  if (looksLikeLegacyDesignation) return { designation: company, company: '' };
  if (designation && company && designation.toLowerCase() === company.toLowerCase()) {
    return { designation, company: '' };
  }
  return { designation, company };
}
