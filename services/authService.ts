
import { User } from '../types';
import { createClient } from '@supabase/supabase-js';

const USERS_KEY = 'dst_ai_users';
const CURRENT_USER_KEY = 'dst_ai_current_user';
const CREDENTIALS_KEY = 'dst_ai_credentials';

/**
 * CẤU HÌNH CLOUD DATABASE (SUPABASE)
 * Để giữ dữ liệu người dùng không bị mất khi deploy, bạn cần:
 * 1. Tạo project tại supabase.com (miễn phí)
 * 2. Tạo table 'users_registry' với các cột: username (text, PK), password (text), role (text), status (text)
 * 3. Điền URL và ANON KEY vào 2 hằng số bên dưới.
 */
const SUPABASE_URL = 'https://cctjgjnbstuxrucsabro.supabase.co'; // Dán URL Project Supabase của bạn vào đây
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjdGpnam5ic3R1eHJ1Y3NhYnJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3Njk1NDQsImV4cCI6MjA4NDM0NTU0NH0.pZKjGeWFL8CJpQgmtK5GuLHWBLvHVnVESgYu-umXUkw'; // Dán Anon Key Supabase của bạn vào đây

// Export supabase client để App.tsx có thể dùng tính năng Realtime
export const supabaseClient = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

const NOTIFICATION_WEBHOOK_URL = ''; 

// Hàm bổ trợ để lấy dữ liệu Local (Dùng khi chưa có Supabase hoặc làm fallback)
const getLocalUsers = (): User[] => {
  const usersStr = localStorage.getItem(USERS_KEY);
  return usersStr ? JSON.parse(usersStr) : [];
};

const getLocalCreds = () => {
  return JSON.parse(localStorage.getItem(CREDENTIALS_KEY) || '{}');
};

export const getAllUsers = async (): Promise<User[]> => {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('users_registry').select('username, role, status');
      if (!error && data) return data as User[];
      console.warn("Supabase fetch error, falling back to local:", error);
    } catch (e) {
      console.error("Cloud Error:", e);
    }
  }
  return getLocalUsers();
};

export const registerUser = async (username: string, password: string): Promise<User> => {
  const isAdmin = username === 'Minhnt4';
  const newUser: User = { 
    username, 
    role: isAdmin ? 'admin' : 'user',
    status: isAdmin ? 'approved' : 'pending' 
  };

  if (supabaseClient) {
    const { error } = await supabaseClient.from('users_registry').insert([
      { username, password, role: newUser.role, status: newUser.status }
    ]);
    if (error) {
      if (error.code === '23505') throw new Error('Tên đăng nhập đã tồn tại trên hệ thống');
      throw new Error('Lỗi đồng bộ Cloud: ' + error.message);
    }
  } else {
    // Fallback Local Storage
    const users = getLocalUsers();
    if (users.find(u => u.username === username)) {
      throw new Error('Tên đăng nhập đã tồn tại');
    }
    const storedCreds = getLocalCreds();
    storedCreds[username] = password;
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(storedCreds));
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  
  if (NOTIFICATION_WEBHOOK_URL && !isAdmin) {
    try {
      fetch(NOTIFICATION_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_phone: "0943841155",
          username: username,
          message: `[AI ĐST-QNPC] Có người dùng mới đăng ký: ${username}. Vui lòng phê duyệt truy cập.`,
          timestamp: new Date().toLocaleString('vi-VN')
        })
      }).catch(err => console.warn("Notification Webhook failed:", err));
    } catch (e) {}
  }
  
  return newUser;
};

export const loginUser = async (username: string, password: string): Promise<User> => {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('users_registry')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    
    if (!error && data) {
      if (data.password === password) {
        if (data.status === 'pending') throw new Error('Tài khoản đang chờ Admin phê duyệt.');
        if (data.status === 'rejected') throw new Error('Tài khoản bị từ chối truy cập.');
        return { username: data.username, role: data.role, status: data.status };
      }
    }
  } else {
    // Fallback Local Storage
    const storedCreds = getLocalCreds();
    if (storedCreds[username] === password) {
      const users = getLocalUsers();
      const user = users.find(u => u.username === username);
      if (user) {
        if (user.status === 'pending') throw new Error('Tài khoản của bạn đang chờ Admin phê duyệt.');
        if (user.status === 'rejected') throw new Error('Tài khoản đã bị từ chối truy cập.');
        return user;
      }
    }
  }
  throw new Error('Sai tên đăng nhập hoặc mật khẩu');
};

export const updateUserStatus = async (username: string, status: 'approved' | 'rejected' | 'pending'): Promise<void> => {
  if (supabaseClient) {
    await supabaseClient.from('users_registry').update({ status }).eq('username', username);
  } else {
    const users = getLocalUsers();
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex !== -1) {
      users[userIndex].status = status;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  }
};

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem(CURRENT_USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
};

export const setCurrentUser = (user: User | null) => {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
};

export const deleteUser = async (username: string) => {
  if (username === 'Minhnt4') throw new Error('Không thể xóa admin hệ thống');
  
  if (supabaseClient) {
    await supabaseClient.from('users_registry').delete().eq('username', username);
  } else {
    let users = getLocalUsers();
    users = users.filter(u => u.username !== username);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    const storedCreds = getLocalCreds();
    delete storedCreds[username];
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(storedCreds));
  }
};
