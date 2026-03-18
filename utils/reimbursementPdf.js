const fs = require("fs");
const path = require("path");
const pdfmake = require("pdfmake");

const outputDir = path.join(__dirname, "..", "uploads", "reimbursements", "pdfs");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

pdfmake.setFonts(fonts);

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB");
};

const buildDocDefinition = (reimbursement) => ({
  pageMargins: [30, 30, 30, 30],
  defaultStyle: {
    font: "Helvetica",
    fontSize: 10,
  },
  content: [
    { text: "Reimbursement Approval", style: "header" },
    {
      columns: [
        [
          { text: `Claim No: ${reimbursement.claim_number || "-"}` },
          { text: `Candidate: ${reimbursement.candidate_name || "-"}` },
          { text: `Email: ${reimbursement.candidate_email || "-"}` },
        ],
        [
          { text: `Course: ${reimbursement.active_course_name || "-"}` },
          { text: `Claim Date: ${formatDate(reimbursement.claim_date)}` },
          { text: `Approved At: ${formatDate(new Date())}` },
        ],
      ],
      columnGap: 20,
      margin: [0, 0, 0, 18],
    },
    {
      table: {
        widths: [160, "*"],
        body: [
          ["Expense Category", reimbursement.expense_category || "-"],
          ["Expense Description", reimbursement.expense_description || "-"],
          ["Amount", reimbursement.amount != null ? String(reimbursement.amount) : "-"],
          ["Payment Mode", reimbursement.payment_mode || "-"],
          ["Account Holder", reimbursement.bank_account_holder_name || "-"],
          ["Bank Name", reimbursement.bank_name || "-"],
          ["Account Number", reimbursement.account_number || "-"],
          ["IFSC Code", reimbursement.ifsc_code || "-"],
          ["Candidate Notes", reimbursement.candidate_notes || "-"],
          ["Admin Remarks", reimbursement.admin_remarks || "-"],
        ],
      },
      layout: "lightHorizontalLines",
    },
  ],
  styles: {
    header: {
      fontSize: 18,
      bold: true,
      margin: [0, 0, 0, 16],
    },
  },
});

const generateReimbursementPdf = async (reimbursement) => {
  const fileName = `${reimbursement.claim_number || reimbursement.id}.pdf`;
  const filePath = path.join(outputDir, fileName);
  const docDefinition = buildDocDefinition(reimbursement);
  const pdfDoc = pdfmake.createPdf(docDefinition);
  const buffer = await pdfDoc.getBuffer();
  fs.writeFileSync(filePath, buffer);

  return {
    filePath,
    fileUrl: `/uploads/reimbursements/pdfs/${fileName}`,
  };
};

module.exports = { generateReimbursementPdf };
