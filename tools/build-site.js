const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const siteDir = path.join(root, "site");

const docs = [
  { path: "questions.md", title: "Curated Programming PYQs", group: "Coding", track: "Programming PYQs" },
  { path: "materials/coding-questions-50.md", title: "50 Coding Questions", group: "Coding", track: "Code Library" },
  { path: "materials/dsa-patterns.md", title: "DSA Patterns", group: "Coding", track: "DSA Patterns" },
  { path: "materials/hr-questions.md", title: "HR Questions", group: "Interview", track: "HR" },
  { path: "materials/pyq-300.md", title: "300 Aptitude PYQs", group: "Aptitude", track: "Aptitude Bank" },
  { path: "materials/solved-paper-2024-morning.md", title: "Solved Paper 2024 Morning", group: "Previous Papers", track: "Solved Paper" },
  ...Array.from({ length: 10 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      path: `materials/previous-papers/paper-${number}.md`,
      title: `Previous Paper ${number}`,
      group: "Previous Papers",
      track: "Previous Paper",
    };
  }),
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getHeadingText(line) {
  return line.replace(/^#{1,6}\s+/, "").trim();
}

function isQuestionHeading(line) {
  return (
    /^##\s+Q\d+[\s.:-]/i.test(line) ||
    /^##\s+\d+\.\s+/.test(line) ||
    /^###\s+Question\s+\d+/i.test(line) ||
    /^###\s+\d+\.\s+/.test(line)
  );
}

function sectionForLine(line, currentSection) {
  if (/^##\s+(SECTION\s+\d+|Numerical Ability|Verbal Ability|Reasoning Ability|Logical Reasoning|Advanced Quantitative Aptitude|Programming Logic|Coding Ability|Pattern\s+\d+)/i.test(line)) {
    return getHeadingText(line);
  }
  return currentSection;
}

function normalizeText(value) {
  if (!value) return "";
  let clean = value
    .replace(/â€”/g, "—")
    .replace(/â€“/g, "–")
    .replace(/â†’/g, "→")
    .replace(/âœ“/g, "✓")
    .replace(/â‚¹/g, "₹")
    .replace(/Ã—/g, "×")
    .replace(/Â¼/g, "1/4")
    .replace(/Â½/g, "1/2")
    .replace(/â…“/g, "1/3")
    .replace(/â…•/g, "1/5")
    .replace(/â€¦/g, "...");

  const unicodeFractionMap = {
    "¼": "1/4", "½": "1/2", "¾": "3/4",
    "⅓": "1/3", "⅔": "2/3",
    "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5",
    "⅙": "1/6", "⅚": "5/6",
    "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8"
  };
  for (const [uni, slash] of Object.entries(unicodeFractionMap)) {
    clean = clean.split(uni).join(slash);
  }

  return clean
    .replace(/\\tfrac/g, "\\frac")
    .replace(/\s+$/gm, "");
}

function plainText(markdown) {
  const cleanMarkdown = (markdown || "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*-\s+((?:[A-D]|\d+)\.?\s+.+)$/i.test(line))
    .join("\n");

  return normalizeText(cleanMarkdown)
    .replace(/```[\s\S]*?```/g, " code sample ")
    .replace(/\$+[^$]*\$+/g, " formula ")
    .replace(/[#*_>`~-]/g, " ")
    .replace(/\b(Solution|Answer)\s*:.*/gi, "")
    .replace(/✓/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitEntryMarkdown(markdown) {
  const lines = normalizeText(markdown).split(/\r?\n/);
  const question = [];
  const answer = [];
  const solution = [];
  let mode = "question";

  for (const line of lines) {
    if (/^\s*\*\*(Answer|Correct Answer)\s*:/i.test(line) || /^\s*Answer\s*:/i.test(line)) {
      mode = "answer";
      answer.push(line.replace(/✓/g, ""));
      continue;
    }
    if (/^\s*\*\*Solution\s*:/i.test(line) || /^\s*Solution\s*:/i.test(line) || /^\s*##+\s*Solution/i.test(line)) {
      mode = "solution";
      solution.push(line.replace(/✓/g, ""));
      continue;
    }
    if (mode === "answer") answer.push(line.replace(/✓/g, ""));
    else if (mode === "solution") solution.push(line.replace(/✓/g, ""));
    else question.push(line.replace(/✓/g, ""));
  }

  return {
    questionMarkdown: question.join("\n").trim(),
    answerMarkdown: answer.join("\n").trim(),
    solutionMarkdown: solution.join("\n").trim(),
  };
}

function sanitizeQuestionMarkdown(rawMarkdown, kind = "") {
  if (!rawMarkdown) return "";

  // Split by code blocks so we never touch math/exponents inside code code samples
  const parts = rawMarkdown.split(/(```[\s\S]*?```)/g);
  
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith("```")) {
      continue;
    }

    let text = parts[i];

    // 1. Replace escaped asterisks with normal asterisks (e.g. \* -> *)
    text = text.replace(/\\\*/g, "*");

    // 2. Convert base**exp or base\*\*exp to base^exp (using horizontal space only)
    text = text.replace(/(?<![a-zA-Z0-9_])([a-zA-Z0-9α-ωΑ-Ω\u0370-\u03FF]{1,3}|\([^\)]+\))[ \t]*\*\*[ \t]*([a-zA-Z0-9\-\+]+)/g, "$1^$2");

    // 3. Convert digit fractions like 120/2 or 5/18 to LaTeX \frac so they render beautifully
    text = text.replace(/(?<![\$\w])(\d+)\/(\d+)(?![\$\w])/g, (_, top, bottom) => {
      return `$\\frac{${top}}{${bottom}}$`;
    });

    // 4. Wrap inline math in LaTeX delimiters $...$
    // Exponents: base^exp -> $base^{exp}$
    text = text.replace(/(?<![\$\w])([a-zA-Z0-9α-ωΑ-Ω\u0370-\u03FF\.\_]+|\([^\)]+\))\^(\{([^\}]+)\}|\(([^\)]+)\)|-?[a-zA-Z0-9α-ωΑ-Ω\u0370-\u03FF]+)/g, (match, base, fullExp, curlyExp, parenExp) => {
      const exp = curlyExp || parenExp || fullExp;
      return `$${base}^{${exp}}$`;
    });

    // Inequalities & comparisons (using horizontal space only):
    // e.g. 1 <= N <= 10^5 -> $1 \le N \le 10^5$ or 1 <= a[i] <= 10^3
    text = text.replace(/(?<![\$\w])(\d+[ \t]*<=[ \t]*[a-zA-Z0-9\[\]_]+[ \t]*<=[ \t]*\$?[a-zA-Z0-9\^{}\$\[\]]+)/g, (match) => {
      const cleanMath = match.replace(/<=/g, "\\le ").replace(/\$/g, "");
      return `$${cleanMath}$`;
    });

    // Single comparisons like 1<=n, a[i]<=10, or sum<=10^3
    text = text.replace(/(?<![\$\w])([a-zA-Z0-9\[\]_]+[ \t]*<=[ \t]*\$?[a-zA-Z0-9\^{}\$\[\]]+)/g, (match) => {
      const cleanMath = match.replace(/<=/g, "\\le ").replace(/\$/g, "");
      return `$${cleanMath}$`;
    });

    // Clean up duplicate dollars if any
    text = text.replace(/\$\$+/g, "$$");

    // 5. Headers formatting for coding questions (using horizontal space only)
    if (kind === "code") {
      // Remove Hint section completely from coding questions
      text = text.replace(/^[ \t]*\*\*Hint\*\*[\s\S]*$/gim, "");

      text = text
        .replace(/^[ \t]*\*\*Problem\*\*[ \t]*$/gim, "### Problem Description")
        .replace(/^[ \t]*\*\*Constraints\*\*[ \t]*$/gim, "### Constraints")
        .replace(/^[ \t]*\*\*Sample Input\*\*[ \t]*$/gim, "### Sample Input")
        .replace(/^[ \t]*\*\*Sample Output\*\*[ \t]*$/gim, "### Sample Output")
        .replace(/^[ \t]*\*\*Explanation\*\*[ \t]*$/gim, "### Explanation");

      // 6. Remove redundant INVALID/VALID input example text in coding questions
      text = text.replace(/Example of (?:INVALID|VALID) input[\s\S]*?(?=\n\n|\n[A-Z]|\*\*|###|$)/gi, "");
    }

    parts[i] = text;
  }

  return parts.join("");
}

function stripOptions(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => !/^\s*-\s+(?:[A-D]|\d+)\.?\s*.*$/i.test(line))
    .join("\n")
    .trim();
}

function extractOptions(markdown, kind = "") {
  return normalizeText(markdown)
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s+((?:[A-D]|\d+)\.?\s*.*)$/i))
    .filter(Boolean)
    .map((match) => {
      const rawText = match[1].replace(/✓/g, "").trim();
      const label = match[1].match(/^\s*([A-D\d]+)/i)?.[1] || "";
      const cleanText = rawText.replace(/^[A-D\d]\b(?:\.|\s)\s*/i, "").trim();
      const finalOptionText = cleanText || `Option ${label.toUpperCase()}`;
      return {
        text: sanitizeQuestionMarkdown(finalOptionText, kind),
        wasMarked: /✓/.test(match[1]),
      };
    });
}

