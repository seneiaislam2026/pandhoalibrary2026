import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './store/AuthContext';
import { Toaster } from 'react-hot-toast';

// Basic layouts for the app
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';
import AIBot from './components/AIBot';
import InaugurationOverlay from './components/InaugurationOverlay';

// Public Pages (Lazy Loaded)
const Home = React.lazy(() => import('./pages/public/Home'));
const Books = React.lazy(() => import('./pages/public/Books'));
const BuyBooks = React.lazy(() => import('./pages/public/BuyBooks'));
const Donors = React.lazy(() => import('./pages/public/Donors'));
const Team = React.lazy(() => import('./pages/public/Team'));
const Constitution = React.lazy(() => import('./pages/public/Constitution'));
const Blog = React.lazy(() => import('./pages/public/Blog'));
const Contact = React.lazy(() => import('./pages/public/Contact'));
const Login = React.lazy(() => import('./pages/public/Login'));
const Register = React.lazy(() => import('./pages/public/Register'));
const MonthlyDonors = React.lazy(() => import('./pages/public/MonthlyDonors'));
const BkashMockPayment = React.lazy(() => import('./pages/public/BkashMockPayment'));
const Events = React.lazy(() => import('./pages/public/Events'));
const Academic = React.lazy(() => import('./pages/public/Academic'));

// Admin / Reader pages (Lazy Loaded)
const DashboardHome = React.lazy(() => import('./pages/dashboard/DashboardHome'));
const ScholarshipRegistration = React.lazy(() => import('./pages/dashboard/ScholarshipRegistration'));
const ManageUsers = React.lazy(() => import('./pages/dashboard/ManageUsers'));
const ManageBooks = React.lazy(() => import('./pages/dashboard/ManageBooks'));
const Finances = React.lazy(() => import('./pages/dashboard/Finances'));
const ManageIssues = React.lazy(() => import('./pages/dashboard/ManageIssues'));
const ManageDues = React.lazy(() => import('./pages/dashboard/ManageDues'));
const ManageTeam = React.lazy(() => import('./pages/dashboard/ManageTeam'));
const ManageConstitution = React.lazy(() => import('./pages/dashboard/ManageConstitution'));
const ManageBlog = React.lazy(() => import('./pages/dashboard/ManageBlog'));
const ManagePreBookings = React.lazy(() => import('./pages/dashboard/ManagePreBookings'));
const ManageDonors = React.lazy(() => import('./pages/dashboard/ManageDonors'));
const ManageNotices = React.lazy(() => import('./pages/dashboard/ManageNotices'));
const ManageMessages = React.lazy(() => import('./pages/dashboard/ManageMessages'));
const ManageEvents = React.lazy(() => import('./pages/dashboard/ManageEvents'));
const ManageAcademic = React.lazy(() => import('./pages/dashboard/ManageAcademic'));
const UserNotices = React.lazy(() => import('./pages/dashboard/UserNotices'));
const UserMessages = React.lazy(() => import('./pages/dashboard/UserMessages'));
const UserPayment = React.lazy(() => import('./pages/dashboard/UserPayment'));
const UserProfile = React.lazy(() => import('./pages/dashboard/UserProfile'));
const UserBooks = React.lazy(() => import('./pages/dashboard/UserBooks'));
const BookRequests = React.lazy(() => import('./pages/dashboard/BookRequests'));
const TimeExtension = React.lazy(() => import('./pages/dashboard/TimeExtension'));
const ManageResetRequests = React.lazy(() => import('./pages/dashboard/ManageResetRequests'));
const DeleteUsers = React.lazy(() => import('./pages/dashboard/DeleteUsers'));
const ManageShopBooks = React.lazy(() => import('./pages/dashboard/ManageShopBooks'));
const ManageShopOrders = React.lazy(() => import('./pages/dashboard/ManageShopOrders'));
const ManageStickers = React.lazy(() => import('./pages/dashboard/ManageStickers'));
const ManageShelves = React.lazy(() => import('./pages/dashboard/ManageShelves'));
const ManageCategories = React.lazy(() => import('./pages/dashboard/ManageCategories'));
const ManageScholarships = React.lazy(() => import('./pages/dashboard/ManageScholarships'));
const AdminSettings = React.lazy(() => import('./pages/dashboard/AdminSettings'));
const BarcodeScanner = React.lazy(() => import('./pages/dashboard/BarcodeScanner'));
const StockTake = React.lazy(() => import('./pages/dashboard/StockTake'));
const Exam = React.lazy(() => import('./pages/dashboard/Exam'));
const ManageExam = React.lazy(() => import('./pages/dashboard/ManageExam'));
const StudyPractice = React.lazy(() => import('./pages/dashboard/StudyPractice'));
const ManageStudyPractice = React.lazy(() => import('./pages/dashboard/ManageStudyPractice'));

const KioskHome = React.lazy(() => import('./pages/kiosk/KioskHome'));

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
      <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
      <p className="font-bengali font-bold text-slate-500 animate-pulse">প্রবেশাধিকার যাচাই করা হচ্ছে...</p>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  const isSuperAdmin = user.role === 'admin' || user.email === 'seneiaislam@gmail.com' || user.email === 'admin@library.com' || user.username === 'admin';
  if (user.role === 'kiosk' && !location.pathname.startsWith('/kiosk')) {
     return <Navigate to="/kiosk" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role) && !isSuperAdmin) return <Navigate to="/dashboard" replace />;

  if (user.role === 'subadmin' || user.role === 'visitor_admin') {
    const defaultSubadminRoutes = ['/dashboard', '/dashboard/', '/dashboard/profile'];
    if (!defaultSubadminRoutes.includes(location.pathname)) {
       if (!user.subadminAccess?.includes(location.pathname)) {
          return <Navigate to="/dashboard" replace />;
       }
    }
  }

  return <>{children}</>;
};

function AppRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-white font-bengali">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-slate-100 rounded-full"></div>
          <div className="w-20 h-20 border-4 border-t-indigo-600 rounded-full animate-spin absolute top-0 left-0"></div>
        </div>
        <p className="mt-6 text-xl font-black text-slate-800 animate-pulse">লোড হচ্ছে...</p>
      </div>
    }>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Public Pages grouped under MainLayout */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/books" element={<Books />} />
            <Route path="/buy-books" element={<BuyBooks />} />
            <Route path="/donors" element={<Donors />} />
            <Route path="/team" element={<Team />} />
            <Route path="/constitution" element={<Constitution />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/finances" element={<Finances />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/bkash-mock-payment" element={<BkashMockPayment />} />
            <Route path="/events" element={<Events />} />
            <Route path="/academic" element={<Academic />} />
            <Route path="/public-exam" element={<Exam isPublic={true} />} />
          </Route>

          <Route path="/kiosk" element={<ProtectedRoute allowedRoles={['admin', 'kiosk']}><KioskHome /></ProtectedRoute>} />

          {/* Dashboard Routes grouped under DashboardLayout */}
          <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<DashboardHome />} />
            
            {/* Admin only */}
            <Route path="scholarship-registration" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ScholarshipRegistration /></ProtectedRoute>} />
            <Route path="scholarship-management" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManageScholarships /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManageUsers /></ProtectedRoute>} />
            <Route path="donors" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManageDonors /></ProtectedRoute>} />
            <Route path="finances" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><Finances /></ProtectedRoute>} />
            <Route path="books" element={<ProtectedRoute><ManageBooks /></ProtectedRoute>} />
            <Route path="issues" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManageIssues /></ProtectedRoute>} />
            <Route path="dues" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManageDues /></ProtectedRoute>} />
            <Route path="manageteam" element={<ProtectedRoute allowedRoles={['admin']}><ManageTeam /></ProtectedRoute>} />
            <Route path="constitution" element={<ProtectedRoute allowedRoles={['admin']}><ManageConstitution /></ProtectedRoute>} />
            <Route path="manageblog" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManageBlog /></ProtectedRoute>} />
            <Route path="delete-users" element={<ProtectedRoute allowedRoles={['admin']}><DeleteUsers /></ProtectedRoute>} />
            <Route path="notices" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManageNotices /></ProtectedRoute>} />
            <Route path="messages" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManageMessages /></ProtectedRoute>} />
            <Route path="events" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManageEvents /></ProtectedRoute>} />
            <Route path="manage-academic" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManageAcademic /></ProtectedRoute>} />
            <Route path="reset-requests" element={<ProtectedRoute allowedRoles={['admin']}><ManageResetRequests /></ProtectedRoute>} />
            <Route path="pre-bookings" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManagePreBookings /></ProtectedRoute>} />
            <Route path="shop-books" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManageShopBooks /></ProtectedRoute>} />
            <Route path="shop-orders" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManageShopOrders /></ProtectedRoute>} />
            <Route path="stickers" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManageStickers /></ProtectedRoute>} />
            <Route path="manage-shelves" element={<ProtectedRoute allowedRoles={['admin', 'subadmin']}><ManageShelves /></ProtectedRoute>} />
            <Route path="manage-categories" element={<ProtectedRoute allowedRoles={['admin', 'subadmin']}><ManageCategories /></ProtectedRoute>} />
            <Route path="manage-exam" element={<ProtectedRoute allowedRoles={['admin', 'subadmin']}><ManageExam /></ProtectedRoute>} />
            <Route path="manage-study-practice" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><ManageStudyPractice /></ProtectedRoute>} />
            <Route path="barcode-scanner" element={<ProtectedRoute allowedRoles={['admin', 'subadmin', 'visitor_admin']}><BarcodeScanner /></ProtectedRoute>} />
            <Route path="stock-take" element={<ProtectedRoute allowedRoles={['admin', 'subadmin']}><StockTake /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute allowedRoles={['admin']}><AdminSettings /></ProtectedRoute>} />
            
            {/* Reader & Admin */}
            <Route path="profile" element={<UserProfile />} />
            <Route path="my-books" element={<UserBooks />} />
            <Route path="notice-board" element={<UserNotices />} />
            <Route path="inbox" element={<UserMessages />} />
            <Route path="payment" element={<UserPayment />} />
            <Route path="exam" element={<Exam />} />
            <Route path="study-practice" element={<StudyPractice />} />
            <Route path="book-requests" element={<BookRequests />} />
            <Route path="time-extension" element={<TimeExtension />} />
          </Route>
          {/* Catch-all route to home page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" toastOptions={{ className: 'font-bengali font-bold' }} />
        <AppRoutes />
        <AIBot />
        <InaugurationOverlay />
      </AuthProvider>
    </BrowserRouter>
  );
}
