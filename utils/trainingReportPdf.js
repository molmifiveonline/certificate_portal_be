const pdfmake = require("pdfmake");
const path = require("path");

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
  return date.toLocaleDateString("en-GB"); // DD/MM/YYYY
};

const generateTrainingReportPdf = async (course, scores, trainer) => {
  const docDefinition = {
    pageMargins: [40, 40, 40, 60],
    defaultStyle: {
      font: "Helvetica",
      fontSize: 10,
      color: "#334155",
    },
    content: [
      // Header Section
      {
        columns: [
          {
            text: "TRAINING REPORT",
            style: "mainHeader",
          },
          {
            text: `Generated on: ${formatDate(new Date())}`,
            alignment: "right",
            fontSize: 9,
            color: "#64748b",
            margin: [0, 8, 0, 0],
          },
        ],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, lineColor: "#e2e8f0" }],
        margin: [0, 5, 0, 15],
      },

      // Course Info Card
      {
        fillColor: "#f8fafc",
        margin: [0, 0, 0, 20],
        table: {
          widths: ["*"],
          body: [
            [
              {
                padding: [15, 10, 15, 10],
                stack: [
                  {
                    columns: [
                      {
                        width: 100,
                        text: "Course Name:",
                        bold: true,
                      },
                      {
                        text: course.course_name || "-",
                        color: "#1e293b",
                      },
                    ],
                    margin: [0, 0, 0, 4],
                  },
                  {
                    columns: [
                      {
                        width: 100,
                        text: "Course ID:",
                        bold: true,
                      },
                      {
                        text: course.course_id || "-",
                        color: "#1e293b",
                      },
                    ],
                    margin: [0, 0, 0, 4],
                  },
                  {
                    columns: [
                      {
                        width: 100,
                        text: "Duration:",
                        bold: true,
                      },
                      {
                        text: `${formatDate(course.start_date)} to ${formatDate(course.end_date)}`,
                        color: "#1e293b",
                      },
                    ],
                    margin: [0, 0, 0, 4],
                  },
                  {
                    columns: [
                      {
                        width: 100,
                        text: "Trainer:",
                        bold: true,
                      },
                      {
                        text: trainer ? `${trainer.first_name} ${trainer.last_name}` : "-",
                        color: "#1e293b",
                      },
                    ],
                  },
                ],
              },
            ],
          ],
        },
        layout: "noBorders",
      },

      // Candidate Scores Table
      {
        text: "Candidate Performance & Assessment scores",
        style: "subHeader",
        margin: [0, 10, 0, 10],
      },
      {
        table: {
          headerRows: 1,
          widths: [25, "*", 60, 45, 45, "*"],
          body: [
            // Table Header
            [
              { text: "Sr.", style: "tableHeader" },
              { text: "Candidate Name", style: "tableHeader" },
              { text: "Emp ID", style: "tableHeader" },
              { text: "Pre Score", style: "tableHeader", alignment: "center" },
              { text: "Post Score", style: "tableHeader", alignment: "center" },
              { text: "Trainer Comment", style: "tableHeader" },
            ],
            // Table Data
            ...scores.map((s, i) => [
              { text: i + 1, alignment: "center" },
              { text: s.candidate_name, bold: true },
              { text: s.empId || "-" },
              { text: s.pre_score !== null ? `${s.pre_score}/${s.pre_total}` : "-", alignment: "center" },
              { text: s.post_score !== null ? `${s.post_score}/${s.post_total}` : "-", alignment: "center" },
              { text: s.trainer_comment || "-", fontSize: 9 },
            ]),
          ],
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 1 : 0.5),
          vLineWidth: (i, node) => 0,
          hLineColor: (i, node) => (i === 0 || i === node.table.body.length ? "#94a3b8" : "#e2e8f0"),
          paddingLeft: (i) => 8,
          paddingRight: (i) => 8,
          paddingTop: (i) => 8,
          paddingBottom: (i) => 8,
        },
      },

      // Evaluation Section
      {
        text: "Trainer’s Evaluation / Remarks for this course",
        style: "subHeader",
        margin: [0, 30, 0, 10],
      },
      {
        stack: [
          {
            text: course.trainer_evaluation || "TRAINING IS PROGRESSING SATISFACTORILY",
            color: "#475569",
            lineHeight: 1.5,
            fontSize: 10,
          },
        ],
        margin: [10, 5, 10, 20],
      },
    ],
    styles: {
      mainHeader: {
        fontSize: 22,
        bold: true,
        color: "#1e3a8a",
      },
      subHeader: {
        fontSize: 12,
        bold: true,
        color: "#1e293b",
        textTransform: "uppercase",
      },
      tableHeader: {
        bold: true,
        fontSize: 10,
        color: "#475569",
        fillColor: "#f1f5f9",
      },
    },
    footer: (currentPage, pageCount) => {
      return {
        columns: [
          {
            text: `Page ${currentPage} of ${pageCount}`,
            alignment: "center",
            fontSize: 8,
            color: "#94a3b8",
          },
        ],
        margin: [0, 20, 0, 0],
      };
    },
  };

  const pdfDoc = pdfmake.createPdf(docDefinition);
  return await pdfDoc.getBuffer();
};

module.exports = { generateTrainingReportPdf };
