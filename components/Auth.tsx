
import React, { useState } from 'react';

interface AuthProps {
  onAuthSuccess: (email: string) => void;
  type: 'signin' | 'signup';
  onToggle: () => void;
}

export const AuthForm: React.FC<AuthProps> = ({ onAuthSuccess, type, onToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate auth logic
    if (type === 'signup' && !code) {
      alert("请输入验证码");
      return;
    }
    localStorage.setItem('user', JSON.stringify({ email, isLoggedIn: true }));
    onAuthSuccess(email);
  };

  const handleSendCode = () => {
    setIsSendingCode(true);
    setTimeout(() => {
      setIsSendingCode(false);
      alert("验证码已发送至邮箱（模拟）");
    }, 1000);
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">
        {type === 'signin' ? '登录' : '注册'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">邮箱</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-amber-500 focus:border-amber-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-amber-500 focus:border-amber-500"
            required
          />
        </div>
        {type === 'signup' && (
          <div className="flex space-x-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">验证码</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <button
              type="button"
              onClick={handleSendCode}
              disabled={isSendingCode}
              className="mt-6 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
            >
              {isSendingCode ? '发送中...' : '发送'}
            </button>
          </div>
        )}
        <button
          type="submit"
          className="w-full py-3 bg-amber-600 text-white rounded-lg font-semibold shadow-md hover:bg-amber-700 transition duration-200"
        >
          {type === 'signin' ? '登录' : '注册'}
        </button>
      </form>
      <div className="mt-6 text-center">
        <button onClick={onToggle} className="text-amber-600 hover:text-amber-700 text-sm font-medium">
          {type === 'signin' ? '没有账号？立即注册' : '已有账号？立即登录'}
        </button>
      </div>
    </div>
  );
};
