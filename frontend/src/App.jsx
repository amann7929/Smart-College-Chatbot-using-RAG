import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ChatProvider } from './context/ChatContext';
import AppShell from './components/layout/AppShell';
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from './components/layout/RouteGuards';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import { PageSpinner } from './components/ui/Feedback';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

// Recharts is large, so the admin dashboard is only downloaded by administrators.
const AdminPage = lazy(() => import('./pages/AdminPage'));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
      <Route element={<ProtectedRoute><ChatProvider><AppShell /></ChatProvider></ProtectedRoute>}>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:chatId" element={<ChatPage />} />
        <Route path="/knowledge-base" element={<AdminRoute><KnowledgeBasePage /></AdminRoute>} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminRoute><Suspense fallback={<PageSpinner />}><AdminPage /></Suspense></AdminRoute>} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
