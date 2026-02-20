import { GoogleGenAI, Modality } from "@google/genai";
import { DocumentSource, Message, GroundingLink } from "../types";

export interface ChatResponse {
  text: string;
  links?: GroundingLink[];
}

// Helper: Filter large content to relevant sections based on user query
// Optimized for DATA PRESERVATION: Keeps table structures and all pages if within limit
const getRelevantContext = (content: string, query: string, maxChars: number): string => {
  // 1. IF CONTENT FITS BUDGET, RETURN ALL (Do not filter anything)
  if (content.length <= maxChars) return content;

  // 2. IF CONTENT IS TOO LARGE, INTELLIGENT FILTERING
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const lines = content.split('\n');
  
  // Header Context: Keep first 20 lines (increased to cover longer headers/table definitions)
  const HEADER_LINES = 20;
  const header = lines.slice(0, HEADER_LINES);
  let currentLength = header.reduce((acc, line) => acc + line.length + 1, 0);
  
  // If header alone is too big, trim it
  if (currentLength >= maxChars) {
      return header.join('\n').substring(0, maxChars);
  }

  const body = lines.slice(HEADER_LINES);
  const remainingChars = maxChars - currentLength;

  const scored = [];
  for (let i = 0; i < body.length; i++) {
      const line = body[i];
      if (line.trim().length === 0) continue; // Skip strictly empty lines

      const lower = line.toLowerCase();
      let score = 0;
      
      // A. Keyword matching (High Priority)
      for (let j = 0; j < queryTerms.length; j++) {
          if (lower.includes(queryTerms[j])) {
              score += 10;
          }
      }

      // B. Data Density Check (Medium Priority)
      // Check for table-like structures (tabs, pipes) or high number density
      const digitCount = (line.match(/\d/g) || []).length;
      const isTableData = line.includes('\t') || line.includes('|') || (line.match(/,/g) || []).length > 3;
      
      if (isTableData || digitCount > 3) {
          // Boost score for potential data rows so they aren't lost
          score += (score === 0) ? 2 : 5; 
      } else if (score === 0) {
          // If no keywords and no data look-alike, give minimal score to maintain flow if space permits
          score = 1;
      }

      scored.push({ line, score, idx: i });
  }

  // Sort by score DESC
  scored.sort((a, b) => b.score - a.score);

  // Select lines until budget is full
  const selectedIndices = new Set<number>();
  let usedChars = 0;

  for (const item of scored) {
      if (usedChars + item.line.length + 1 > remainingChars) break;
      selectedIndices.add(item.idx);
      usedChars += item.line.length + 1;
  }

  // Reconstruct body preserving original order to maintain context flow
  const finalBody = body.filter((_, idx) => selectedIndices.has(idx));
  
  const skippedCount = body.length - finalBody.length;

  return [
      ...header,
      skippedCount > 0 ? `\n... [Đã lọc ${skippedCount} dòng ít liên quan để tối ưu bộ nhớ] ...\n` : '',
      ...finalBody
  ].join('\n');
};

