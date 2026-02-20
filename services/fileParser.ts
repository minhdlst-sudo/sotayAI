
import { DocumentSource } from '../types';

declare const pdfjsLib: any;
declare const XLSX: any;
declare const mammoth: any;

// Configure PDF.js worker
if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
  (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

export const parsePdf = async (file: File | Blob): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Validate PDF Header
    const headerBytes = new Uint8Array(arrayBuffer.slice(0, 1024));
    let headerStr = '';
    for(let i=0; i<headerBytes.length; i++) headerStr += String.fromCharCode(headerBytes[i]);
    
    if (!headerStr.includes('%PDF-')) {
         console.warn("Header PDF không chuẩn, nhưng sẽ cố gắng đọc.");
    }

    // DISABLE STREAMING: Force full data load to ensure all pages are available
    const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        disableStream: true,
        disableAutoFetch: false
    });
    
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Add space separator to prevent word merging
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        if (pageText.trim()) {
          fullText += pageText + '\n';
        }
      } catch (pageErr) {
        console.warn(`Lỗi đọc trang ${i}:`, pageErr);
      }
    }
    
    if (!fullText.trim()) {
      return "⚠️ [CẢNH BÁO HỆ THỐNG] File PDF này là bản Scan/Ảnh hoặc không có lớp văn bản. AI không thể đọc nội dung chi tiết, chỉ ghi nhận sự tồn tại của file.";
    }

    return fullText;
  } catch (error: any) {
    console.error("PDF Parse Error:", error);
    if (error.name === 'InvalidPDFException' || error.message?.includes('Invalid PDF structure')) {
      throw new Error("Tệp PDF bị lỗi cấu trúc hoặc bị hỏng.");
    }
    throw error;
  }
};

export const parseExcel = async (file: File | Blob): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  let fullText = '';
  
  workbook.SheetNames.forEach((sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName];
    // defval: '' ensures empty cells are treated as empty strings, keeping row structure
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (json.length > 0) {
      const sheetContent = json
        .filter((row: any) => Array.isArray(row) && row.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== ''))
        .map((row: any) => (Array.isArray(row) ? row.join('\t') : String(row)))
        .join('\n');
        
      if (sheetContent.trim()) {
        fullText += `Sheet: ${sheetName}\n${sheetContent}\n\n`;
      }
    }
  });
  return fullText;
};

export const parseWord = async (file: File | Blob): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value; 
};

