require('dotenv').config();
const express = require('express');
const path = require('path');
// Global genai import
const { GoogleGenAI } = require('@google/genai');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/advisor', async (req, res) => {
  try {
    const clientKey = req.headers['x-gemini-api-key'];
    const activeKey = clientKey || process.env.GEMINI_API_KEY;

    if (!activeKey) {
      return res.status(400).json({ error: "Gemini API Key is missing. Please set it in the app's Settings menu." });
    }

    const { cgpa, termGpa, currentSemCourses, level, semester, history } = req.body;
    
    let historyContext = "";
    if (history && history.length > 0) {
      historyContext = "\nSaved Academic History (Chronological):\n" + history.map(h => `- Level ${h.level} Semester ${h.semester}: Term GPA ${h.gpa}, Credits ${h.totalCredits}`).join("\n");
    }

    const prompt = `You are an AI Academic Advisor for a student at HSTU. 
    The student has provided their current semester details (Level ${level} Semester ${semester}) AND their entire saved academic history.

    Current Semester:
    - Cumulative CGPA: ${cgpa || '0.00'}
    - Current Semester GPA: ${termGpa || '0.00'}
    - Current Semester Courses & Grades: ${JSON.stringify(currentSemCourses || [])}
    ${historyContext}
    
    Task & Guidelines:
    1. Conduct a deep and thorough analysis of all available semesters in chronological order.
    2. Analyze each semester in a separate section. For each semester:
       - **Strengths:** Analyze specific high grades and the subjects where the student excelled. What does this say about their skills?
       - **Weaknesses & Bottlenecks:** Identify low grades or struggling areas. How did these specific courses affect the term GPA?
       - **Performance Trend:** Compare this semester's performance to the previous one (if applicable). Did it drop, improve, or remain stagnant? Why?
    3. Provide actionable, strategic advice for course selection or study habits based on their specific weaknesses.
    4. After covering all individual semesters, provide an in-depth "Overall Progress & Final Verdict" section at the end. Predict their future trajectory if current habits continue and give a motivational roadmap to achieve a higher CGPA.
    
    Formatting Rules:
    - Make the analysis detailed, descriptive, and insightful. Avoid superficial one-liners.
    - Do NOT use unnecessary decorative symbols, extra hyphens, or random characters.
    - Keep the layout clean, structured, and easy to read.
    - Use standard bold headers (e.g., **Level 1 Semester 1**) and simple bullet points only.
    - Keep the language clear, highly motivating, and direct (use a natural mix of Bengali and English / Banglish).`;

    
    const ai = new GoogleGenAI({
      apiKey: activeKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    let response;
    let retries = 3;
    let delay = 1000;
    while (retries > 0) {
      try {
        response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
          contents: prompt,
          config: {
            systemInstruction: "You are an empathetic, motivating academic advisor for university students. Communicate in a mix of Bengali and English. Be structured, concise, and highly relevant."
          }
        });
        break;
      } catch (e) {
        if (e.message && (e.message.includes("503") || e.message.includes("429") || e.message.includes("UNAVAILABLE"))) {
          retries--;
          if (retries === 0) throw e;
          console.log(`API high demand/overloaded. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          throw e;
        }
      }
    }

    res.json({ text: response.text });
  } catch (error) {
    if (error.message && error.message.includes("429")) {
      console.warn("Gemini API Rate limit hit. (429)");
      return res.status(429).json({ error: "Rate limited" });
    }
    
    if (error.message && error.message.includes("API key not valid")) {
      console.error("Gemini API Error: Invalid API key provided.");
      return res.status(400).json({ error: "Invalid Gemini API Key provided. Please check your Settings." });
    }

    if (error.message && (error.message.includes("403") || error.message.includes("PERMISSION_DENIED") || error.message.includes("denied access"))) {
      console.error("Gemini API Error: Project has been denied access (403).");
      return res.status(403).json({ error: "API Key Permission Denied (403). Your project may be restricted. Please add a new API Key in Settings." });
    }
    
    if (error.message && (error.message.includes("503") || error.message.includes("UNAVAILABLE"))) {
      console.error("Gemini API Error: Service Unavailable / Overloaded (503).");
      return res.status(503).json({ error: "The AI service is currently experiencing high demand. Please try again in a few moments." });
    }
    
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Could not generate advice at this time." });
  }
});

app.get('/api/download-pdf', async (req, res) => {
  try {
    const fileUrl = req.query.url;
    const rawName = (req.query.name || 'SASTC_Document').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const filename = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;

    if (!fileUrl || !/^https?:\/\//i.test(fileUrl)) {
      return res.status(400).send('Invalid file URL');
    }

    const response = await fetch(fileUrl);
    if (!response.ok) {
      return res.redirect(fileUrl);
    }

    const contentType = response.headers.get('content-type') || 'application/pdf';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    if (req.query.url) {
      return res.redirect(req.query.url);
    }
    res.status(500).send('Failed to download file');
  }
});

// ============================================================================
// SECURE ONE-DEVICE-ONE-JOIN CAMPAIGN REGISTRY
// ============================================================================
const fs = require('fs');
const crypto = require('crypto');
const CAMPAIGN_STORE_PATH = '/tmp/sastc_campaign_device_locks.json';
const CODE_ALPHABET = 'abcde12345';

function loadServerDeviceStore() {
  try {
    if (fs.existsSync(CAMPAIGN_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(CAMPAIGN_STORE_PATH, 'utf-8'));
    }
  } catch (e) {}
  return {};
}

function saveServerDeviceStore(store) {
  try {
    fs.writeFileSync(CAMPAIGN_STORE_PATH, JSON.stringify(store), 'utf-8');
  } catch (e) {}
}

function generateServerSixCharCode() {
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

function isValidSixCharCode(code) {
  return typeof code === 'string' && /^[a-e1-5]{6}$/.test(code);
}

app.post('/api/campaign/sync', (req, res) => {
  try {
    const { deviceId, clientState } = req.body || {};
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 6) {
      return res.status(400).json({ error: 'Invalid device identifier' });
    }

    const store = loadServerDeviceStore();
    const existing = store[deviceId];

    // If device already registered on server, enforce one-time join & monotonic progress
    if (existing) {
      if (clientState && typeof clientState === 'object') {
        // Merge claimed days monotonically (once claimed on a valid date, remains claimed)
        const validDates = [
          '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04',
          '2026-11-05', '2026-11-06', '2026-11-07'
        ];
        validDates.forEach(d => {
          if (clientState.claimedDays && clientState.claimedDays[d] === true && !existing.missed) {
            existing.claimedDays[d] = true;
          }
        });

        if (clientState.joined) {
          existing.joined = true;
          existing.joinedAt = existing.joinedAt || clientState.joinedAt || new Date().toISOString();
        }

        if (clientState.missed) {
          existing.missed = true;
          existing.missedDate = existing.missedDate || clientState.missedDate;
        }

        const allSeven = validDates.every(d => existing.claimedDays[d] === true);
        if (allSeven && !existing.missed) {
          existing.finished = true;
          existing.finishedAt = existing.finishedAt || new Date().toISOString();
          if (!isValidSixCharCode(existing.rewardCode)) {
            existing.rewardCode = isValidSixCharCode(clientState.rewardCode)
              ? clientState.rewardCode
              : generateServerSixCharCode();
          }
        }
        store[deviceId] = existing;
        saveServerDeviceStore(store);
      }
      return res.json({ lockedState: existing });
    }

    // First-time registration for this device
    if (clientState && typeof clientState === 'object') {
      const validDates = [
        '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04',
        '2026-11-05', '2026-11-06', '2026-11-07'
      ];
      const claimedDays = {};
      validDates.forEach(d => {
        claimedDays[d] = Boolean(clientState.claimedDays && clientState.claimedDays[d] === true);
      });
      const allSeven = validDates.every(d => claimedDays[d] === true);
      const record = {
        deviceId,
        joined: Boolean(clientState.joined),
        joinedAt: clientState.joinedAt || (clientState.joined ? new Date().toISOString() : null),
        claimedDays,
        missed: Boolean(clientState.missed),
        missedDate: clientState.missedDate || null,
        finished: allSeven && !clientState.missed,
        finishedAt: allSeven ? (clientState.finishedAt || new Date().toISOString()) : null,
        rewardCode: allSeven
          ? (isValidSixCharCode(clientState.rewardCode) ? clientState.rewardCode : generateServerSixCharCode())
          : null
      };
      store[deviceId] = record;
      saveServerDeviceStore(store);
      return res.json({ lockedState: record });
    }

    return res.json({ lockedState: null });
  } catch (e) {
    return res.status(500).json({ error: 'Sync error' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});
