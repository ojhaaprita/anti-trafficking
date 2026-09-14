// ---- Quick Exit (safety feature) ----
// Instantly redirects away in case someone monitoring the visitor walks in.
const QUICK_EXIT_URL = "https://www.google.com";

document.getElementById("quick-exit").addEventListener("click", () => {
  window.location.replace(QUICK_EXIT_URL);
});

// Also trigger quick exit when the user presses Escape twice quickly.
let escCount = 0;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    escCount++;
    setTimeout(() => (escCount = 0), 600);
    if (escCount >= 2) window.location.replace(QUICK_EXIT_URL);
  }
});

// ---- Smooth scroll for nav links ----
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

// ---- Active nav highlighting ----
// Works across pages: highlights an exact page match (e.g. "Project Credits"
// on credits.html) and scroll-spies same-page section links (e.g. index.html).
const navLinks = document.querySelectorAll(".nav-links a");
const currentFile = location.pathname.split("/").pop() || "index.html";

navLinks.forEach((link) => {
  if (link.getAttribute("href") === currentFile) {
    link.classList.add("active");
  }
});

const sectionNavLinks = Array.from(navLinks).filter((link) =>
  link.getAttribute("href").startsWith("#")
);

if (sectionNavLinks.length > 0 && "IntersectionObserver" in window) {
  const sections = sectionNavLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const activeHref = `#${entry.target.id}`;
          sectionNavLinks.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === activeHref);
          });
        }
      });
    },
    { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
  );

  sections.forEach((section) => sectionObserver.observe(section));
}

// ---- Report form (demo only, no backend) ----
const reportForm = document.getElementById("report-form");
if (reportForm) {
  reportForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const details = document.getElementById("details").value.trim();
    if (!details) return;
    alert(
      "Thank you. This demo form does not submit anywhere yet.\n\nFor a real tip, please call the National Human Trafficking Hotline: 1-888-373-7888."
    );
    e.target.reset();
  });
}

// ---- AI Chat Widget (Google Gemini) ----
const chatToggle = document.getElementById("chat-toggle");
const chatPanel = document.getElementById("chat-panel");
const chatClose = document.getElementById("chat-close");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

if (chatToggle) {
  chatToggle.addEventListener("click", () => {
    chatPanel.classList.toggle("hidden");
    if (!chatPanel.classList.contains("hidden") && chatMessages.children.length === 0) {
      addMessage(
        "bot",
        "Hi, I'm the Harbor Line assistant. I can share general information about human trafficking, warning signs, and support resources. How can I help?"
      );
    }
  });

  chatClose.addEventListener("click", () => {
    chatPanel.classList.add("hidden");
  });
}

const SYSTEM_PROMPT = `You are the Harbor Line Assistant, a supportive information assistant on a human anti-trafficking awareness website.
Your role:
- Provide clear, compassionate, general information about human trafficking: what it is, warning signs, how to get help, and how to support survivors.
- Always encourage anyone in immediate danger to call 911 (or their local emergency number) and mention the National Human Trafficking Hotline: 1-888-373-7888 (call) or 233733 (text), available 24/7 and confidential.
- Never ask for or store personally identifying information (full name, exact address, etc.).
- Be calm, non-judgmental, and trauma-informed in tone.
- Make clear you are an AI and not a substitute for professional help, law enforcement, or crisis counselors.
- Keep answers concise and easy to read.

Charts: when a question involves numeric data that is genuinely clearer as a chart (e.g. counts, percentages, year-over-year trends, comparisons across a few categories), include ONE fenced code block labeled "chart" containing ONLY valid JSON, in addition to your normal text answer. Format:
\`\`\`chart
{"type": "bar", "title": "Short title", "labels": ["A", "B"], "datasets": [{"label": "Series name", "data": [1, 2]}]}
\`\`\`
"type" must be one of: bar, line, pie, doughnut. Only emit this block when you have concrete numbers to plot — never invent statistics, and skip the chart entirely if you don't have real data to show.`;

let chatHistory = [];