function detectKind(doc, markdown) {
  if (/```(java|python|cpp|c\+\+|c)\b/i.test(markdown) || doc.group === "Coding") return "code";
  if (extractOptions(markdown).length >= 2) return "mcq";
  if (doc.group === "Interview") return "interview";
  return "question";
}

function extractEntries(markdown, doc) {
  const normalized = normalizeText(markdown);
  const lines = normalized.split(/\r?\n/);
  const entries = [];
  let currentSection = doc.track;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    currentSection = sectionForLine(line, currentSection);
    if (!isQuestionHeading(line)) continue;

    const level = line.startsWith("###") ? "###" : "##";
    const start = i;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].startsWith(level + " ")) {
        end = j;
        break;
      }
      if (level === "###" && lines[j].startsWith("## ")) {
        end = j;
        break;
      }
    }

    // Slice from start + 1 to omit the raw heading line from the card body content
    const raw = lines.slice(start + 1, end).join("\n").trim();
    const split = splitEntryMarkdown(raw);
    const kind = detectKind(doc, raw);
    const options = extractOptions(raw, kind);

    const titleRaw = getHeadingText(line).replace(/■/g, "").replace(/\s+/g, " ").trim();
    let title = titleRaw;
    let difficulty = "";
    let isVerified = false;

    if (title.includes("[Easy]")) {
      difficulty = "Easy";
      title = title.replace("[Easy]", "");
    } else if (title.includes("[Medium]")) {
      difficulty = "Medium";
      title = title.replace("[Medium]", "");
    } else if (title.includes("[Hard]")) {
      difficulty = "Hard";
      title = title.replace("[Hard]", "");
    }

    if (title.includes("VERIFIED PYQ")) {
      isVerified = true;
      title = title.replace("VERIFIED PYQ", "");
    }

    title = title.replace(/\s*-\s*$/, "").trim();

    let rawQuestion = split.questionMarkdown || raw;
    if (kind === "mcq") {
      rawQuestion = stripOptions(rawQuestion);
    }
    const questionMarkdown = sanitizeQuestionMarkdown(rawQuestion, kind);
    const answerMarkdown = sanitizeQuestionMarkdown(split.answerMarkdown, kind);
    const solutionMarkdown = sanitizeQuestionMarkdown(split.solutionMarkdown, kind);
    const searchable = `${title} ${currentSection} ${doc.title} ${raw}`.toLowerCase();

    entries.push({
      id: `${slugify(doc.path)}-${entries.length + 1}`,
      number: entries.length + 1,
      title,
      difficulty,
      verified: isVerified,
      section: currentSection,
      docPath: doc.path,
      docTitle: doc.title,
      group: doc.group,
      track: doc.track,
      kind,
      options,
      excerpt: plainText(questionMarkdown || raw).slice(0, 230),
      questionMarkdown,
      answerMarkdown,
      solutionMarkdown,
      markdown: raw,
      searchable,
    });
  }

  return entries;
}

function build() {
  const documents = docs.map((doc) => {
    const absolute = path.join(root, doc.path);
    const markdown = normalizeText(fs.readFileSync(absolute, "utf8"));
    const entries = extractEntries(markdown, doc);
    return {
      ...doc,
      id: slugify(doc.path),
      markdown,
      entries,
      stats: {
        characters: markdown.length,
        lines: markdown.split(/\r?\n/).length,
        entries: entries.length,
      },
    };
  });

  const content = {
    generatedAt: new Date().toISOString(),
    documents,
    stats: {
      documents: documents.length,
      entries: documents.reduce((sum, doc) => sum + doc.entries.length, 0),
      characters: documents.reduce((sum, doc) => sum + doc.stats.characters, 0),
    },
  };

  fs.mkdirSync(siteDir, { recursive: true });
  fs.writeFileSync(path.join(siteDir, "content.js"), `window.TCS_NQT_CONTENT = ${JSON.stringify(content)};\n`, "utf8");

  const summary = documents.map((doc) => `${doc.path}: ${doc.stats.entries} extracted entries, ${doc.stats.lines} lines`).join("\n");
  console.log(summary);
  console.log(`TOTAL: ${content.stats.entries} extracted entries across ${content.stats.documents} documents`);
}

build();
