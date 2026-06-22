const archive = window.TCS_NQT_CONTENT;
const allEntries = archive.documents.flatMap((doc) => doc.entries);

const state = {
  query: "",
  group: "All",
  documentId: "All",
  difficulty: "All",
  expanded: new Set(),
  solved: new Set(JSON.parse(localStorage.getItem("nqt-solved") || "[]")),
};

const groups = ["All", "Aptitude", "Coding", "Previous Papers", "Interview"];
const difficulties = ["All", "Easy", "Medium", "Hard"];

const statsGrid = document.querySelector("#statsGrid");
const filterList = document.querySelector("#filterList");
const difficultyFilterList = document.querySelector("#difficultyFilterList");
const documentStrip = document.querySelector("#documentStrip");
const entryList = document.querySelector("#entryList");
const searchInput = document.querySelector("#searchInput");
const resultMeta = document.querySelector("#resultMeta");
const viewTitle = document.querySelector("#viewTitle");
const reader = document.querySelector("#reader");
const readerBody = document.querySelector("#readerBody");
const readerMeta = document.querySelector("#readerMeta");
const openDocument = document.querySelector("#openDocument");

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function triggerMathRendering(element) {
  if (typeof renderMathInElement === "function") {
    renderMathInElement(element, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true }
      ],
      throwOnError: false
    });
  }
}

function normalizeMathSource(value = "") {
  return value;
}

function renderMath(value = "") {
  return escapeHtml(value);
}

function inlineMarkdown(value = "") {
  return renderMath(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function codeLanguageName(lang) {
  const clean = (lang || "text").toLowerCase();
  if (clean === "cpp" || clean === "c++") return "C++";
  if (clean === "py") return "Python";
  if (clean === "java") return "Java";
  if (clean === "c") return "C";
  return clean.toUpperCase();
}

function highlightCode(code, lang) {
  let html = escapeHtml(code);
  const language = (lang || "").toLowerCase();
  const keywords = {
    java: /\b(class|public|static|void|int|long|double|float|boolean|if|else|for|while|return|new|import|true|false|String|Scanner|System|Math)\b/g,
    cpp: /\b(include|using|namespace|std|int|long|double|float|bool|if|else|for|while|return|vector|string|unordered_map|map|cout|cin|true|false)\b/g,
    c: /\b(include|int|long|double|float|char|if|else|for|while|return|printf|scanf|void|struct)\b/g,
    python: /\b(def|return|if|elif|else|for|while|in|not|and|or|True|False|None|import|from|range|len|enumerate)\b/g,
  };
  const key = language === "c++" ? "cpp" : language;
  if (keywords[key]) html = html.replace(keywords[key], '<span class="tok-keyword">$1</span>');
  html = html.replace(/(&quot;.*?&quot;|'.*?')/g, '<span class="tok-string">$1</span>');
  html = html.replace(/\b(\d+)\b/g, '<span class="tok-number">$1</span>');
  return html;
}

function markdownToHtml(markdown, options = {}) {
  const lines = (markdown || "").split(/\r?\n/);
  const html = [];
  let inCode = false;
  let codeLang = "";
  let codeLines = [];
  let listItems = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    html.push(`<ul class="rich-list">${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  const flushCode = () => {
    const id = `code-${Math.random().toString(36).slice(2)}`;
    const raw = escapeHtml(codeLines.join("\n"));
    const isText = !codeLang || codeLang.toLowerCase() === "text";
    html.push(`
      <figure class="code-block ${isText ? "code-block--text" : ""}" data-code-id="${id}">
        <figcaption><span>${codeLanguageName(codeLang)}</span><button class="copy-code" type="button" data-copy-code="${id}">Copy Code</button></figcaption>
        <pre><code id="${id}" class="language-${escapeHtml(codeLang || "text")}" data-raw="${raw}">${highlightCode(codeLines.join("\n"), codeLang)}</code></pre>
      </figure>
    `);
    codeLang = "";
    codeLines = [];
  };

  for (const line of lines) {
    const codeMatch = line.match(/^```(.*)$/);
    if (codeMatch) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
        codeLang = codeMatch[1].trim();
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (/^\s*$/.test(line)) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1].length + 1, 6);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const list = line.match(/^\s*[-*]\s+(.+)$/);
    if (list) {
      flushParagraph();
      listItems.push(list[1]);
      continue;
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      listItems.push(numbered[1]);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushParagraph();
      flushList();
      html.push("<hr />");
      continue;
    }

    paragraph.push(line.trim());
  }

  if (inCode) flushCode();
  flushParagraph();
  flushList();
  return html.join("");
}

