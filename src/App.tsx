import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import Landing from '@/pages/Landing'
import Browse from '@/pages/Browse'
import ListingDetail from '@/pages/ListingDetail'
import SignIn from '@/pages/SignIn'
import SignUp from '@/pages/SignUp'
import SellerDashboard from '@/pages/SellerDashboard'
import MyPurchases from '@/pages/MyPurchases'
import AppLibrary from '@/pages/AppLibrary'
import AppPlayer from '@/pages/AppPlayer'
import Messages from '@/pages/Messages'
import Conversation from '@/pages/Conversation'
import ProfilePage from '@/pages/ProfilePage'
import Feed from '@/pages/Feed'
import OrganizationsList from '@/pages/OrganizationsList'
import CreateOrganization from '@/pages/CreateOrganization'
import OrganizationDetail from '@/pages/OrganizationDetail'
import RigDetail from '@/pages/RigDetail'
import Talent from '@/pages/Talent'
import { useAuth } from '@/context/AuthContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    )
  }
  if (!user) return <Navigate to="/sign-in" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="marketplace" element={<Browse />} />
        <Route path="browse" element={<Navigate to="/marketplace" replace />} />
        <Route path="listing/:id" element={<ListingDetail />} />
        <Route path="talent" element={<Talent />} />
        <Route path="feed" element={<Feed />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/:userId" element={<ProfilePage />} />
        <Route
          path="organizations"
          element={
            <ProtectedRoute>
              <OrganizationsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="organizations/new"
          element={
            <ProtectedRoute>
              <CreateOrganization />
            </ProtectedRoute>
          }
        />
        <Route
          path="organizations/:orgId"
          element={
            <ProtectedRoute>
              <OrganizationDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="organizations/:orgId/rigs/:rigId"
          element={
            <ProtectedRoute>
              <RigDetail />
            </ProtectedRoute>
          }
        />
        <Route path="sign-in" element={<SignIn />} />
        <Route path="sign-up" element={<SignUp />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <SellerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="purchases"
          element={
            <ProtectedRoute>
              <MyPurchases />
            </ProtectedRoute>
          }
        />
        <Route
          path="apps"
          element={
            <ProtectedRoute>
              <AppLibrary />
            </ProtectedRoute>
          }
        />
        <Route
          path="app/:grantId"
          element={
            <ProtectedRoute>
              <AppPlayer />
            </ProtectedRoute>
          }
        />
        <Route
          path="messages"
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          }
        />
        <Route
          path="messages/:conversationId"
          element={
            <ProtectedRoute>
              <Conversation />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
