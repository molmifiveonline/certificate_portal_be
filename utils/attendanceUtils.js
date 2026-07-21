/**
 * Utility function to determine if a candidate is absent in a course or is an observer.
 * @param {Object} candidate - Candidate record with is_observer, is_present, absent_reasons, status, status_pool
 * @returns {boolean} true if observer or absent in course, false otherwise
 */
function isCandidateAbsent(candidate) {
  if (!candidate) return false;

  // 1. Observers are not regular participants for assessments/certificates
  if (candidate.is_observer || candidate.is_observer === 1 || candidate.is_observer === "1") {
    return true;
  }

  // 2. Explicit status checks
  if (candidate.status === "Absent" || candidate.status_pool === "Absent") {
    return true;
  }

  // 3. Attendance log checks
  const presentDates = candidate.is_present
    ? String(candidate.is_present).split(",").filter(Boolean)
    : [];

  let absentKeys = [];
  if (candidate.absent_reasons) {
    try {
      const parsed =
        typeof candidate.absent_reasons === "string"
          ? JSON.parse(candidate.absent_reasons)
          : candidate.absent_reasons;
      if (parsed && typeof parsed === "object") {
        absentKeys = Object.keys(parsed);
      }
    } catch (e) {
      // ignore JSON parse errors
    }
  }

  // Candidate is absent if 0 present dates recorded AND 1 or more absent reasons logged
  if (presentDates.length === 0 && absentKeys.length > 0) {
    return true;
  }

  return false;
}

module.exports = {
  isCandidateAbsent,
};
