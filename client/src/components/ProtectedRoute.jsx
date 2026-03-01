import { Navigate, Outlet } from 'react-router-dom'
import { db } from '../db'

export default function ProtectedRoute() {
  const { isLoading, user } = db.useAuth()

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}
