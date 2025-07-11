import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useContext } from 'react';
import ConnectionStatus from '../components/common/ConnectionStatus';
import SocketTester from '../components/common/SocketTester';
import HostedGames from '../components/Host/HostedGames';
import { usePlayer } from '../context/PlayerContext';
import { SocketContext } from '../context/SocketContext';
import './Home.css';

/**
 * Home page component
 * Entry point for the application
 */
const Home = () => {
  const { isLoggedIn, player } = usePlayer();
  const { needsRegistration, setNeedsRegistration } = useContext(SocketContext);
  const navigate = useNavigate();

  // Redirect to registration page if needed, but only if not already logged in
  useEffect(() => {
    if (needsRegistration && !isLoggedIn) {
      // Reset the flag to prevent infinite loops
      setNeedsRegistration(false);
      navigate('/register');
    }
  }, [needsRegistration, navigate, isLoggedIn, setNeedsRegistration]);

  return (
    <div className="home-container">
      <h2>Welcome to QuizGame!</h2>

      <ConnectionStatus />

      <div className="player-status">
        {isLoggedIn ? (
          <div className="player-welcome">
            <p>Welcome back, <strong>{player?.name}</strong>!</p>
            <Link to="/profile" className="profile-link">View Profile</Link>
          </div>
        ) : (
          <div className="player-register">
            <p>Create a player profile to track your game stats!</p>
            <Link to="/register" className="register-link">Register Now</Link>
          </div>
        )}
      </div>

      <div className="actions">
        <Link to="/host" className="action-button host">
          Host a Game
        </Link>
        <Link to="/join" className="action-button join">
          Join a Game
        </Link>
        <Link to="/scan" className="action-button scan">
          Scan QR Code
        </Link>
        <Link to="/players" className="action-button players">
          Player Lobby
        </Link>
      </div>

      {/* Display hosted games if the user is logged in */}
      {isLoggedIn && <HostedGames />}

      <div className="info-section">
        <h3>About QuizGame</h3>
        <p>
          QuizGame is an interactive quiz platform where players can test their knowledge
          across various topics in real-time. Host a game for your friends or join an existing
          session with a game code or by scanning a QR code.
        </p>
      </div>

      {/* Socket tester - will be removed in production */}
      <div className="debug-section">
        <details>
          <summary>Socket.io Tester (Development Only)</summary>
          <SocketTester />
        </details>
      </div>
    </div>
  );
};

export default Home;