export const chatWithContext = async (
  messages: Message[],
  documents: DocumentSource[],
  onStream?: (partialText: string) => void
): Promise<ChatResponse> => {
  const apiKey = process.env.GEMINI_API_KEY;
  const ZALO_LINK = "https://zalo.me/0943841155";
  
  if (!apiKey || apiKey === "undefined") {
    return { text: `Hệ thống chưa được cấu hình API Key. Liên hệ admin qua Zalo: ${ZALO_LINK}` };
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  const readyDocs = documents.filter(doc => doc.status === 'ready');
  const lastUserMessage = messages[messages.length - 1].text;

  // COST OPTIMIZATION: 400k Chars limit.
  // NOTE: This limits the "active memory" sent to AI.
  // The parser STILL reads 100% of the file. This limit only applies to what is sent in the prompt.
  const MAX_GLOBAL_CONTEXT_CHARS = 400000; 
  
  // Allocate budget per document
  const docBudget = readyDocs.length > 0 
      ? Math.floor(MAX_GLOBAL_CONTEXT_CHARS / readyDocs.length) 
      : MAX_GLOBAL_CONTEXT_CHARS;

  // Process Context
  const contextText = readyDocs
    .map(doc => {
        // If query is generic (e.g., "tóm tắt", "hết"), boost budget or relax filter logic inside getRelevantContext
        const processedContent = getRelevantContext(doc.content, lastUserMessage, docBudget);
        return `--- NGUỒN DỮ LIỆU: ${doc.name} ---\n${processedContent}`;
    })
    .join('\n\n');

  const systemInstruction = `
    BẠN LÀ: AI ĐST-QNPC, trợ lý ảo chuyên nghiệp của Đội QLĐ Sơn Tịnh và Công ty điện lực Quảng Ngãi.
    
    NGUYÊN TẮC CỐT LÕI:
    1. DỮ LIỆU LÀ VUA: Chỉ trả lời dựa trên "NGUỒN DỮ LIỆU" được cung cấp.
    2. KHÔNG BỎ SÓT: Rà soát kỹ tất cả các dòng dữ liệu, sheet, và trang trong ngữ cảnh được cung cấp.
    3. TRUNG THỰC: Nếu dữ liệu không có thông tin, hãy nói "Trong tài liệu không đề cập", đừng bịa đặt.
    4. TRÌNH BÀY: Rõ ràng, ngắn gọn, dùng gạch đầu dòng hoặc bảng nếu cần thiết. Gửi link tài liệu kèm theo cho người dùng.
    
    NGUỒN DỮ LIỆU ĐẦU VÀO (Đã được tối ưu hóa):
    ${readyDocs.length > 0 ? contextText : "Hiện chưa có dữ liệu nào được nạp."}
  `;

  // Limit History: Keep only last 6 turns (User + AI pairs)
  const relevantHistory = messages.slice(-7, -1).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  const currentMessage = messages[messages.length - 1].text;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview', 
      contents: [
        ...relevantHistory,
        { role: 'user', parts: [{ text: currentMessage }] }
      ],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.4, // Lower temperature for more factual data extraction
        // tools: [{ googleSearch: {} }] // DISABLED for cost saving
      }
    });

    let fullText = '';
    const links: GroundingLink[] = [];
    const uniqueLinks = new Set<string>();

    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        if (onStream) {
          onStream(fullText);
        }
      }

      const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        groundingChunks.forEach((c: any) => {
          if (c.web && c.web.uri && c.web.title) {
            if (!uniqueLinks.has(c.web.uri)) {
              uniqueLinks.add(c.web.uri);
              links.push({
                uri: c.web.uri,
                title: c.web.title
              });
            }
          }
        });
      }
    }

    if (!fullText) {
       fullText = `Không tìm thấy thông tin phù hợp trong dữ liệu đã nạp. Zalo hỗ trợ: ${ZALO_LINK}`;
       if (onStream) onStream(fullText);
    }

    return { text: fullText, links: links.length > 0 ? links : undefined };
  } catch (error: any) {
    console.error("Gemini Error:", error);
    let errorMsg = "Hệ thống đang bận.";
    if (error.message?.includes("API_KEY")) errorMsg = "Lỗi cấu hình API.";
    else if (error.message?.includes("token")) errorMsg = "File quá lớn, vui lòng chia nhỏ để xử lý tốt hơn.";
    else if (error.message?.includes("quota")) errorMsg = "Hệ thống quá tải, vui lòng thử lại sau 30s.";
    
    const finalMsg = `${errorMsg} (Zalo: 0943841155)`;
    if (onStream) onStream(finalMsg);
    return { text: finalMsg };
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
      throw new Error("Chưa cấu hình API Key");
  }

  // --- OPTIMIZED CLEANING FOR SPEED & QUALITY & COST ---
  
  // 1. Remove URLs first
  let cleanText = text.replace(/https?:\/\/[^\s]+/g, ' ');
  
  // 2. Remove special Markdown and symbols that confuse TTS
  cleanText = cleanText.replace(/[*#_\[\]`~>|\\@$%^&()+=]/g, ' ');

  // 3. Normalize whitespace
  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  // 4. QUOTA SAVING: Limit input text to 2000 chars (approx 30s-1min speech)
  if (cleanText.length > 2000) {
      cleanText = cleanText.substring(0, 2000);
  }

  if (!cleanText || cleanText.length < 2) return null;

  const ai = new GoogleGenAI({ apiKey: apiKey });

  try {
      const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: cleanText }] }],
          config: {
              responseModalities: [Modality.AUDIO], 
              speechConfig: {
                  voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Kore' }, 
                  },
              },
          },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return base64Audio || null;
  } catch (error: any) {
      if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota')) {
          console.warn("TTS Quota Exceeded (Skipping audio generation).");
          return null;
      }
      console.error("TTS Error:", error);
      return null;
  }
};
