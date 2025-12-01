// OJT Master v2.3.0 - Header Component

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../constants';

export default function Header({ aiStatus }) {
  const { user, displayRole, sessionMode, handleLogout, handleModeSwitch } = useAuth();
  const [showModeMenu, setShowModeMenu] = useState(false);

  const isAdmin = user?.role === ROLES.ADMIN;
  const isTempMentorMode = sessionMode === 'mentor';

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">OJT</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">OJT Master</h1>
              <p className="text-xs text-gray-500">
                {isTempMentorMode ? 'MENTOR MODE (임시)' : 'v2.3.0'}
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* AI Status */}
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  aiStatus.online ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-600">
                {aiStatus.online ? 'Gemini 온라인' : 'AI 오프라인'}
              </span>
            </div>

            {/* Mode Switch (Admin only) */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setShowModeMenu(!showModeMenu)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  모드
                </button>
                {showModeMenu && (
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border z-50">
                    <button
                      onClick={() => {
                        handleModeSwitch('admin');
                        setShowModeMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                        !isTempMentorMode ? 'bg-blue-50 text-blue-600' : ''
                      }`}
                    >
                      Admin 대시보드
                    </button>
                    <button
                      onClick={() => {
                        handleModeSwitch('mentor');
                        setShowModeMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                        isTempMentorMode ? 'bg-amber-50 text-amber-600' : ''
                      }`}
                    >
                      Mentor 작업실
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* User info */}
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-800">{user.name}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {isTempMentorMode ? (
                      <span className="text-amber-600">Mentor (임시)</span>
                    ) : (
                      displayRole
                    )}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Temp mode warning banner */}
        {isTempMentorMode && (
          <div className="mt-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
            <span className="text-sm text-amber-700">MENTOR 모드로 작업 중입니다 (임시)</span>
            <button
              onClick={() => handleModeSwitch('admin')}
              className="text-sm text-amber-600 hover:text-amber-800 font-medium"
            >
              Admin으로 돌아가기
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
