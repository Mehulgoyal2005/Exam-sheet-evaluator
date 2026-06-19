// server/utils/reportGenerator.js

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  Footer,
  PageNumber,
} = require('docx');

// ─── HELPER: Create a horizontal divider line ─────────────
// We simulate a divider by creating a paragraph with a bottom border
const dividerParagraph = () =>
  new Paragraph({
    border: {
      bottom: {
        color: 'CCCCCC',
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    spacing: { after: 200 },
  });

// ─── HELPER: Bold label + normal value on same line ───────
// Used for "Roll Number: 2021CSE045" style lines
const labelValueLine = (label, value, labelColor = '333333', valueColor = '000000') =>
  new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
        color: labelColor,
        size: 22,
      }),
      new TextRun({
        text: String(value || ''),
        color: valueColor,
        size: 22,
      }),
    ],
  });

// ─── HELPER: Colored text paragraph ──────────────────────
const coloredParagraph = (text, color, bold = false, size = 20) =>
  new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text,
        color,
        bold,
        size,
      }),
    ],
  });

// ─── MAIN EXPORT ─────────────────────────────────────────
/**
 * Generates a DOCX report for one student's evaluation.
 *
 * @param {Object} submission - Mongoose Submission document
 * @param {Array}  evaluations - Array of Evaluation documents sorted by questionNumber
 * @param {Object} exam - Mongoose Exam document
 * @returns {Promise<Buffer>} - DOCX file as a Node.js Buffer
 */
const generateStudentReport = async (submission, evaluations, exam) => {
  // ── Build document sections ────────────────────────────────────────────

  const children = [];

  // ── 1. Title ───────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: exam.title || 'Exam Report',
          bold: true,
          size: 36,
          color: '1E3A5F',
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: exam.subject || '',
          size: 24,
          color: '555555',
          italics: true,
        }),
      ],
    })
  );

  // ── 2. Student Info Section ────────────────────────────────────────────
  const examDate = exam.date
    ? new Date(exam.date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'N/A';

  children.push(labelValueLine('Roll Number', submission.rollNumber));
  children.push(
    labelValueLine(
      'Marks Obtained',
      `${submission.totalMarksAwarded} / ${submission.totalMarks}`
    )
  );
  children.push(labelValueLine('Percentage', `${submission.percentage}%`));
  children.push(labelValueLine('Exam Date', examDate));
  children.push(dividerParagraph());

  // ── 3. Question-by-question evaluations ───────────────────────────────
  // Sort by questionNumber just in case they arrive out of order
  const sortedEvaluations = [...evaluations].sort(
    (a, b) => a.questionNumber - b.questionNumber
  );

  for (const evaluation of sortedEvaluations) {
    // Question heading
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: `Question ${evaluation.questionNumber}`,
            bold: true,
            size: 26,
            color: '1E3A5F',
          }),
        ],
      })
    );

    // Marks line — bold and colored
    const marksColor =
      evaluation.marksAwarded === evaluation.maxMarks
        ? '16A34A'   // green — full marks
        : evaluation.marksAwarded === 0
        ? 'DC2626'   // red — zero marks
        : 'D97706';  // orange — partial marks

    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: 'Marks: ',
            bold: true,
            size: 22,
          }),
          new TextRun({
            text: `${evaluation.marksAwarded} / ${evaluation.maxMarks}`,
            bold: true,
            size: 22,
            color: marksColor,
          }),
        ],
      })
    );

    // Low confidence warning
    if (evaluation.isLowConfidence) {
      children.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: '⚠  Low OCR confidence — please verify this answer manually',
              color: 'B45309',
              bold: true,
              size: 20,
            }),
          ],
        })
      );
    }

    // Overridden note
    if (evaluation.isOverridden) {
      children.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: `✏  Marks manually overridden to ${evaluation.overriddenMark}`,
              color: '7C3AED',
              bold: true,
              size: 20,
            }),
          ],
        })
      );
      if (evaluation.overrideReason) {
        children.push(
          labelValueLine('Override Reason', evaluation.overrideReason, '7C3AED', '7C3AED')
        );
      }
    }

    // Student Answer
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: 'Student Answer:', bold: true, size: 22 }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        shading: {
          type: ShadingType.CLEAR,
          fill: 'F3F4F6',
        },
        children: [
          new TextRun({
            text: evaluation.studentAnswerText || 'No answer provided',
            size: 20,
            color: evaluation.studentAnswerText ? '111827' : '9CA3AF',
            italics: !evaluation.studentAnswerText,
          }),
        ],
      })
    );

    // Model Answer
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: 'Model Answer:', bold: true, size: 22, color: '1D4ED8' }),
        ],
      })
    );
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        shading: {
          type: ShadingType.CLEAR,
          fill: 'EFF6FF',
        },
        children: [
          new TextRun({
            text: evaluation.modelAnswer || '',
            size: 20,
            color: '1E3A5F',
          }),
        ],
      })
    );

    // Correct Parts — only show if not empty
    if (evaluation.correctParts && evaluation.correctParts.trim()) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: 'Correct: ', bold: true, size: 22, color: '16A34A' }),
            new TextRun({ text: evaluation.correctParts, size: 20, color: '15803D' }),
          ],
        })
      );
    }

    // Wrong Parts — only show if not empty
    if (evaluation.wrongParts && evaluation.wrongParts.trim()) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: 'Needs Improvement: ', bold: true, size: 22, color: 'DC2626' }),
            new TextRun({ text: evaluation.wrongParts, size: 20, color: 'B91C1C' }),
          ],
        })
      );
    }

    // AI Feedback
    if (evaluation.aiFeedback && evaluation.aiFeedback.trim()) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: 'AI Feedback: ', bold: true, size: 22, color: '6B7280' }),
            new TextRun({
              text: evaluation.aiFeedback,
              size: 20,
              color: '374151',
              italics: true,
            }),
          ],
        })
      );
    }

    // Divider between questions
    children.push(dividerParagraph());
  }

  // ── 4. Footer text at bottom of last page ─────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: 'Generated by EvalAI — AI Powered Answer Sheet Evaluation System',
          size: 18,
          color: '9CA3AF',
          italics: true,
        }),
      ],
    })
  );

  // ── 5. Build the Document ──────────────────────────────────────────────
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Page ',
                    size: 18,
                    color: '9CA3AF',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    color: '9CA3AF',
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 18,
                    color: '9CA3AF',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 18,
                    color: '9CA3AF',
                  }),
                ],
              }),
            ],
          }),
        },
      },
    ],
  });

  // Packer.toBuffer converts the Document object into a real .docx Buffer
  // This Buffer can be uploaded to Cloudinary or streamed directly to the browser
  const buffer = await Packer.toBuffer(doc);
  return buffer;
};

module.exports = { generateStudentReport };