
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DocumentSource, Message, GroundingLink, User } from './types';
import { parsePdf, parseExcel, parseWord, fetchGoogleSheetAsCsv, fetchAndParseDriveFile } from './services/fileParser';
import { chatWithContext, generateSpeech } from './services/geminiService';
import { saveDocuments, loadDocuments } from './services/storageService';
import { loginUser, registerUser, getCurrentUser, setCurrentUser, getAllUsers, deleteUser, updateUserStatus, supabaseClient } from './services/authService';

const ZALO_LINK = "https://zalo.me/0943841155";
const ZALO_OA_LINK = "https://zalo.me/app/link/zymyauwkzd"; 
const WEBSITE_LINK = "https://chuyendoisodlst.com";
const REMEMBERED_CREDS_KEY = 'dst_ai_remembered_creds';
const LAST_VERSION_KEY = 'dst_ai_last_seen_version';

const APP_VERSION = "2.8.8"; 
const UPDATE_NOTES = [
  "Giao diện: Hiển thị tổng số Link tìm thấy trong Master Sheet trên thanh Header.",
  "Hiệu năng: Tăng tốc độ đồng bộ dữ liệu.",
  "Cập nhật: Tự động đồng bộ dữ liệu mới mỗi 120 phút."
];

const DEFAULT_MASTER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1UEXskG7DKDk_d1JqvnOv2Cz-AAlA22C4iTMaI9qWbm4/edit';

