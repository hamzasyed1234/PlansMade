import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import WelcomePage from './components/WelcomePage';
import LobbyPage from './components/LobbyPage';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/lobby/:sessionId" element={<LobbyPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;