function renderStats() {
  const codingCount = allEntries.filter((entry) => entry.group === "Coding").length;
  const aptitudeCount = allEntries.filter((entry) => entry.group === "Aptitude" || entry.group === "Previous Papers").length;
  statsGrid.innerHTML = [
    [archive.stats.entries, "Total questions"],
    [codingCount, "Coding + DSA"],
    [aptitudeCount, "Aptitude papers"],
  ]
    .map(([value, label]) => `<div class="stat-card"><strong>${String(value).toLocaleString("en-IN")}</strong><span>${label}</span></div>`)
    .join("");
}

function renderFilters() {
  filterList.innerHTML = groups
    .map((group) => {
      const active = group === state.group ? "is-active" : "";
      const count = group === "All" ? allEntries.length : allEntries.filter((entry) => entry.group === group).length;
      return `<button class="filter ${active}" type="button" data-group="${escapeHtml(group)}"><span>${escapeHtml(group)}</span><b>${count}</b></button>`;
    })
    .join("");
}

function renderDifficulties() {
  difficultyFilterList.innerHTML = difficulties
    .map((diff) => {
      const active = diff === state.difficulty ? "is-active" : "";
      const query = state.query.trim().toLowerCase();
      const count = allEntries.filter((entry) => {
        const groupMatch = state.group === "All" || entry.group === state.group;
        const doc = archive.documents.find((item) => item.path === entry.docPath);
        const docMatch = state.documentId === "All" || doc.id === state.documentId;
        const queryMatch = !query || entry.searchable.includes(query);
        const diffMatch = diff === "All" || (entry.difficulty && entry.difficulty.toLowerCase() === diff.toLowerCase());
        return groupMatch && docMatch && queryMatch && diffMatch;
      }).length;
      return `<button class="filter ${active}" type="button" data-difficulty="${escapeHtml(diff)}"><span>${escapeHtml(diff)}</span><b>${count}</b></button>`;
    })
    .join("");
}

function renderDocuments() {
  const docs = archive.documents.filter((doc) => state.group === "All" || doc.group === state.group);
  const allActive = state.documentId === "All" ? "is-active" : "";
  documentStrip.innerHTML = `<button class="doc-chip ${allActive}" type="button" data-doc="All">All sources</button>` +
    docs
      .map((doc) => {
        const active = doc.id === state.documentId ? "is-active" : "";
        return `<button class="doc-chip ${active}" type="button" data-doc="${doc.id}">${escapeHtml(doc.title)} <span>${doc.stats.entries}</span></button>`;
      })
      .join("");
}

function getVisibleEntries() {
  const query = state.query.trim().toLowerCase();
  return allEntries.filter((entry) => {
    const groupMatch = state.group === "All" || entry.group === state.group;
    const doc = archive.documents.find((item) => item.path === entry.docPath);
    const docMatch = state.documentId === "All" || doc.id === state.documentId;
    const queryMatch = !query || entry.searchable.includes(query);
    const diffMatch = state.difficulty === "All" || (entry.difficulty && entry.difficulty.toLowerCase() === state.difficulty.toLowerCase());
    return groupMatch && docMatch && queryMatch && diffMatch;
  });
}

function renderOptions(entry) {
  if (!entry.options?.length) return "";
  return `
    <div class="option-grid" aria-label="Answer choices">
      ${entry.options.map((option, index) => `<div class="option"><span>${String.fromCharCode(65 + index)}</span><p>${inlineMarkdown(option.text.replace(/^[A-D\d]\b(?:\.|\s)\s*/i, ""))}</p></div>`).join("")}
    </div>
  `;
}

