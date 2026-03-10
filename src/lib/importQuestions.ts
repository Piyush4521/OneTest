import type { ExamQuestion, FacultyImportPreview } from "@/types/exam";

type SpreadsheetRow = Record<string, string>;

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function stringifyCell(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function mapRowToQuestion(row: SpreadsheetRow, index: number): ExamQuestion | null {
  const prompt = row.question || row.prompt || row.title;
  const optionA = row.optiona;
  const optionB = row.optionb;
  const optionC = row.optionc;
  const optionD = row.optiond;
  const correctAnswer = (row.correctanswer || row.answer || "A").toUpperCase();

  if (!prompt || !optionA || !optionB) {
    return null;
  }

  return {
    id: row.id || `q-${index + 1}`,
    section: row.section || "General",
    type: (row.type as ExamQuestion["type"]) || "single_choice",
    prompt,
    options: [
      { id: "A", label: optionA },
      { id: "B", label: optionB },
      { id: "C", label: optionC || "Option C" },
      { id: "D", label: optionD || "Option D" }
    ],
    correctOptionIds: correctAnswer
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    marks: Number(row.marks || 1),
    negativeMarks: Number(row.negativemarks || 0)
  };
}

async function parseCsv(file: File) {
  const Papa = (await import("papaparse")).default;

  return new Promise<SpreadsheetRow[]>((resolve, reject) => {
    Papa.parse<SpreadsheetRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(results.errors[0]?.message || "Could not parse CSV."));
          return;
        }

        resolve(
          results.data.map((row) =>
            Object.entries(row).reduce<SpreadsheetRow>((accumulator, [key, value]) => {
              accumulator[normalizeHeader(key)] = String(value ?? "").trim();
              return accumulator;
            }, {})
          )
        );
      },
      error: (error) => reject(error)
    });
  });
}

async function parseWorkbook(file: File) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return [];
  }

  const rawHeaderValues = worksheet.getRow(1).values as unknown;
  const headerValues = Array.isArray(rawHeaderValues) ? rawHeaderValues.slice(1) : [];

  const headers = headerValues.map((value: unknown) => normalizeHeader(value));
  const rows: SpreadsheetRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const rawRowValues = row.values as unknown;
    const rowValues = Array.isArray(rawRowValues) ? rawRowValues.slice(1) : [];
    const entry = headers.reduce<SpreadsheetRow>(
      (accumulator: SpreadsheetRow, header: string, index: number) => {
      accumulator[header] = stringifyCell(rowValues[index]);
      return accumulator;
      },
      {}
    );

    if (Object.values(entry).some(Boolean)) {
      rows.push(entry);
    }
  });

  return rows;
}

export async function importQuestionsFromFile(file: File): Promise<FacultyImportPreview> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const rows =
    extension === "xlsx" || extension === "xls" ? await parseWorkbook(file) : await parseCsv(file);

  const questions = rows
    .map((row, index) => mapRowToQuestion(row, index))
    .filter((question): question is ExamQuestion => question !== null);

  return {
    questions,
    skippedRows: rows.length - questions.length,
    sourceName: file.name
  };
}
