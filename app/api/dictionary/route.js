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

        // Xếp hạng các model ưu tiên
        const rankedModelNames = [];
        const prefer = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.0-pro", "gemini-pro"];
        for (const p of prefer) {
            const match = allowedModels.find(m => m.name.includes(p));
            if (match && !rankedModelNames.includes(match.name)) {
                rankedModelNames.push(match.name);
            }
        }
        for (const m of allowedModels) {
            if (!rankedModelNames.includes(m.name)) rankedModelNames.push(m.name);
        }

        // Bước 2: Thử từng model, nếu gặp lỗi 429 hoặc 404 thì thử model tiếp theo
        let apiData = null;
        let lastErrStr = "";
        
        for (const mName of rankedModelNames) {
           const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${mName}:generateContent?key=${key}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                 contents: [{ role: "user", parts: [{ text: prompt }] }],
                 generationConfig: mName.includes("gemini-pro") && !mName.includes("1.5") ? {} : { responseMimeType: "application/json" }
              })
           });
           
           apiData = await apiRes.json();
           if (apiData.error) {
              const code = apiData.error.code;
              lastErrStr = `[Lỗi Google ${code} - ${mName}] ${apiData.error.message}`;
              // Nếu là lỗi 429 (vượt quá giới hạn) hoặc 404 (không tìm thấy) hoặc 403 (không có quyền) hoặc 400 (model không hỗ trợ TEXT)
              if (code === 429 || code === 404 || code === 403 || code === 400) {
                  apiData = null; // xoá để vòng lặp chạy tiếp
                  continue;
              }
              // Các lỗi khác (như sai cú pháp JSON) thì văng lỗi luôn
              throw new Error(lastErrStr);
           }
           // Thành công
           break;
        }

        if (!apiData) {
            throw new Error(lastErrStr || "Tất cả các model đều bị từ chối truy cập.");
        }

        let text = apiData.candidates[0].content.parts[0].text;
        
        let jsonStr = text;
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            jsonStr = match[0];
        }
        
        let aiData;
        try {
            aiData = JSON.parse(jsonStr);
        } catch (err) {
            throw new Error("AI trả về kết quả không phải JSON hợp lệ: " + text.substring(0, 100));
        }
        
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
