// api/summarize.js
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let text = "";

    if (req.method === "POST") {
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", chunk => data += chunk);
        req.on("end", () => resolve(JSON.parse(data)));
        req.on("error", reject);
      });
      text = body.text || "";
    } else if (req.method === "GET") {
      text = req.query.text || "";
    } else {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    if (!text) throw new Error("No text provided");

    // 限制最大长度，防止 token 爆
    text = text.slice(0, 10000);

    const isChinese = /[\u4e00-\u9fa5]/.test(text.slice(0, 200));

const prompt = isChinese
  ? `
请阅读以下技术文档，并生成结构化摘要。

输出必须包含以下三个部分，要求：
- 每个部分的标题加粗并加冒号
- 第二、第三部分的标题上方空两行，可通过添加两个 <br> 实现
- 输出 HTML 字符串，可直接在网页中渲染

目的与范围

- 用1-2句话说明文档的目的以及涵盖范围。

价值说明

- 用1-2句话说明这篇文档对读者的价值或能解决什么问题。

内容快速概览

- 用3-5条简洁的要点总结文档的主要内容，每条一行。

要求：
- 忽略图片、代码块和表格
- 只保留核心信息
- 表达简洁清晰

文档：
${text}
`
  : `
Read the following technical documentation and generate a structured summary.

The output must contain the following three sections, with these rules:
- Bold the title of each section and add a colon
- Above the titles of sections two and three, leave two blank lines, which can be achieved by adding two <br>.
- Output HTML string, can be directly rendered on a webpage

Purpose & Scope

- 1–2 sentences explaining the purpose of the document and what it covers.

Value Proposition

- 1–2 sentences explaining the value of the document and why it is useful for readers.

Quick Summary of Content

- 3–5 concise bullet points summarizing the main content, one sentence per bullet.

Requirements:
- Ignore images, code blocks, and tables
- Focus only on key information
- Keep the summary concise and clear

Document:
${text}
`;

    // 调用 Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800
          },
        }),
      }
    );

    const data = await response.json();
    let summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!summary) {
      summary = isChinese ? "AI 未能生成摘要。" : "AI could not generate a summary.";
    }

    res.status(200).json({ summary });

  } catch (err) {
    console.error("Serverless Error:", err);
    res.status(500).json({ error: err.message });
  }
};