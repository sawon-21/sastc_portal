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
          model: "gemini-3.6-flash",
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

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});