const AuthView: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBERED_CREDS_KEY);
    if (saved) {
      try {
        const { username: savedUser, password: savedPass } = JSON.parse(saved);
        setUsername(savedUser);
        setPassword(savedPass);
        setRememberMe(true);
      } catch (e) {
        console.error("Lỗi tải thông tin ghi nhớ", e);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      if (isLogin) {
        const user = await loginUser(username, password);
        if (rememberMe) {
          localStorage.setItem(REMEMBERED_CREDS_KEY, JSON.stringify({ username, password }));
        } else {
          localStorage.removeItem(REMEMBERED_CREDS_KEY);
        }
        onLogin(user);
      } else {
        await registerUser(username, password);
        setSuccessMsg('Đăng ký thành công! Vui lòng chờ Admin phê duyệt tài khoản.');
        setIsLogin(true);
        if (rememberMe) {
          localStorage.setItem(REMEMBERED_CREDS_KEY, JSON.stringify({ username, password }));
        }
        setUsername('');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white p-8 animate-in fade-in zoom-in-95">
      <div className="flex flex-col items-center mb-10">
        <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse-soft"></div>
          <div className="absolute inset-0 bg-indigo-600/10 rounded-full blur-2xl animate-pulse-soft"></div>
          <div className="absolute inset-0 border-2 border-dashed border-indigo-200 rounded-full animate-spin-slow"></div>
          <div className="absolute inset-2 border border-indigo-500/30 rounded-full animate-spin-reverse"></div>
          <div className="relative w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-indigo-800 opacity-50"></div>
            <svg className="relative w-10 h-10 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">AI ĐST-QNPC</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Hệ thống Trí tuệ Nhân tạo</p>
        <span className="mt-2 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-full border border-indigo-100 uppercase tracking-tighter">Version {APP_VERSION}</span>
      </div>

      <h3 className={`text-lg font-black mb-6 uppercase tracking-tight ${isLogin ? 'text-slate-800' : 'text-indigo-600'}`}>
        {isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <input 
          type="text" placeholder="Tên đăng nhập" required value={username} onChange={e => setUsername(e.target.value)}
          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none focus:border-indigo-500 transition-all"
        />
        <div className="relative w-full">
          <input 
            type={showPassword ? "text" : "password"} 
            placeholder="Mật khẩu" required value={password} onChange={e => setPassword(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none focus:border-indigo-500 transition-all pr-14"
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 transition-colors">
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
            )}
          </button>
        </div>
        <div className="flex items-center space-x-2 px-1">
          <label className="flex items-center cursor-pointer group">
            <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="hidden" />
            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${rememberMe ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-50 border-slate-200'}`}>
              {rememberMe && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
            </div>
            <span className="ml-2 text-[11px] font-black text-slate-500 uppercase">Ghi nhớ mật khẩu</span>
          </label>
        </div>
        {error && <p className="text-red-500 text-[10px] font-black uppercase text-center bg-red-50 p-4 rounded-xl border border-red-100">{error}</p>}
        {successMsg && <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-green-600 text-[10px] font-black uppercase text-center">{successMsg}</div>}
        <button disabled={loading} className="w-full py-4.5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-50">
          {loading ? 'ĐANG XỬ LÝ...' : (isLogin ? 'ĐĂNG NHẬP' : 'ĐĂNG KÝ')}
        </button>
      </form>
      <button onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }} className="mt-6 text-[11px] font-black text-slate-400 hover:text-indigo-600 uppercase transition-colors">
        {isLogin ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
      </button>
    </div>
  );
};

// Audio Spark Icon
const AudioSparkIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3V21M8 8V16M16 8V16M4 11V13M20 11V13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChatBubble: React.FC<{ message: Message; onPlayAudio?: (text: string, msgId: string) => void; isPlaying?: boolean; isAudioLoading?: boolean; msgId: string }> = ({ message, onPlayAudio, isPlaying, isAudioLoading, msgId }) => {
  const formatMessage = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
      <div className="whitespace-pre-wrap break-words">
        {parts.map((part, i) => part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="text-indigo-900 font-black">{part.slice(2, -2)}</strong> : part)}
      </div>
    );
  };
  return (
    <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} mb-4 px-1 w-full animate-in fade-in slide-in-from-bottom-2`}>
      <div className={`relative max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-[14px] leading-relaxed group ${message.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-900 rounded-bl-none border border-slate-200'}`}>
        <div>{formatMessage(message.text)}</div>
        {message.links && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] font-black text-indigo-600 uppercase mb-2">Nguồn tham khảo:</p>
            {message.links.map((link, idx) => <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-blue-600 hover:underline truncate">• {link.title}</a>)}
          </div>
        )}
        
        {/* Play Audio Button for AI Messages - ALWAYS VISIBLE ONLY FOR MODEL */}
        {message.role === 'model' && onPlayAudio && (
            <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end items-center">
                <button 
                  onClick={() => onPlayAudio(message.text, msgId)}
                  disabled={isAudioLoading}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all ${isPlaying ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
                >
                    {isAudioLoading ? (
                        <>
                           <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                           <span>Đang tạo...</span>
                        </>
                    ) : isPlaying ? (
                        <>
                            <svg className="w-3 h-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                            <span>Đang đọc...</span>
                        </>
                    ) : (
                        <>
                            <AudioSparkIcon />
                            <span>Đọc tin nhắn</span>
                        </>
                    )}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

const UserGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-[20002] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
    <div className="bg-white rounded-[2.5rem] w-full max-w-lg h-[80vh] overflow-hidden shadow-2xl flex flex-col">
      <header className="bg-indigo-600 p-5 text-white flex justify-between items-center shrink-0">
        <div className="flex items-center">
            <div className="bg-white/20 p-2 rounded-lg mr-3">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <h3 className="text-lg font-black uppercase tracking-tight">Hướng dẫn sử dụng</h3>
        </div>
        <button onClick={onClose} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">✕</button>
      </header>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
        {/* Section 1 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center mb-3">
              <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-black flex items-center justify-center mr-3 text-sm">1</span>
              <h4 className="text-sm font-black text-indigo-700 uppercase">Trò chuyện & Hỏi đáp</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            Nhập câu hỏi vào ô chat phía dưới màn hình. AI sẽ tự động phân tích và trả lời dựa trên:
          </p>
          <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4 mb-4">
              <li><strong className="text-slate-800">Dữ liệu nội bộ:</strong> Các tài liệu bạn đã nạp vào hệ thống.</li>
              <li><strong className="text-slate-800">Kiến thức chung:</strong> Sử dụng kiến thức sâu rộng được huấn luyện sẵn của Gemini.</li>
          </ul>
          <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
              <p className="text-[10px] text-indigo-800 font-bold">💡 Mẹo: Hãy đặt câu hỏi cụ thể, ví dụ: "Quy trình xử lý sự cố lưới điện trung áp?" thay vì "Sự cố?".</p>
          </div>
        </div>

        {/* Section 2 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center mb-3">
              <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 font-black flex items-center justify-center mr-3 text-sm">2</span>
              <h4 className="text-sm font-black text-emerald-700 uppercase">Quản trị tri thức (Nạp dữ liệu)</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            Để AI thông minh hơn, bạn có thể nạp thêm tài liệu cho nó. Vào Menu chọn <strong className="text-slate-800">Quản trị tri thức</strong>:
          </p>
          <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
              <li><strong className="text-slate-800">Nạp file từ thiết bị:</strong> Hỗ trợ PDF, Word, Excel. Nhấn vào khung nạp file để chọn.</li>
              <li><strong className="text-slate-800">Đồng bộ Cloud:</strong> Dán link Google Sheet để đồng bộ dữ liệu trực tuyến (cần quyền truy cập công khai hoặc chia sẻ).</li>
          </ul>
        </div>

        {/* Section 3 */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center mb-3">
              <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-black flex items-center justify-center mr-3 text-sm">3</span>
              <h4 className="text-sm font-black text-blue-700 uppercase">HỖ TRỢ</h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Nếu gặp lỗi hoặc cần cấp quyền truy cập, vui lòng liên hệ Admin qua Zalo bằng nút trong Menu hoặc màn hình đăng nhập.
          </p>
        </div>
      </div>
      <div className="p-6 bg-white border-t border-slate-100">
        <button onClick={onClose} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase text-xs shadow-lg active:scale-95 transition-all">ĐÃ HIỂU, CẢM ƠN!</button>
      </div>
    </div>
  </div>
);

const InstallGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [tab, setTab] = useState<'ios' | 'android'>('ios');
    return (
        <div className="fixed inset-0 z-[20002] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-[380px] overflow-hidden shadow-2xl flex flex-col relative">
                <div className="bg-[#5856d6] pt-6 pb-4 relative text-center rounded-t-[2rem]">
                    <h3 className="text-white font-black text-xl uppercase tracking-wide">Cài đặt ứng dụng</h3>
                    <button 
                        onClick={onClose} 
                        className="absolute top-5 right-5 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 bg-white p-6 pt-2">
                    <div className="bg-slate-100 p-1.5 rounded-2xl flex mb-6 mt-4">
                        <button 
                            onClick={() => setTab('ios')} 
                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all duration-300 ${tab === 'ios' ? 'bg-white text-[#5856d6] shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            iOS
                        </button>
                        <button 
                            onClick={() => setTab('android')} 
                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all duration-300 ${tab === 'android' ? 'bg-white text-[#5856d6] shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Android
                        </button>
                    </div>

                    <div className="space-y-6">
                        {tab === 'ios' ? (
                            <>
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 rounded-full bg-[#4285f4] text-white flex items-center justify-center text-lg font-black shrink-0 shadow-lg shadow-blue-200">1</div>
                                    <h4 className="text-sm font-bold text-slate-800 leading-tight">Mở ứng dụng bằng Safari</h4>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 rounded-full bg-[#374151] text-white flex items-center justify-center text-lg font-black shrink-0 shadow-lg shadow-slate-200">2</div>
                                    <h4 className="text-sm font-bold text-slate-800 leading-tight">Nhấn vào biểu tượng Chia sẻ (Share)</h4>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 rounded-full bg-[#5856d6] text-white flex items-center justify-center text-lg font-black shrink-0 shadow-lg shadow-indigo-200">3</div>
                                    <h4 className="text-sm font-bold text-slate-800 leading-tight">Chọn "Thêm vào màn hình chính"</h4>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 rounded-full bg-[#4285f4] text-white flex items-center justify-center text-lg font-black shrink-0 shadow-lg shadow-blue-200">1</div>
                                    <h4 className="text-sm font-bold text-slate-800 leading-tight">Mở bằng Google Chrome</h4>
                                </div>
                                 <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 rounded-full bg-[#374151] text-white flex items-center justify-center text-lg font-black shrink-0 shadow-lg shadow-slate-200">2</div>
                                    <h4 className="text-sm font-bold text-slate-800 leading-tight">Nhấn vào menu 3 chấm</h4>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 rounded-full bg-[#5856d6] text-white flex items-center justify-center text-lg font-black shrink-0 shadow-lg shadow-indigo-200">3</div>
                                    <h4 className="text-sm font-bold text-slate-800 leading-tight">Chọn "Thêm vào màn hình chính"</h4>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                
                 <div className="p-6 bg-white pt-0">
                    <button onClick={onClose} className="w-full py-4 bg-[#5856d6] text-white font-black rounded-2xl uppercase text-sm shadow-xl hover:shadow-2xl hover:bg-[#4c4abf] active:scale-95 transition-all">ĐÃ HIỂU</button>
                </div>
            </div>
        </div>
    );
};

const decodePCM = (base64Data: string, ctx: AudioContext, sampleRate: number = 24000): AudioBuffer => {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const safeLen = len - (len % 2);
  const bytes = new Uint8Array(safeLen);
  for (let i = 0; i < safeLen; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const int16Data = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, int16Data.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  
  let i = int16Data.length;
  while (i--) {
    channelData[i] = int16Data[i] / 32768.0;
  }
  
  return buffer;
};

// Helper to concatenate array of raw PCM base64 strings
const mergeBase64PCM = (parts: string[]): string => {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  try {
    let combinedBinary = '';
    for (const part of parts) {
        if(part) combinedBinary += atob(part);
    }
    return btoa(combinedBinary);
  } catch (e) {
    return parts[0]; // Fallback
  }
};

const splitTextToChunks = (text: string): string[] => {
    if (text.length < 250) return [text];
    
    const chunks: string[] = [];
    let remaining = text;
    
    // Optimal chunk size for minimal latency vs network calls
    const TARGET_CHUNK_SIZE = 200; 

    while (remaining.length > 0) {
        if (remaining.length <= TARGET_CHUNK_SIZE + 50) {
            chunks.push(remaining);
            break;
        }

        // Search for punctuation to split naturally
        // Look in the window between 150 and 300 chars
        const searchWindow = remaining.substring(150, 350);
        let splitIndex = -1;
        
        // Priority: Paragraph -> Period/Question -> Comma -> Space
        const match = searchWindow.match(/[\n.!?։]\s+/);
        
        if (match && match.index !== undefined) {
             splitIndex = 150 + match.index + 1;
        } else {
             const commaMatch = searchWindow.match(/[,;]\s+/);
             if (commaMatch && commaMatch.index !== undefined) {
                splitIndex = 150 + commaMatch.index + 1;
             }
        }

        if (splitIndex === -1) {
            // Hard split at space if no punctuation
            const spaceIndex = remaining.indexOf(' ', TARGET_CHUNK_SIZE);
            splitIndex = spaceIndex !== -1 ? spaceIndex : TARGET_CHUNK_SIZE;
        }
        
        // Ensure we don't get stuck
        if (splitIndex <= 0) splitIndex = TARGET_CHUNK_SIZE;
        if (splitIndex > remaining.length) splitIndex = remaining.length;

        const chunk = remaining.substring(0, splitIndex).trim();
        if (chunk) chunks.push(chunk);
        
        remaining = remaining.substring(splitIndex).trim();
    }
    
    return chunks;
};

const App: React.FC = () => {
  const [currentUser, setLoggedInUser] = useState<User | null>(getCurrentUser());
  const [isOpen, setIsOpen] = useState(true); 
  const [isMaximized, setIsMaximized] = useState(() => localStorage.getItem('is_maximized') === 'true');
  const [activeTab, setActiveTab] = useState<'chat' | 'admin' | 'users'>('chat');
  const [documents, setDocuments] = useState<DocumentSource[]>([]);
  const [totalCloudLinks, setTotalCloudLinks] = useState(() => parseInt(localStorage.getItem('total_cloud_links') || '0'));
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncError, setSyncError] = useState('');
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'model', text: `Chào bạn! Tôi là trợ lý ảo AI ĐST-QNPC. Rất vui làm việc cùng bạn về mọi khía cạnh của ngành Điện và các số liệu của Đội QLĐ Sơn Tịnh`, timestamp: new Date() }]);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState('');
  const [masterSheetUrl, setMasterSheetUrl] = useState(() => localStorage.getItem('master_sheet_url') || DEFAULT_MASTER_SHEET_URL);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [onlineCount, setOnlineCount] = useState(1);

  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  // Refs for seamless streaming
  const activeSessionIdRef = useRef<number>(0); // To cancel old playbacks
  const audioChunksCacheRef = useRef<string[]>([]); // Temp store for chunks

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 4000);
  }, []);

  useEffect(() => {
    const checkKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.hasSelectedApiKey === 'function') {
        const result = await aistudio.hasSelectedApiKey();
        if (result) setHasApiKey(true);
      }
    };
    checkKey();
    const timer = setInterval(checkKey, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentUser || !supabaseClient) return;
    const room = supabaseClient.channel('global_presence', {
      config: {
        presence: {
          key: currentUser.username,
        },
      },
    });

    room
      .on('presence', { event: 'sync' }, () => {
        const newState = room.presenceState();
        setOnlineCount(Object.keys(newState).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await room.track({
            online_at: new Date().toISOString(),
            user: currentUser.username,
          });
        }
      });

    return () => {
      supabaseClient.removeChannel(room);
    };
  }, [currentUser]);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleSync = useCallback(async (url: string, isAuto: boolean = false) => {
    if (!url || url.trim().length < 10) return;
    setIsSyncing(true);
    if (!isAuto) setSyncStatus('Đang đồng bộ Cloud...');
    setSyncError('');
    try {
      const targetUrl = url.trim();
      const masterCsv = await fetchGoogleSheetAsCsv(targetUrl);
      const cloudDocs: DocumentSource[] = [{ id: 'master-cloud', name: 'Dữ liệu Cloud chính', type: 'sheet', content: masterCsv, status: 'ready', origin: 'cloud' }];
      
      // IMPROVED REGEX: Capture ID (Group 1) and GID (Group 2) if present
      const sheetMatches = [...masterCsv.matchAll(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)(?:[^\s]*?gid=([0-9]+))?/g)];
      
      // Store unique combinations of ID + GID
      const uniqueSubSheets = new Map<string, {id: string, gid: string | null}>();
      
      sheetMatches.forEach(match => {
          const id = match[1];
          const gid = match[2] || null;
          const key = `${id}-${gid || 'default'}`;
          if (!uniqueSubSheets.has(key)) {
              uniqueSubSheets.set(key, { id, gid });
          }
      });

      // --- PARALLEL PROCESSING: SUB-SHEETS (Tabs) ---
      const subSheetPromises = Array.from(uniqueSubSheets.values()).map(async ({id, gid}) => {
          try {
              const sheetNameSuffix = gid ? ` (Tab: ${gid})` : '';
              if (!isAuto) setSyncStatus(`Đang nạp: ${id.substring(0, 5)}...`); 

              const gidParam = gid ? `&gid=${gid}` : '';
              const subUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gidParam}&_t=${Date.now()}`;
              
              const subResponse = await fetch(subUrl);
              if (subResponse.ok) {
                 const subCsv = await subResponse.text();
                 if (subCsv && !subCsv.includes('<!DOCTYPE html>')) {
                    return { 
                        id: `sub-${id}-${gid || '0'}`, 
                        name: `Sheet con (${id.substring(0, 4)})`, 
                        type: 'sheet', 
                        content: subCsv, 
                        status: 'ready', 
                        origin: 'cloud' 
                    } as DocumentSource;
                }
              }
          } catch (e) { 
              console.warn("Lỗi nạp sheet con:", id); 
          }
          return null;
      });

      const driveMatches = [...masterCsv.matchAll(/https:\/\/(?:drive|docs)\.google\.com\/(?:file|document)\/d\/([a-zA-Z0-9-_]+)/g)];
      const driveFileIds = [...new Set(driveMatches.map(m => m[1]))];

      // Update total links count
      const totalLinksFound = uniqueSubSheets.size + driveFileIds.length;
      setTotalCloudLinks(totalLinksFound);
      localStorage.setItem('total_cloud_links', String(totalLinksFound));

      // --- PARALLEL PROCESSING: DRIVE FILES ---
      const drivePromises = driveFileIds.map(async (id) => {
          const isAlreadySheet = Array.from(uniqueSubSheets.values()).some(s => s.id === id);
          if (isAlreadySheet) return null;

          try {
              if (!isAuto) setSyncStatus(`Đang tải: ${id.substring(0, 5)}...`);
              const result = await fetchAndParseDriveFile(`https://drive.google.com/file/d/${id}/view`);
              return { 
                  id: `drive-${id}`, 
                  name: `${result.name} (${result.type.toUpperCase()})`, 
                  type: result.type, 
                  content: result.content, 
                  status: 'ready', 
                  origin: 'cloud' 
              } as DocumentSource;
          } catch (e: any) { 
              console.warn(`Lỗi nạp file Drive ${id}:`, e.message); 
          }
          return null;
      });

      // Wait for all downloads to finish in parallel
      const [subSheetResults, driveResults] = await Promise.all([
          Promise.all(subSheetPromises),
          Promise.all(drivePromises)
      ]);

      // Filter out nulls and add to cloudDocs
      subSheetResults.forEach(doc => { if (doc) cloudDocs.push(doc); });
      driveResults.forEach(doc => { if (doc) cloudDocs.push(doc); });

      const currentDocs = await loadDocuments();
      const localDocs = currentDocs.filter(d => d.origin === 'local');
      const allDocs = [...localDocs, ...cloudDocs];
      setDocuments(allDocs);
      await saveDocuments(allDocs);
      localStorage.setItem('master_sheet_url', targetUrl);
      setSyncStatus('');
      if (!isAuto) {
         showNotification(`Đã đồng bộ thành công ${allDocs.length} tài liệu từ hệ thống!`, 'success');
      }
    } catch (e: any) {
      setSyncError(e.message);
      setSyncStatus('');
      if (!isAuto) showNotification(`Lỗi đồng bộ: ${e.message}`, 'error');
    } finally { setIsSyncing(false); }
  }, [showNotification]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files) as File[];
    
    setIsSyncing(true);
    setSyncStatus('Đang xử lý file...');

    const newDocs: DocumentSource[] = [];

    for (const file of files) {
        try {
            let content = '';
            let type: 'pdf' | 'excel' | 'word' = 'pdf';
            
            if (file.name.endsWith('.pdf')) {
                content = await parsePdf(file);
                type = 'pdf';
            } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                content = await parseExcel(file);
                type = 'excel';
            } else if (file.name.endsWith('.docx')) {
                content = await parseWord(file);
                type = 'word';
            } else {
                continue; // Skip unsupported
            }

            if (content) {
                newDocs.push({
                    id: `local-${Date.now()}-${Math.random()}`,
                    name: file.name,
                    type,
                    content,
                    status: 'ready',
                    origin: 'local',
                    size: file.size
                });
            }
        } catch (err) {
            console.error(`Error parsing ${file.name}:`, err);
        }
    }

    if (newDocs.length > 0) {
        const updatedDocs = [...documents, ...newDocs];
        setDocuments(updatedDocs);
        await saveDocuments(updatedDocs);
        showNotification(`Đã nạp thành công ${newDocs.length} tài liệu vào bộ nhớ.`, 'success');
    } else {
        showNotification('Không có tài liệu nào được nạp (định dạng không hỗ trợ hoặc lỗi).', 'error');
    }
    
    setIsSyncing(false);
    setSyncStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (currentUser) {
      const lastSeenVersion = localStorage.getItem(LAST_VERSION_KEY);
      if (lastSeenVersion !== APP_VERSION) setShowUpdateNotice(true);

      // 1. Load Local Data First (Instant Load)
      loadDocuments().then(docs => {
        setDocuments(docs);
      });
      if (activeTab === 'users' || activeTab === 'admin') getAllUsers().then(setAllUsers);
    }
  }, [currentUser, activeTab]);

  // AUTO-SYNC INTERVAL (Every 120 minutes)
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
         const url = localStorage.getItem('master_sheet_url') || DEFAULT_MASTER_SHEET_URL;
         if (url && !isSyncing) { 
             console.log("Auto-syncing background update...");
             handleSync(url, true);
         }
    }, 7200000); // 7200000ms = 120 minutes
    return () => clearInterval(interval);
  }, [currentUser, isSyncing, handleSync]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isOpen]);

  const playAudioBuffer = (buffer: AudioBuffer, onEnded?: () => void) => {
    if (!audioContextRef.current) return;
    
    if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch(e) {}
    }
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
        if (onEnded) onEnded();
        else {
             setPlayingMessageId(null);
             audioSourceRef.current = null;
        }
    };
    source.start(0);
    audioSourceRef.current = source;
  };

  const handlePlayAudio = async (text: string, msgId: string) => {
    const msgIndex = parseInt(msgId.replace('msg-', ''));
    
    // Stop current playback & Reset session
    if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch(e) {}
        audioSourceRef.current = null;
    }
    activeSessionIdRef.current += 1; // Invalidate previous playbacks
    const currentSessionId = activeSessionIdRef.current;
    
    if (playingMessageId === msgId) {
        setPlayingMessageId(null);
        return; 
    }

    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    }
    if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
    }

    // 1. FAST PATH: Check if full audio is already cached
    const message = messages[msgIndex];
    if (message.audioData) {
        setPlayingMessageId(msgId);
        const buffer = decodePCM(message.audioData, audioContextRef.current, 24000);
        playAudioBuffer(buffer);
        return;
    }

    // 2. SMART STREAMING PATH
    setLoadingAudioId(msgId);

    // Split text into smart chunks
    const chunks = splitTextToChunks(text);
    const audioPromises: Promise<string | null>[] = [];
    audioChunksCacheRef.current = new Array(chunks.length).fill(null);
    
    // START PRODUCER: Trigger generation for chunks
    // We start Chunk 0 immediately, then sequential 1..N to avoid rate limits but stay ahead of player
    const produceAudio = async () => {
        for (let i = 0; i < chunks.length; i++) {
             if (currentSessionId !== activeSessionIdRef.current) break; // Stop if cancelled
             
             // Generate
             const audio = await generateSpeech(chunks[i]);
             if (currentSessionId !== activeSessionIdRef.current) break; 

             if (audio) {
                 audioChunksCacheRef.current[i] = audio;
             }
        }
    };
    produceAudio(); // Fire and forget (it runs in background)

    // START CONSUMER: Recursive player
    const consumeAndPlay = async (index: number) => {
        if (currentSessionId !== activeSessionIdRef.current) return;
        
        if (index >= chunks.length) {
            // FINISHED: Merge all parts and save to cache
            setPlayingMessageId(null);
            const allParts = audioChunksCacheRef.current.filter(p => p);
            if (allParts.length === chunks.length) {
                const merged = mergeBase64PCM(allParts);
                setMessages(prev => {
                    const updated = [...prev];
                    if (!updated[msgIndex].audioData) {
                        updated[msgIndex] = { ...updated[msgIndex], audioData: merged };
                    }
                    return updated;
                });
            }
            return;
        }

        // Wait for current chunk to be ready (Polling)
        // Since Producer is running, we wait for audioChunksCacheRef.current[index]
        let retries = 0;
        const waitForChunk = async () => {
             if (audioChunksCacheRef.current[index]) return audioChunksCacheRef.current[index];
             
             // Wait loop
             while (!audioChunksCacheRef.current[index] && retries < 100 && currentSessionId === activeSessionIdRef.current) {
                 await new Promise(r => setTimeout(r, 100)); // check every 100ms
                 retries++;
             }
             return audioChunksCacheRef.current[index];
        };

        const chunkAudio = await waitForChunk();
        
        if (chunkAudio && currentSessionId === activeSessionIdRef.current) {
            setLoadingAudioId(null);
            setPlayingMessageId(msgId);
            const buffer = decodePCM(chunkAudio, audioContextRef.current!, 24000);
            playAudioBuffer(buffer, () => consumeAndPlay(index + 1));
        } else {
            // Timeout or Error or Cancelled
            setLoadingAudioId(null);
            setPlayingMessageId(null);
        }
    };

    // Kick off the player for Chunk 0
    consumeAndPlay(0);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;
    const userMsg: Message = { role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg, { role: 'model', text: '', timestamp: new Date() }]);
    setInput('');
    setIsTyping(true);
    try {
      const response = await chatWithContext([...messages, userMsg], documents, (partial) => {
        setMessages(prev => {
          const newMsgs = [...prev];
          const last = newMsgs[newMsgs.length - 1];
          if (last.role === 'model') newMsgs[newMsgs.length - 1] = { ...last, text: partial };
          return newMsgs;
        });
      });
      
      // Update message with full text
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { role: 'model', text: response.text, links: response.links, timestamp: new Date() };
        return newMsgs;
      });

      // AUTO-TTS REMOVED TO SAVE QUOTA

    } catch (err: any) {
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { role: 'model', text: `Lỗi kết nối AI.`, timestamp: new Date() };
        return newMsgs;
      });
    } finally { setIsTyping(false); }
  };

  const handleUpdateStatus = async (username: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      await updateUserStatus(username, status);
      const updatedUsers = await getAllUsers();
      setAllUsers(updatedUsers);
    } catch (err: any) {
      alert(`Lỗi cập nhật trạng thái: ${err.message}`);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!window.confirm(`Xác nhận xóa người dùng ${username}?`)) return;
    try {
      await deleteUser(username);
      const updatedUsers = await getAllUsers();
      setAllUsers(updatedUsers);
    } catch (err: any) {
      alert(`Lỗi xóa người dùng: ${err.message}`);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoggedInUser(null);
    setShowMenu(false);
    setActiveTab('chat');
  };

  const handleShare = async () => {
    const url = window.location.href;
    const shareText = `Mời bạn sử dụng Trợ lý ảo AI ĐST-QNPC hỗ trợ quản lý kỹ thuật lưới điện.\nTruy cập tại: ${url}`;
    const shareData = {
        title: 'AI ĐST-QNPC',
        text: shareText, 
        url: url,
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
            setShowMenu(false);
            return;
        } catch (error) {
            console.log('Error sharing (Native):', error);
        }
    } 
    
    try {
        await navigator.clipboard.writeText(shareText);
        alert('Đã sao chép nội dung chia sẻ!\n\nBạn hãy mở Zalo và dán vào khung chat để gửi đi.');
    } catch (err) {
        prompt('Hãy copy link dưới đây để chia sẻ:', url);
    }
    setShowMenu(false);
  };

  const handleInstall = async () => {
    setShowInstallGuide(true);
    setShowMenu(false);
  };

  if (!currentUser) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-100">
        <div className="w-full max-w-md h-[650px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
          <AuthView onLogin={(u) => { setCurrentUser(u); setLoggedInUser(u); }} />
        </div>
      </div>
    );
  }

  const isMasterAdmin = currentUser?.username === 'Minhnt4';
  const pendingUsers = allUsers.filter(u => u.status === 'pending');
  const approvedUsers = allUsers.filter(u => u.status === 'approved');

  return (
    <div className={`fixed z-[9999] flex flex-col items-end transition-all duration-500 font-sans ${isMaximized ? 'inset-0' : 'bottom-6 right-6'}`}>
      {isOpen && (
        <div className={`flex flex-col bg-white shadow-2xl transition-all border border-slate-200 ${isMaximized ? 'w-full h-full rounded-none' : 'mb-4 w-[90vw] sm:w-[420px] h-[650px] rounded-[2.5rem] overflow-hidden'}`}>
          <header className={`relative flex-shrink-0 bg-indigo-700 text-white transition-all h-24 z-[100]`}>
            <div className="absolute inset-0 z-1 bg-gradient-to-r from-indigo-900 via-indigo-800/80 to-transparent" />
            <div className="relative z-10 flex items-center justify-between h-full px-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                  <div className="flex items-baseline space-x-2">
                    <h1 className="text-sm font-black uppercase tracking-tight">AI ĐST-QNPC</h1>
                    <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">| {currentUser?.username}</span>
                  </div>
                  <div className="flex items-center mt-0.5 space-x-2">
                    <p className="text-[9px] font-bold opacity-80 uppercase tracking-widest flex items-center">
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${hasApiKey ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`}></span>
                        {isSyncing ? 'Đang nạp...' : `${documents.length} / ${totalCloudLinks} Tri thức`}
                    </p>
                    <div className="flex items-center bg-white/10 px-1.5 py-0.5 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mr-1"></span>
                        <span className="text-[9px] font-black uppercase text-white">{onlineCount} Online</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => setIsMaximized(!isMaximized)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                </button>
                <button onClick={() => setShowMenu(!showMenu)} className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v.01M12 12v.01M12 19v.01" /></svg>
                </button>
              </div>
              {showMenu && (
                <>
                <div className="fixed inset-0 z-[998]" onClick={() => setShowMenu(false)}></div>
                <div className="absolute right-6 top-20 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-0 z-[999] animate-in slide-in-from-top-2 overflow-hidden">
                    <div className="bg-slate-50 p-3 border-b border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CHÀO {currentUser?.username}</p>
                    </div>
                    
                    <div className="p-2 space-y-1">
                        <button onClick={() => { window.open(WEBSITE_LINK, '_blank'); setShowMenu(false); }} className="w-full text-left p-3 text-xs font-black uppercase text-blue-600 hover:bg-blue-50 rounded-xl flex items-center transition-colors">
                            <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                            WEBSITE ĐST
                        </button>
                        <button onClick={() => { window.open(ZALO_OA_LINK, '_blank'); setShowMenu(false); }} className="w-full text-left p-3 text-xs font-black uppercase text-blue-600 hover:bg-blue-50 rounded-xl flex items-center transition-colors">
                            <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            ZALO OA (OFFICIAL)
                        </button>
                        <div className="h-px bg-slate-100 my-1"></div>
                        <button onClick={handleShare} className="w-full text-left p-3 text-xs font-black uppercase text-emerald-600 hover:bg-emerald-50 rounded-xl flex items-center transition-colors">
                            <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                            CHIA SẺ ỨNG DỤNG
                        </button>
                        <div className="h-px bg-slate-100 my-1"></div>
                        <button onClick={() => { setActiveTab('admin'); setShowMenu(false); }} className="w-full text-left p-3 text-xs font-black uppercase text-slate-700 hover:bg-slate-100 rounded-xl flex items-center transition-colors">
                            <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                            QUẢN TRỊ TRI THỨC
                        </button>
                        <button onClick={() => { setIsAuthModalOpen(true); setShowMenu(false); }} className="w-full text-left p-3 text-xs font-black uppercase text-indigo-600 hover:bg-indigo-50 rounded-xl flex items-center transition-colors">
                            <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            QUẢN LÝ NGƯỜI DÙNG
                        </button>
                        <button onClick={() => { setShowUserGuide(true); setShowMenu(false); }} className="w-full text-left p-3 text-xs font-black uppercase text-indigo-600 hover:bg-indigo-50 rounded-xl flex items-center transition-colors">
                            <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            HƯỚNG DẪN SỬ DỤNG
                        </button>
                        <div className="h-px bg-slate-100 my-1"></div>
                        <button onClick={handleInstall} className="w-full text-left p-3 text-xs font-black uppercase text-slate-700 hover:bg-slate-100 rounded-xl flex items-center transition-colors">
                            <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            CÀI ĐẶT ỨNG DỤNG
                        </button>
                        <div className="h-px bg-slate-100 my-1"></div>
                        <button onClick={handleLogout} className="w-full text-left p-3 text-xs font-black uppercase text-red-600 hover:bg-red-50 rounded-xl flex items-center transition-colors">
                            <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            ĐĂNG XUẤT
                        </button>
                    </div>
                </div>
                </>
              )}
            </div>
          </header>

          <main className="flex-1 overflow-hidden relative bg-slate-50 flex flex-col">
            {activeTab === 'chat' ? (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {messages.map((msg, i) => (
                    <ChatBubble 
                        key={i} 
                        message={msg} 
                        onPlayAudio={(text) => handlePlayAudio(text, `msg-${i}`)}
                        isPlaying={playingMessageId === `msg-${i}`}
                        isAudioLoading={loadingAudioId === `msg-${i}`}
                        msgId={`msg-${i}`}
                    />
                  ))}
                  
                  {isTyping && (
                    <div className="flex flex-col items-start mb-6 px-1 w-full animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-end space-x-2">
                           <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 animate-pulse-soft">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                           </div>
                           <div className="bg-white border border-indigo-50 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm flex items-center space-x-1.5 relative overflow-hidden group">
                               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-50/50 to-transparent animate-shimmer"></div>
                               <div className="w-2 h-2 bg-indigo-400 rounded-full animate-typing-dot [animation-delay:-0.32s] relative z-10"></div>
                               <div className="w-2 h-2 bg-purple-400 rounded-full animate-typing-dot [animation-delay:-0.16s] relative z-10"></div>
                               <div className="w-2 h-2 bg-pink-400 rounded-full animate-typing-dot relative z-10"></div>
                           </div>
                        </div>
                        <div className="ml-10 mt-1.5 flex items-center space-x-2">
                            <span className="text-[10px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 animate-pulse">
                                Đang phân tích & xử lý dữ liệu...
                            </span>
                        </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
                <div className="p-4 bg-white border-t">
                  <form onSubmit={handleSendMessage} className="flex space-x-2">
                    <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Hãy đặt câu hỏi..." className="flex-1 bg-slate-100 rounded-full px-6 py-4 outline-none focus:bg-white border-2 border-transparent focus:border-indigo-500" />
                    <button type="submit" disabled={!input.trim() || isTyping} className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg disabled:opacity-30">
                      <svg className="w-6 h-6 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                  </form>
                </div>
              </div>
            ) : activeTab === 'admin' ? (
              <div className="h-full p-8 overflow-y-auto bg-slate-50">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-black uppercase text-slate-800">Quản trị tri thức</h2>
                  <button onClick={() => setActiveTab('chat')} className="text-xs font-bold text-indigo-600 px-4 py-2 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">Quay lại Chat</button>
                </div>
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                    <h3 className="text-xs font-black uppercase mb-3 text-indigo-600">Đồng bộ Cloud (Google Sheets)</h3>
                    <div className={`bg-slate-50 p-2 rounded-2xl mb-3 border border-slate-200 ${!isMasterAdmin ? 'opacity-50' : ''}`}>
                        <input 
                            value={masterSheetUrl} 
                            onChange={(e) => setMasterSheetUrl(e.target.value)} 
                            readOnly={!isMasterAdmin} 
                            disabled={!isMasterAdmin}
                            className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none p-2" 
                        />
                    </div>
                    <button onClick={() => handleSync(masterSheetUrl)} disabled={isSyncing} className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl uppercase text-xs shadow-lg active:scale-95 transition-all flex justify-center items-center">
                      {isSyncing ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            {syncStatus || 'Đang đồng bộ...'}
                          </>
                      ) : 'ĐỒNG BỘ NGAY'}
                    </button>
                    {syncError && <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[10px] font-black uppercase">{syncError}</div>}
                  </div>

                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                    <h3 className="text-xs font-black uppercase mb-3 text-slate-400">Nạp file từ thiết bị</h3>
                    <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors group">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-indigo-50 group-hover:text-indigo-600 text-slate-400 transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Nhấn để chọn file</span>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.xlsx,.xls,.docx" multiple className="hidden" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full p-8 overflow-y-auto bg-slate-50">
                 <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-black uppercase text-slate-800">Quản lý người dùng</h2>
                  <button onClick={() => setActiveTab('chat')} className="text-xs font-bold text-indigo-600 px-4 py-2 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">Quay lại Chat</button>
                </div>
                
                <div className="space-y-8">
                    <div>
                        <div className="flex items-center mb-3">
                            <span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
                            <h3 className="text-xs font-black uppercase text-amber-500">Yêu cầu chờ duyệt ({pendingUsers.length})</h3>
                        </div>
                        {pendingUsers.length === 0 ? (
                            <div className="p-8 border-2 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center">
                                <span className="text-xs text-slate-400 italic">Không có yêu cầu nào.</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pendingUsers.map(u => (
                                    <div key={u.username} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black mr-3 text-sm">
                                                {u.username.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{u.username}</p>
                                                <span className="text-[9px] font-black uppercase text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">Chờ duyệt</span>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button onClick={() => handleUpdateStatus(u.username, 'approved')} className="bg-green-500 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-green-600 transition-colors shadow-lg shadow-green-200">Duyệt</button>
                                            <button onClick={() => handleDeleteUser(u.username)} className="bg-red-50 text-red-500 px-3 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition-colors">Xóa</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center mb-3">
                             <h3 className="text-xs font-black uppercase text-slate-400">Danh sách thành viên ({approvedUsers.length})</h3>
                        </div>
                         <div className="space-y-3">
                            {approvedUsers.map(u => (
                                <div key={u.username} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black mr-3 text-sm">
                                            {u.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{u.username}</p>
                                            <span className="text-[9px] font-black uppercase text-green-500 bg-green-50 px-2 py-0.5 rounded-full">Đã duyệt</span>
                                        </div>
                                    </div>
                                    {u.username !== 'Minhnt4' && (
                                        <button onClick={() => handleDeleteUser(u.username)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}
      {!isMaximized && (
        <button onClick={() => setIsOpen(!isOpen)} className="w-16 h-16 rounded-full bg-indigo-600 text-white shadow-2xl flex items-center justify-center font-black transition-all hover:scale-105 active:scale-95">
          {isOpen ? '✕' : 'AI'}
        </button>
      )}

      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xs p-8 shadow-2xl animate-in zoom-in-95">
             <h3 className="text-lg font-black text-slate-800 text-center mb-6 uppercase tracking-tight">Xác thực Admin</h3>
             <form onSubmit={(e) => {
               e.preventDefault();
               if(authPassword === 'DST123M') { 
                 setActiveTab('users'); 
                 setIsAuthModalOpen(false); 
                 setAuthPassword(''); 
               } 
               else alert("Sai mật khẩu!");
             }} className="space-y-4">
               <input type="password" autoFocus value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Mật khẩu..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-center font-bold outline-none focus:border-indigo-500 transition-all" />
               <button className="w-full py-4.5 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase text-xs tracking-widest">XÁC NHẬN</button>
               <button type="button" onClick={() => setIsAuthModalOpen(false)} className="w-full text-[10px] font-bold text-slate-400 mt-2 uppercase text-center">ĐÓNG</button>
             </form>
          </div>
        </div>
      )}

      {showUpdateNotice && (
        <div className="fixed inset-0 z-[20001] flex items-center justify-center p-6 bg-indigo-900/80 backdrop-blur-lg animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl text-center">
            <h3 className="text-xl font-black uppercase mb-4 text-indigo-600">Phiên bản {APP_VERSION}</h3>
            <ul className="text-left space-y-3 mb-6">
              {UPDATE_NOTES.map((n, i) => <li key={i} className="text-xs font-bold text-slate-700 Hyde Park leading-tight">• {n}</li>)}
            </ul>
            <button onClick={() => { localStorage.setItem(LAST_VERSION_KEY, APP_VERSION); setShowUpdateNotice(false); }} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase text-xs shadow-xl active:scale-95 transition-all">ĐÃ HIỂU</button>
          </div>
        </div>
      )}

      {showUserGuide && <UserGuideModal onClose={() => setShowUserGuide(false)} />}
      {showInstallGuide && <InstallGuideModal onClose={() => setShowInstallGuide(false)} />}
      
      {notification && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[20005] px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center space-x-3 animate-in slide-in-from-bottom-5 fade-in ${notification.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white/20`}>
                {notification.type === 'success' ? (
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                ) : (
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                )}
            </div>
            <span className="text-xs font-black uppercase tracking-wide">{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default App;
