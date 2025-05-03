import { useSocket } from '../../context/SocketContext';
import './ConnectionStatus.css';

/**
 * Connection status component
 * Displays the current connection status to the socket server
 */
const ConnectionStatus = () => {
  const { isConnected, socketError } = useSocket();
  
  return (
    <div className="connection-status">
      <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      {socketError && (
        <div className="error-message">
          Error: {socketError}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
