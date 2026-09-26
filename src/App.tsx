import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import ProcessDocument from './pages/ProcessDocument'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/document" element={<ProcessDocument />} />
    </Routes>
  )
}

export default App
