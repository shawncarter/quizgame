import { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import './SocketTester.css';

/**
 * Socket tester component
 * Used to test real-time communication
 */
const SocketTester = () => {
  const { isConnected, connectToNamespace, registerEvent, emitEvent } = useSocket();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [namespace, setNamespace] = useState('test');
  const [selectedNamespace, setSelectedNamespace] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');

  // Set up event listeners when namespace changes
  useEffect(() => {
    let unregisterMessage = null;
    let unregisterWelcome = null;
    let unregisterStats = null;
    
    if (selectedNamespace && isConnected) {
      // Connect to namespace
      connectToNamespace(selectedNamespace, { testUser: true });
      setConnectionStatus('Connecting...');
      
      // Register for welcome message
      unregisterWelcome = registerEvent(selectedNamespace, 'test:welcome', (data) => {
        setConnectionStatus('Connected');
        setMessages(prev => [...prev, { 
          timestamp: new Date().toLocaleTimeString(),
          text: data.message,
          sender: 'server'
        }]);
      });
      
      // Register for message events
      unregisterMessage = registerEvent(selectedNamespace, 'test:message', (data) => {
        setMessages(prev => [...prev, { 
          timestamp: new Date().toLocaleTimeString(),
          text: data.message,
          sender: data.sender || 'server'
        }]);
      });
      
      // Register for stats events
      unregisterStats = registerEvent(selectedNamespace, 'test:stats', (data) => {
        setMessages(prev => [...prev, { 
          timestamp: new Date().toLocaleTimeString(),
          text: `Connected clients: ${data.connections}, Server uptime: ${Math.round(data.uptime / 60)} minutes`,
          sender: 'server-stats'
        }]);
      });
      
      // Send a join message
      emitEvent(selectedNamespace, 'test:join', { 
        sender: 'client',
        timestamp: Date.now()
      });
    }
    
    // Clean up on unmount or namespace change
    return () => {
      if (unregisterMessage) unregisterMessage();
      if (unregisterWelcome) unregisterWelcome();
      if (unregisterStats) unregisterStats();
      setConnectionStatus('');
    };
  }, [selectedNamespace, isConnected, connectToNamespace, registerEvent, emitEvent]);

  const handleNamespaceConnect = (e) => {
    e.preventDefault();
    if (namespace) {
      setSelectedNamespace(namespace);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputMessage && selectedNamespace) {
      // Add message to local state
      setMessages(prev => [...prev, { 
        timestamp: new Date().toLocaleTimeString(),
        text: inputMessage,
        sender: 'me'
      }]);
      
      // Send message via socket
      emitEvent(selectedNamespace, 'test:message', { 
        message: inputMessage,
        sender: 'client',
        timestamp: Date.now()
      });
      
      // Clear input
      setInputMessage('');
    }
  };
  
  const handleTestCommand = (command) => {
    if (selectedNamespace) {
      // Send test command
      emitEvent(selectedNamespace, 'test:command', { 
        command,
        timestamp: Date.now()
      });
      
      // Add message about the command
      setMessages(prev => [...prev, { 
        timestamp: new Date().toLocaleTimeString(),
        text: `Sending command: ${command}`,
        sender: 'me'
      }]);
    }
  };

  return (
    <div className="socket-tester">
      <h3>Socket.io Tester</h3>
      <div className="connection-status">
        Server status: {isConnected ? <span className="connected">Connected</span> : <span className="disconnected">Disconnected</span>}
      </div>
      
      {!selectedNamespace ? (
        <form onSubmit={handleNamespaceConnect} className="namespace-form">
          <input
            type="text"
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            placeholder="Enter namespace (test, game, player, host)"
            disabled={!isConnected}
          />
          <button type="submit" disabled={!isConnected || !namespace}>
            Connect
          </button>
        </form>
      ) : (
        <>
          <div className="namespace-info">
            Connected to: <strong>{selectedNamespace}</strong>
            {connectionStatus && <span className="namespace-status"> ({connectionStatus})</span>}
            <button 
              onClick={() => setSelectedNamespace('')} 
              className="disconnect-btn"
            >
              Disconnect
            </button>
          </div>
          
          <div className="test-commands">
            <button onClick={() => handleTestCommand('ping')}>Ping</button>
            <button onClick={() => handleTestCommand('stats')}>Get Stats</button>
          </div>
          
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="no-messages">No messages yet</div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`message ${msg.sender === 'me' ? 'sent' : 'received'}`}>
                  <span className="timestamp">{msg.timestamp}</span>
                  <span className="sender">{msg.sender === 'me' ? 'You' : msg.sender}:</span>
                  <span className="text">{msg.text}</span>
                </div>
              ))
            )}
          </div>
          
          <form onSubmit={handleSendMessage} className="message-form">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message to send..."
              disabled={!isConnected}
            />
            <button type="submit" disabled={!isConnected || !inputMessage}>
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default SocketTester;
