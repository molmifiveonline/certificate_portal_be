const CertificateDao = require("../dao/CertificateDao");

function getShortDateParts(issueDate) {
  const date = issueDate ? new Date(issueDate) : new Date();

  return {
    yy: date.toISOString().slice(2, 4),
    mm: date.toISOString().slice(5, 7),
    year: date.getFullYear(),
  };
}

function normalizeTopic(topic) {
  return (topic || "UNKNOWN")
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizeNationalityCode(value) {
  return (
    (value || "UN")
      .toString()
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 2) || "UN"
  );
}

async function generateCertificateNumber({
  type,
  topic,
  issueDate,
  trainerNationality,
  candidateNationality,
}) {
  const normalizedType = type || "Others";
  const { yy, mm, year } = getShortDateParts(issueDate);

  if (
    normalizedType === "Others" ||
    normalizedType === "DNV-ST0029" ||
    normalizedType === "DNV-ST008"
  ) {
    const normalizedTopic = normalizeTopic(topic);
    const subid = await CertificateDao.getNextSubId(normalizedTopic, year);
    const subidStr = subid.toString().padStart(4, "0");

    return {
      certificate_no: `${normalizedTopic}/${yy}${mm}/${subidStr}`,
      subid,
    };
  }

  const subid = await CertificateDao.getNextSubIdByType(normalizedType);
  const subidStr = subid.toString().padStart(4, "0");
  const trainerNation = normalizeNationalityCode(trainerNationality);
  const candidateNation = normalizeNationalityCode(candidateNationality);

  return {
    certificate_no: `MOLTC (${trainerNation})- LNG(${year})-(${candidateNation})-${subidStr}`,
    subid,
  };
}

module.exports = {
  generateCertificateNumber,
  normalizeTopic,
  normalizeNationalityCode,
};
