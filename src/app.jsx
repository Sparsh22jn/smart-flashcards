import { useState, useEffect, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { getUser, onAuthChange, signOut } from './lib/auth'
import { fetchDecks, fetchStudySessions, fetchCostTracker, fetchDeckProgress, fetchUserProfile, fetchStreak } from './lib/data'
import Layout from './components/Layout'
import { GenerationProvider } from './contexts/GenerationContext'
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
  const [deckProgress, setDeckProgress] = useState({})
  const [userProfile, setUserProfile] = useState(null)
  const [streak, setStreak] = useState(null)
  const [loading, setLoading] = useState(true)

  // Auth listener
  useEffect(() => {
    getUser().then(u => { setUser(u); setAuthChecked(true) })
    const sub = onAuthChange(u => setUser(u))
    return () => sub.unsubscribe()
  }, [])

  // Load data when user logs in
  useEffect(() => {
    if (!user) { setDecks([]); setStudySessions([]); setUserProfile(null); setStreak(null); setLoading(false); return }
    setLoading(true)
    Promise.all([
      fetchDecks(user.id),
      fetchStudySessions(user.id),
      fetchCostTracker(user.id),
      fetchDeckProgress(user.id),
      fetchUserProfile(user.id),
      fetchStreak(user.id),
    ]).then(([d, ss, ct, dp, up, st]) => {
      setDecks(d)
      setStudySessions(ss)
      setCostTracker(ct)
      setDeckProgress(dp)
      setUserProfile(up)
      setStreak(st)
    }).catch(err => console.error('Load error:', err))
      .finally(() => setLoading(false))
  }, [user])

  const refreshDecks = useCallback(() => {
    if (!user) return
    fetchDecks(user.id).then(setDecks).catch(console.error)
  }, [user])

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
    <GenerationProvider>
    <Layout>
      <Routes>
        <Route
          path="/"
          element={
            <Home
              user={user}
              userProfile={userProfile}
              decks={decks}
              studySessions={studySessions}
            />
          }
        />
        <Route
          path="/generate"
          element={<Generate user={user} onDeckCreated={refreshDecks} />}
        />
        <Route
          path="/library"
          element={<Library decks={decks} deckProgress={deckProgress} />}
        />
        <Route
          path="/library/:deckId"
          element={<DeckDetail user={user} onRefresh={refreshDecks} />}
        />
        <Route
          path="/study/:deckId"
          element={<Study user={user} />}
        />
        <Route
          path="/progress"
          element={
            <Progress
              studySessions={studySessions}
              decks={decks}
              streak={streak}
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
    </GenerationProvider>
  )
}