function renderSolution(entry) {
  const hasSolution = entry.answerMarkdown || entry.solutionMarkdown;
  if (!hasSolution) return "";
  return `
    <details class="solution-box">
      <summary>Reveal answer and explanation</summary>
      <div class="solution-box__content">
        ${entry.answerMarkdown ? `<div class="answer-pill">${markdownToHtml(entry.answerMarkdown)}</div>` : ""}
        ${entry.solutionMarkdown ? markdownToHtml(entry.solutionMarkdown) : ""}
      </div>
    </details>
  `;
}

function renderEntries() {
  const entries = getVisibleEntries();
  const titleParts = [];
  if (state.group !== "All") titleParts.push(state.group);
  if (state.documentId !== "All") {
    const doc = archive.documents.find((item) => item.id === state.documentId);
    if (doc) titleParts.push(doc.title);
  }
  openDocument.hidden = state.documentId === "All";
  viewTitle.textContent = titleParts.length ? titleParts.join(" / ") : "All Practice";
  resultMeta.textContent = `${entries.length} shown / ${archive.stats.entries} total`;

  if (!entries.length) {
    entryList.innerHTML = `<div class="empty-state">No matching entries. Clear the search or switch collections.</div>`;
    return;
  }

  entryList.innerHTML = entries
    .map((entry, index) => {
      const open = state.expanded.has(entry.id);
      const typeLabel = entry.kind === "mcq" ? "MCQ" : entry.kind === "code" ? "Code" : entry.kind === "interview" ? "HR" : "Practice";
      const difficultyBadge = entry.difficulty ? `<span class="lc-badge lc-badge--${entry.difficulty.toLowerCase()}">${entry.difficulty}</span>` : "";
      const verifiedBadge = entry.verified ? `<span class="lc-badge lc-badge--verified">Verified PYQ</span>` : "";
      return `
        <article class="entry-card ${open ? "is-open" : ""} is-${entry.kind} ${state.solved.has(entry.id) ? "is-solved" : ""}">
          <div class="entry-card__header-row">
            <button class="entry-card__check ${state.solved.has(entry.id) ? "is-solved" : ""}" type="button" data-solve="${entry.id}" title="Mark as solved" aria-label="Mark as solved">✓</button>
            <button class="entry-card__summary" type="button" data-toggle="${entry.id}">
              <span class="entry-card__number">${String(index + 1).padStart(2, "0")}</span>
              <span class="entry-card__main">
                <span class="entry-card__kicker"><b>${escapeHtml(typeLabel)}</b> ${escapeHtml(entry.group)} / ${escapeHtml(entry.track)} / ${escapeHtml(entry.section)}</span>
                <strong>${inlineMarkdown(entry.title)} ${difficultyBadge} ${verifiedBadge}</strong>
                <em>${inlineMarkdown(entry.excerpt || "Open for the full question and practice material.")}</em>
              </span>
              <span class="entry-card__plus">${open ? "Close" : "Open"}</span>
            </button>
          </div>
          <div class="entry-card__body" ${open ? "" : "hidden"}>
            <div class="question-panel">
              <div class="markdown-body">${markdownToHtml(entry.questionMarkdown)}</div>
              ${renderOptions(entry)}
              ${renderSolution(entry)}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
  triggerMathRendering(entryList);
}

function showReader(docId) {
  const doc = archive.documents.find((item) => item.id === docId);
  if (!doc) return;
  entryList.hidden = true;
  documentStrip.hidden = true;
  reader.hidden = false;
  readerMeta.textContent = `${doc.title} / raw source / ${doc.stats.entries} extracted entries`;
  const githubLink = document.querySelector("#rawGithubLink");
  if (githubLink) {
    githubLink.href = doc.path 
      ? `https://github.com/Arjunpolen/TCS-NQT-PYQ-QUESTIONS/blob/main/${doc.path}`
      : `https://github.com/Arjunpolen/TCS-NQT-PYQ-QUESTIONS/tree/main`;
  }
  readerBody.innerHTML = markdownToHtml(doc.markdown);
  triggerMathRendering(readerBody);
  const readerEl = document.querySelector("#reader");
  if (readerEl) {
    window.scrollTo({ top: readerEl.offsetTop - 16, behavior: "smooth" });
  }
}

function hideReader() {
  reader.hidden = true;
  entryList.hidden = false;
  documentStrip.hidden = false;
}

function renderProgress() {
  const total = allEntries.length;
  const solved = state.solved.size;
  const percent = total > 0 ? Math.round((solved / total) * 100) : 0;
  const progressContainer = document.querySelector("#progressContainer");
  if (progressContainer) {
    progressContainer.innerHTML = `
      <div class="progress-header">
        <span>Practice Progress</span>
        <span>${solved} / ${total} Solved (${percent}%)</span>
      </div>
      <div class="progress-track">
        <div class="progress-bar" style="width: ${percent}%;"></div>
      </div>
    `;
  }
}

function rerender() {
  hideReader();
  renderFilters();
  renderDifficulties();
  renderDocuments();
  renderEntries();
  renderProgress();
}

renderStats();
rerender();

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderDifficulties();
  renderEntries();
});