async function sendToGemini(userText) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
    throw new Error(
      "No Gemini API key configured. Open js/config.js and paste your API key into GEMINI_API_KEY."
    );
  }

  chatHistory.push({ role: "user", parts: [{ text: userText }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: chatHistory,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const reply =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
    "Sorry, I couldn't generate a response just now.";

  chatHistory.push({ role: "model", parts: [{ text: reply }] });
  return reply;
}

// Markdown rendering for bot replies, via the marked.js library (loaded in
// index.html). Output is run through DOMPurify before use since it's set via
// innerHTML — defense-in-depth even though the source is our own AI call.
const markedRenderer = new marked.Renderer();
markedRenderer.link = (href, title, linkText) =>
  `<a href="${href}" target="_blank" rel="noopener noreferrer"${title ? ` title="${title}"` : ""}>${linkText}</a>`;

function renderMarkdown(text) {
  const rawHtml = marked.parse(text, { breaks: true, renderer: markedRenderer });
  return DOMPurify.sanitize(rawHtml, { ADD_ATTR: ["target", "rel"] });
}

// Pulls out ```chart {json} ``` blocks the model may include (see
// SYSTEM_PROMPT) so they can be rendered as real Chart.js charts instead of
// raw text. Invalid JSON is left in place as a visible code block.
function extractChartSpecs(text) {
  const specs = [];
  const cleanedText = text.replace(/```chart\s*([\s\S]*?)```/gi, (match, jsonStr) => {
    try {
      specs.push(JSON.parse(jsonStr.trim()));
      return "";
    } catch {
      return match;
    }
  });
  return { cleanedText, specs };
}

const CHART_COLORS = ["#0b5566", "#e07a3f", "#5a9c8f", "#c94f4f", "#7c6fb0", "#d4a72c"];

function renderChart(canvas, spec) {
  const type = ["bar", "line", "pie", "doughnut"].includes(spec.type) ? spec.type : "bar";
  const isSliceChart = type === "pie" || type === "doughnut";
  const labels = Array.isArray(spec.labels) ? spec.labels : [];

  const datasets = (Array.isArray(spec.datasets) ? spec.datasets : []).map((ds, i) => ({
    label: ds.label || `Series ${i + 1}`,
    data: Array.isArray(ds.data) ? ds.data : [],
    backgroundColor: isSliceChart
      ? labels.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length])
      : CHART_COLORS[i % CHART_COLORS.length],
    borderColor: isSliceChart ? "#ffffff" : CHART_COLORS[i % CHART_COLORS.length],
    borderWidth: isSliceChart ? 2 : 1,
  }));

  return new Chart(canvas.getContext("2d"), {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: !!spec.title, text: spec.title || "" },
        legend: { display: isSliceChart || datasets.length > 1 },
      },
      scales: isSliceChart ? {} : { y: { beginAtZero: true } },
    },
  });
}

// Renders a bot reply (Markdown + any chart blocks) into an existing message
// element. Shared by addMessage() and the "Thinking..." -> reply update.
function renderBotContent(container, text) {
  const { cleanedText, specs } = extractChartSpecs(text);
  container.innerHTML = renderMarkdown(cleanedText);

  specs.forEach((spec) => {
    if (typeof Chart === "undefined") return;
    const wrap = document.createElement("div");
    wrap.className = "chat-chart";
    const canvas = document.createElement("canvas");
    wrap.appendChild(canvas);
    container.appendChild(wrap);
    try {
      renderChart(canvas, spec);
    } catch {
      wrap.remove();
    }
  });
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.classList.add("msg", role);
  if (role === "bot") {
    renderBotContent(div, text);
  } else {
    div.textContent = text;
  }
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    addMessage("user", text);
    chatInput.value = "";

    const thinkingMsg = addMessage("bot", "Thinking...");

    try {
      const reply = await sendToGemini(text);
      renderBotContent(thinkingMsg, reply);
    } catch (err) {
      thinkingMsg.remove();
      addMessage("error", err.message);
    }
  });
}
