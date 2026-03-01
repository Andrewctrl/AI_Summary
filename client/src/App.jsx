import { createHashRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import Chat from './pages/Chat'

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { path: 'login', element: <Login /> },
      {
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <Home /> },
          { path: 'chat/:id', element: <Chat /> },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