export const fetchGoogleSheetAsCsv = async (url: string): Promise<string> => {
  try {
    const cleanUrl = url.trim();
    const sheetIdMatch = cleanUrl.match(/[-\w]{25,}/); 
    if (!sheetIdMatch) throw new Error("Không tìm thấy ID Google Sheet hợp lệ.");
    
    const sheetId = sheetIdMatch[0];
    
    // Check for GID (Tab ID) in the URL to fetch specific sheet data
    const gidMatch = cleanUrl.match(/gid=([0-9]+)/);
    const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';

    // Add cache busting parameter + GID
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}&_t=${Date.now()}`;
    
    const response = await fetch(csvUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error(`Lỗi truy cập Sheet (Status: ${response.status}). Vui lòng kiểm tra quyền chia sẻ.`);
    }
    
    const text = await response.text();
    if (text.includes('<!DOCTYPE html>') || text.includes('goog-ms-login')) {
      throw new Error("Sheet đang ở chế độ riêng tư. Vui lòng chuyển sang 'Bất kỳ ai có liên kết'.");
    }
    
    return text;
  } catch (error: any) {
    throw error;
  }
};

export const fetchAndParseDriveFile = async (url: string): Promise<{ content: string, type: 'pdf' | 'word' | 'excel', name: string }> => {
  try {
    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!idMatch) throw new Error("Link Drive không hợp lệ.");
    const fileId = idMatch[1];

    const googleUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    
    const proxies = [
        (target: string) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
        (target: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
        (target: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}` 
    ];

    let response: Response | null = null;
    let fetchError: any = null;
    
    for (const makeProxyUrl of proxies) {
        try {
            const proxyUrl = makeProxyUrl(googleUrl);
            const res = await fetch(proxyUrl);
            if (res.ok) {
                response = res;
                break;
            }
        } catch (e) {
            console.warn("Proxy attempt failed:", e);
            fetchError = e;
        }
    }

    if (!response) {
      throw new Error(`Không thể tải file từ Google Drive. ${fetchError ? fetchError.message : "Vui lòng thử lại sau hoặc kiểm tra quyền truy cập."}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error("File tải về rỗng.");
    
    const uint8Arr = new Uint8Array(arrayBuffer.slice(0, 100)); 
    let signature = '';
    for(let i=0; i < uint8Arr.length; i++) signature += String.fromCharCode(uint8Arr[i]);
    const trimmedSig = signature.trim();

    if (trimmedSig.startsWith('<') || trimmedSig.startsWith('{') || signature.includes('<!DOCTYPE html>')) {
        const textDecoder = new TextDecoder();
        const fullText = textDecoder.decode(arrayBuffer);
        
        if (fullText.includes('drive.google.com') || fullText.includes('ServiceLogin')) {
             throw new Error("File yêu cầu quyền truy cập (Private).");
        }
        if (fullText.includes('virus')) throw new Error("Google chặn tải do cảnh báo virus.");
        
        const errorPreview = fullText.substring(0, 150).replace(/<[^>]*>/g, '').trim();
        throw new Error(`Lỗi tải file: ${errorPreview || 'Không xác định'}`);
    }

    let type: 'pdf' | 'word' | 'excel' = 'pdf'; 
    let content = '';

    if (signature.includes('%PDF')) {
        type = 'pdf';
        try {
            // Robust PDF Loading
            const loadingTask = pdfjsLib.getDocument({ 
                data: arrayBuffer,
                disableStream: true,
                disableAutoFetch: false
            });
            const pdf = await loadingTask.promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                try {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    if (pageText.trim()) {
                        content += pageText + '\n';
                    }
                } catch(pageErr) { console.warn("Lỗi đọc trang PDF:", pageErr); }
            }
        } catch (pdfErr: any) {
            console.error("PDF Parsing Inner Error:", pdfErr);
            throw new Error("Không thể đọc nội dung PDF.");
        }
    } else {
         let isExcel = false;
         try {
             const workbook = XLSX.read(arrayBuffer, { type: 'array' });
             if (workbook.SheetNames.length > 0) {
                 type = 'excel';
                 isExcel = true;
                 workbook.SheetNames.forEach((sheetName: string) => {
                     const worksheet = workbook.Sheets[sheetName];
                     const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                     if (json.length > 0) {
                         const sheetContent = json
                            .filter((row: any) => Array.isArray(row) && row.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== ''))
                            .map((row: any) => (Array.isArray(row) ? row.join('\t') : String(row)))
                            .join('\n');
                         if (sheetContent.trim()) {
                             content += `Sheet: ${sheetName}\n` + sheetContent + '\n\n';
                         }
                     }
                 });
             }
         } catch (excelErr) { isExcel = false; }

         if (!isExcel || !content.trim()) {
             if (!content.trim()) isExcel = false;
             if (!isExcel) {
                try {
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    type = 'word';
                    content = result.value;
                } catch (wordErr) {}
             }
         }
    }

    if (!content || content.trim().length === 0) {
        if (type === 'pdf') {
             return { content: "⚠️ [CẢNH BÁO HỆ THỐNG] File PDF này là bản Scan/Ảnh hoặc không có lớp văn bản.", type, name: `Drive-File-${fileId.substring(0,6)}` };
        }
        throw new Error("File không có nội dung văn bản có thể đọc được.");
    }

    return { content, type, name: `Drive-File-${fileId.substring(0,6)}` };

  } catch (e: any) {
    console.error("Fetch/Parse Error:", e);
    const msg = (e.message || "").toLowerCase();
    if (msg.includes('invalid pdf structure') || e.name === 'InvalidPDFException') {
         throw new Error("Lỗi cấu trúc PDF.");
    }
    throw e;
  }
};
