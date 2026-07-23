import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request) {
  try {
    const { word, context } = await request.json();
    if (!word) return NextResponse.json({ error: "Missing word" }, { status: 400 });

    const result = {
      word,
      pos: "",
      ipa: "",
      meaning: "",
      engMeaning: "",
      example: "",
      translatedExample: "",
      collocations: "",
      topic: "General",
    };

    // 1. Lấy thông tin cơ bản từ Free Dictionary API
    try {
      const cleanWord = word.replace(/\s*\([^)]*\)\s*/g, '').trim();
      const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
      if (dictRes.ok) {
        const data = await dictRes.json();
        const entry = data[0];
        
        let ipa = entry.phonetic || "";
        if (entry.phonetics && entry.phonetics.length > 0) {
          const uk = entry.phonetics.find(p => p.audio && p.audio.includes('-uk'));
          const us = entry.phonetics.find(p => p.audio && p.audio.includes('-us'));
          const any = entry.phonetics.find(p => p.text);
          if (uk && uk.text) ipa = uk.text;
          else if (us && us.text) ipa = us.text;
          else if (any) ipa = any.text;
        }
        result.ipa = ipa;

        if (entry.meanings && entry.meanings.length > 0) {
          result.pos = entry.meanings[0].partOfSpeech;
          const def = entry.meanings[0].definitions[0];
          if (def) {
            if (def.definition) result.engMeaning = def.definition;
            if (def.example) result.example = def.example;
          }
        }
      }
    } catch (err) {
      console.log("Dictionary API error:", err);
    }

    // 2. Lấy Topic, Collocations và Nghĩa Tiếng Việt bằng Gemini AI
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "") {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const ctx = context ? `(ngữ cảnh từ bài đọc IELTS: "${context}")` : "";
        
        const validTopics = [
          "Appearance", "Personality", "Family", "Food", "Health", "Sports", 
          "Education", "Jobs", "Technology", "Environment", "Travel", 
          "Transportation", "Crime", "Economy", "Business", "Science", 
          "Biology", "Genetics", "Psychology", "Medicine", "Animals", 
          "Agriculture", "History", "Culture", "Architecture", "Geography", 
          "Weather", "Space", "Government", "Media", "Other"
        ];

        const prompt = `Bạn là chuyên gia IELTS.
Phân tích từ vựng tiếng Anh sau: "${word}" ${ctx}.
Trả về đúng định dạng JSON sau, tuyệt đối không có markdown code block:
{
  "meaning": "nghĩa tiếng Việt (phải dựa theo ngữ cảnh trong bài đọc)",
  "collocations": "liệt kê 3-4 collocations hay gặp trong IELTS của từ này, mỗi cụm một dòng",
  "topic": "bắt buộc chọn ĐÚNG 1 trong 31 chủ đề sau, không được tự bịa chủ đề khác: ${validTopics.join(", ")}",
  ${!result.example ? `"example": "tự tạo 1 câu ví dụ tiếng Anh thật hay chứa từ này (do từ điển không có)",` : ""}
  "translatedExample": "bản dịch tiếng Việt của câu ví dụ: ${result.example || "câu bạn vừa tạo"}"
}`;

        // Bước 1: Tự động dò danh sách Model mà API Key này được phép dùng
        const key = process.env.GEMINI_API_KEY.trim();
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const listData = await listRes.json();
        if (!listData.models) {
             throw new Error("Lỗi xác thực API Key: " + JSON.stringify(listData));
        }

        // Lọc các model có hỗ trợ generateContent
        const allowedModels = listData.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"));
        if (allowedModels.length === 0) throw new Error("Tài khoản của bạn không có model nào hỗ trợ tạo văn bản.");

        // Ưu tiên chọn model gemini-1.5-flash, rồi đến 2.0-flash, rồi gemini-1.0-pro
        let chosenModel = allowedModels.find(m => m.name.includes("gemini-1.5-flash"));
        if (!chosenModel) chosenModel = allowedModels.find(m => m.name.includes("gemini-2.0-flash"));
        if (!chosenModel) chosenModel = allowedModels.find(m => m.name.includes("gemini-1.0-pro"));
        if (!chosenModel) chosenModel = allowedModels[0]; // Bí quá thì lấy đại model đầu tiên

        // Bước 2: Gọi trực tiếp HTTP tới Google API (bỏ qua thư viện để tránh lỗi phiên bản)
        const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${chosenModel.name}:generateContent?key=${key}`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" }
           })
        });
        
        const apiData = await apiRes.json();
        if (apiData.error) {
           throw new Error(`[Lỗi Google ${apiData.error.code} - ${chosenModel.name}] ${apiData.error.message}`);
        }

        let text = apiData.candidates[0].content.parts[0].text;
        
        // Remove markdown block if Gemini still returns it
        if (text.startsWith("```json")) {
           text = text.replace(/^```json\n?/, "");
           text = text.replace(/\n?```$/, "");
        } else if (text.startsWith("```")) {
           text = text.replace(/^```\n?/, "");
           text = text.replace(/\n?```$/, "");
        }
        
        const aiData = JSON.parse(text);
        
        if (aiData.meaning) result.meaning = aiData.meaning;
        if (aiData.collocations) result.collocations = aiData.collocations;
        if (aiData.topic) result.topic = aiData.topic;
        if (aiData.example) result.example = aiData.example;
        if (aiData.translatedExample) result.translatedExample = aiData.translatedExample;

      } catch (err) {
        console.log("Gemini API error:", err);
        result.collocations = "⚠️ Lỗi AI: " + err.message;
        result.topic = "Error";
      }
    } else {
       // Nếu không có API key thì nhắc nhở
       result.collocations = "(Cần cấu hình GEMINI_API_KEY để dùng AI)";
       result.topic = "Chưa phân loại";
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