filterList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-group]");
  if (!button) return;
  state.group = button.dataset.group;
  state.documentId = "All";
  state.difficulty = "All";
  state.expanded.clear();
  rerender();
});

difficultyFilterList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-difficulty]");
  if (!button) return;
  state.difficulty = button.dataset.difficulty;
  state.expanded.clear();
  rerender();
});

documentStrip.addEventListener("click", (event) => {
  const button = event.target.closest("[data-doc]");
  if (!button) return;
  state.documentId = button.dataset.doc;
  state.expanded.clear();
  renderDocuments();
  renderEntries();
});

entryList.addEventListener("click", async (event) => {
  const solve = event.target.closest("[data-solve]");
  if (solve) {
    const id = solve.dataset.solve;
    if (state.solved.has(id)) {
      state.solved.delete(id);
    } else {
      state.solved.add(id);
    }
    localStorage.setItem("nqt-solved", JSON.stringify(Array.from(state.solved)));
    
    const card = solve.closest(".entry-card");
    if (card) card.classList.toggle("is-solved", state.solved.has(id));
    solve.classList.toggle("is-solved", state.solved.has(id));
    
    renderProgress();
    renderFilters();
    renderDifficulties();
    return;
  }

  const copy = event.target.closest("[data-copy-code]");
  if (copy) {
    const code = document.getElementById(copy.dataset.copyCode);
    const text = code?.dataset.raw || code?.textContent || "";
    await navigator.clipboard.writeText(text);
    copy.textContent = "Copied";
    setTimeout(() => (copy.textContent = "Copy Code"), 1300);
    return;
  }

  const button = event.target.closest("[data-toggle]");
  if (!button) return;
  const id = button.dataset.toggle;
  if (state.expanded.has(id)) state.expanded.delete(id);
  else state.expanded.add(id);
  renderEntries();
});

document.querySelector("#backToEntries").addEventListener("click", hideReader);
openDocument.addEventListener("click", () => showReader(state.documentId));

/* ── Dark Mode Toggle ── */
const darkToggle = document.querySelector("#darkModeToggle");
function applyDarkMode(isDark) {
  document.documentElement.classList.toggle("dark", isDark);
  darkToggle.innerHTML = isDark ? "<span>☀</span> Light Mode" : "<span>☾</span> Dark Mode";
  darkToggle.title = isDark ? "Switch to light mode" : "Switch to dark mode";
  localStorage.setItem("nqt-dark", isDark ? "1" : "0");
}
// Initialize from saved preference
applyDarkMode(localStorage.getItem("nqt-dark") === "1");
darkToggle.addEventListener("click", () => {
  applyDarkMode(!document.documentElement.classList.contains("dark"));
});

