// OJT Master v2.3.0 - Main Application Component

import { useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { checkAIStatus } from './utils/api';
import { VIEW_STATES } from './constants';

// Placeholder components (to be implemented)
import Header from './components/Header';
import RoleSelectionPage from './components/RoleSelectionPage';
import AdminDashboard from './components/AdminDashboard';
import MentorDashboard from './components/MentorDashboard';
import MenteeList from './components/MenteeList';
import MenteeStudy from './components/MenteeStudy';

function App() {
  const { viewState, isLoading } = useAuth();
  const [aiStatus, setAiStatus] = useState({ online: false, model: '' });

  // Check AI status on mount
  useEffect(() => {
    checkAIStatus().then(setAiStatus);
    const interval = setInterval(() => {
      checkAIStatus().then(setAiStatus);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Loading state
  if (isLoading || viewState === VIEW_STATES.LOADING) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // Role selection (unauthenticated or new user)
  if (viewState === VIEW_STATES.ROLE_SELECT) {
    return <RoleSelectionPage />;
  }

  // Main app with header
  return (
    <div className="min-h-screen bg-gray-50">
      <Header aiStatus={aiStatus} />

      <main className="container mx-auto px-4 py-6">
        {viewState === VIEW_STATES.ADMIN_DASHBOARD && <AdminDashboard />}
        {viewState === VIEW_STATES.MENTOR_DASHBOARD && <MentorDashboard aiStatus={aiStatus} />}
        {viewState === VIEW_STATES.MENTEE_LIST && <MenteeList />}
        {viewState === VIEW_STATES.MENTEE_STUDY && <MenteeStudy />}
      </main>
    </div>
  );
}

export default App;
