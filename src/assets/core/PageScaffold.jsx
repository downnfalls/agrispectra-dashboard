import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { useAuth } from '../context/AuthContext'
import LoginPage from '../pages/login/LoginPage';
import DashboardLayout from './DashboardLayout';
import Dashboard from '../pages/Dashboard';
import NotFound from '../pages/NotFound';

const RequireAuth = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  console.log('RequireAuth: user =', user);

  if (!user) {
    // ส่งกลับไปหน้า Login และจำไว้ว่าตะกี้จะเข้าหน้าไหน (ด้วย state: { from: location })
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

function PageScaffold() {

  return (
    <AuthProvider>
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes Group */}
        <Route 
          path="/" 
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )

}

export default PageScaffold
