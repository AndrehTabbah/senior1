import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import Home from './pages/Home.jsx'
import Results from './pages/Results.jsx'
import Explain from './pages/Explain.jsx'
import Database from './pages/Database.jsx'
import Model from './pages/Model.jsx'
import History from './pages/History.jsx'
import Docs from './pages/Docs.jsx'
import SignIn from './pages/SignIn.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/results" element={<Results />} />
            <Route path="/explain/:drugId/:diseaseId" element={<Explain />} />
            <Route path="/database" element={<Database />} />
            <Route path="/model" element={<Model />} />
            <Route path="/history" element={<History />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/signin" element={<SignIn mode="signin" />} />
            <Route path="/signup" element={<SignIn mode="signup" />} />
            <Route path="/index.html" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
