import { useState, useEffect, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { getUser, onAuthChange, signOut } from './lib/auth'
import { fetchDecks, fetchStudySessions, fetchCostTracker } from './lib/data'
import Layout from './components/Layout'
import AuthScreen from './components/AuthScreen'
import Home from './pages/Home'
import Generate from './pages/Generate'
import Library from './pages/Library'
import DeckDetail from './pages/DeckDetail'
import Study from './pages/Study'
import Progress from './pages/Progress'
import Settings from './pages/Settings'

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [decks, setDecks] = useState([])
  const [studySessions, setStudySessions] = useState([])
  const [costTracker, setCostTracker] = useState(null)
  const [cardProgressMap, setCardProgressMap] = useState({})
  const [loading, setLoading] = useState(true)

  // Auth listener
  useEffect(() => {
    getUser().then(u => { setUser(u); setAuthChecked(true) })
    const sub = onAuthChange(u => setUser(u))
    return () => sub.unsubscribe()
  }, [])

  // Load data when user logs in
  useEffect(() => {
    if (!user) { setDecks([]); setStudySessions([]); setLoading(false); return }
    setLoading(true)
    Promise.all([
      fetchDecks(user.id),
      fetchStudySessions(user.id),
      fetchCostTracker(user.id),
    ]).then(([d, ss, ct]) => {
      setDecks(d)
      setStudySessions(ss)
      setCostTracker(ct)
    }).catch(err => console.error('Load error:', err))
      .finally(() => setLoading(false))
  }, [user])

  const refreshDecks = useCallback(() => {
    if (!user) return
    fetchDecks(user.id).then(setDecks).catch(console.error)
  }, [user])

  const handleProgressUpdate = useCallback((cardId, progress) => {
    setCardProgressMap(prev => ({ ...prev, [cardId]: progress }))
  }, [])

  // Auth gate
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="text-on-surface-variant text-sm font-body">Loading...</span>
      </div>
    )
  }

  if (!user) {
    return <AuthScreen onAuth={setUser} />
  }

  return (
    <Layout>
      <Routes>
        <Route
          path="/"
          element={
            <Home
              user={user}
              decks={decks}
              studySessions={studySessions}
            />
          }
        />
        <Route
          path="/generate"
          element={<Generate user={user} />}
        />
        <Route
          path="/library"
          element={<Library decks={decks} />}
        />
        <Route
          path="/library/:deckId"
          element={<DeckDetail user={user} onRefresh={refreshDecks} />}
        />
        <Route
          path="/study/:deckId"
          element={
            <Study
              user={user}
              cardProgressMap={cardProgressMap}
              onProgressUpdate={handleProgressUpdate}
            />
          }
        />
        <Route
          path="/progress"
          element={
            <Progress
              studySessions={studySessions}
              decks={decks}
            />
          }
        />
        <Route
          path="/settings"
          element={
            <Settings
              user={user}
              costTracker={costTracker}
            />
          }
        />
      </Routes>
    </Layout>
  )
}
