// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../../../hooks/useChat';
import { getSocketAuthToken } from '../../../hooks/useSocket';
import toast from 'react-hot-toast';

const MessagesPage = () => {
  const authToken = getSocketAuthToken() || localStorage.getItem('adminToken');
  
  const [tokenValid, setTokenValid] = useState(!!authToken);
  
  useEffect(() => {
    if (!authToken || typeof authToken !== 'string' || !authToken.includes('.')) {
      setTokenValid(false);
      return;
    }
    try {
      const parts = authToken.split('.');
      if (parts.length !== 3) { setTokenValid(false); return; }
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        setTokenValid(false);
        return;
      }
      setTokenValid(true);
    } catch {
      setTokenValid(false);
    }
  }, [authToken]);

  const { 
    connected, 
    adminOnline, 
    messages, 
    conversations,
    currentConversation,
    joinConversation,
    getMessagesForConversation,
    sendMessageToCustomer, // Fixed function name
    setCurrentConversation,
    setMessages,
    socket
  } = useChat({ authToken: tokenValid ? authToken : null });
  
  const [newMessage, setNewMessage] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [notificationChannel, setNotificationChannel] = useState('sms'); // Default to SMS
  const [conversationMessages, setConversationMessages] = useState({});
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      // Silent fail if element not available
    }
  }, [messages, currentConversation]);

  // Update conversation messages when currentConversation changes
  useEffect(() => {
    if (currentConversation) {
      const filteredMessages = messages.filter(msg => 
        msg.conversationId === currentConversation || 
        msg.conversationId === `conversation-${currentConversation}` ||
        msg.conversationId === currentConversation.replace('conversation-', '')
      );
      setConversationMessages(prev => ({
        ...prev,
        [currentConversation]: filteredMessages
      }));
      
      // Also fetch fresh messages from server
      getMessagesForConversation(currentConversation);
    }
  }, [messages, currentConversation, getMessagesForConversation]);

  // Listen for new messages from socket to update conversationMessages state
  useEffect(() => {
    if (socket) {
      const handleNewMessage = (data) => {
        const { conversationId, message } = data;
        if (conversationId === currentConversation) {
          setConversationMessages(prev => ({
            ...prev,
            [currentConversation]: [...(prev[currentConversation] || []), message]
          }));
        }
      };
      
      socket.on('new-chat-message', handleNewMessage);
      
      return () => {
        if (socket) {
          socket.off('new-chat-message', handleNewMessage);
        }
      };
    }
  }, [socket, currentConversation]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentConversation) return;
    
    // Extract guestId from various possible conversation ID formats
    let guestId = currentConversation.replace('conversation-guest-', '');
    if (guestId === currentConversation) {
      guestId = currentConversation.replace('guest-', '');
    }
    if (guestId === currentConversation) {
      guestId = currentConversation;
    }
    
    // Send the message - using the correct function name
    sendMessageToCustomer(currentConversation, newMessage, guestId);
    
    // Add the message to the conversation messages state
    setConversationMessages(prev => ({
      ...prev,
      [currentConversation]: [
        ...(prev[currentConversation] || []),
        {
          message: newMessage,
          timestamp: new Date().toISOString(),
          direction: 'outgoing',
          senderType: 'admin',
          _id: `temp-${Date.now()}`
        }
      ]
    }));
    
    setNewMessage('');
  };

  const handleSelectConversation = (conversationId) => {
    joinConversation(conversationId);
    setSelectedConversation(conversationId);
    setCurrentConversation(conversationId);
  };

  // Get messages for current conversation
  const currentMessages = conversationMessages[currentConversation] || [];

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Function to send notification via selected channel
  const sendNotification = async (conversationId, message) => {
    try {
      // Extract guestId from various possible conversation ID formats
      let guestId = conversationId.replace('conversation-guest-', '');
      if (guestId === conversationId) {
        guestId = conversationId.replace('guest-', '');
      }
      if (guestId === conversationId) {
        guestId = conversationId;
      }
      
      // Determine which endpoint to use based on selected channel
      let endpoint = '';
      if (notificationChannel === 'whatsapp') {
        endpoint = `/notifications/send-whatsapp`;
      } else if (notificationChannel === 'sms') {
        endpoint = `/notifications/send-sms`;
      } else {
        endpoint = `/notifications/send`;
      }
      
      await api.post(endpoint, {
        guestId,
        message,
        channel: notificationChannel
      });
      
      toast.success(`${notificationChannel.toUpperCase()} notification sent`);
    } catch (error) {
      toast.error(`Failed to send ${notificationChannel} notification`);
    }
  };

  if (!tokenValid) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'var(--bg-void)', 
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem'
      }}>
        <div style={{ 
          textAlign: 'center', 
          color: '#F4F1EA',
          background: 'var(--bg-card)',
          padding: '2rem',
          borderRadius: '12px',
          border: '1px solid rgba(240, 238, 255, 0.1)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h2>Session Expired</h2>
          <p>Please log in again to continue using the chat system.</p>
          <button 
            onClick={() => window.location.href = '/login'}
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv => 
    conv.guestId?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'var(--bg-void)', 
      padding: '2rem',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ 
                color: '#F4F1EA', 
                fontSize: '2rem', 
                fontWeight: 700, 
                marginBottom: '0.5rem',
                fontFamily: "'Poppins', sans-serif"
              }}>
                Customer Support Chat
              </h1>
              <p style={{ color: '#A9C4BE', fontSize: '1rem' }}>
                Manage customer conversations and provide support
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label htmlFor="notification-channel" style={{ color: '#A9C4BE', fontSize: '0.875rem' }}>Channel:</label>
                <select
                  id="notification-channel"
                  value={notificationChannel}
                  onChange={(e) => setNotificationChannel(e.target.value)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: 'rgba(14,10,20,0.6)',
                    border: '1px solid rgba(244,241,234,0.12)',
                    borderRadius: '4px',
                    color: '#F4F1EA',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <span style={{ 
                padding: '0.5rem 1rem', 
                borderRadius: '20px', 
                fontSize: '0.875rem',
                background: connected ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 51, 102, 0.2)',
                color: connected ? '#EE6100' : '#ff3366'
              }}>
                {connected ? '🟢 Connected' : '🔴 Disconnected'}
              </span>
              <span style={{ 
                padding: '0.5rem 1rem', 
                borderRadius: '20px', 
                fontSize: '0.875rem',
                background: adminOnline ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 51, 102, 0.2)',
                color: adminOnline ? '#EE6100' : '#ff3366'
              }}>
                {adminOnline ? '👨‍💼 Admin Available' : '😴 No Admin Available'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '1.5rem', 
          height: 'calc(100vh - 200px)',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid rgba(240, 238, 255, 0.1)',
          overflow: 'hidden'
        }}>
          {/* Conversations List */}
          <div style={{ 
            width: '300px', 
            borderRight: '1px solid rgba(240, 238, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid rgba(240, 238, 255, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ color: '#F4F1EA', fontWeight: 600, margin: 0 }}>Conversations</h3>
                <span style={{ 
                  padding: '0.25rem 0.5rem', 
                  borderRadius: '12px', 
                  fontSize: '0.75rem',
                  background: connected ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 51, 102, 0.2)',
                  color: connected ? '#EE6100' : '#ff3366'
                }}>
                  {connected ? 'Live' : 'Offline'}
                </span>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(14,10,20,0.6)',
                    border: '1px solid rgba(244,241,234,0.12)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredConversations.length > 0 ? (
                filteredConversations.map((conv, index) => {
                  // Normalize conversation ID to handle different formats
                  const normalizedConvId = conv.conversationId.startsWith('conversation-') 
                    ? conv.conversationId 
                    : `conversation-${conv.conversationId}`;
                  
                  const convMessages = conversationMessages[normalizedConvId] || 
                                      messages.filter(msg => 
                                        msg.conversationId === normalizedConvId || 
                                        msg.conversationId === conv.conversationId ||
                                        msg.conversationId === `conversation-${conv.conversationId}`
                                      );
                  const lastMessage = convMessages.length > 0 ? convMessages[convMessages.length - 1] : null;
                  
                  return (
                    <div
                      key={`${normalizedConvId}-${index}`} // Added index to ensure unique key
                      onClick={() => handleSelectConversation(normalizedConvId)}
                      className={`p-3 cursor-pointer transition-colors ${
                        currentConversation === normalizedConvId 
                          ? 'background: rgba(0, 212, 255, 0.1); border-left: 3px solid #EE6100;' 
                          : 'hover:bg-gray-800'
                      }`}
                      style={{
                        backgroundColor: currentConversation === normalizedConvId 
                          ? 'rgba(0, 212, 255, 0.1)' 
                          : 'transparent',
                        borderLeft: currentConversation === normalizedConvId 
                          ? '3px solid #EE6100' 
                          : 'none',
                        cursor: 'pointer',
                        padding: '1rem',
                        borderBottom: '1px solid rgba(240, 238, 255, 0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <div style={{ fontWeight: '600', color: '#F4F1EA' }}>
                          Guest: {conv.guestId?.substring(0, 8) || normalizedConvId.replace('conversation-guest-', '').substring(0, 8)}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#A9C4BE' }}>
                          {conv.timestamp ? new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </span>
                      </div>
                      <div style={{ 
                        fontSize: '0.875rem', 
                        color: '#A9C4BE', 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        marginBottom: '0.25rem'
                      }}>
                        {lastMessage?.message || conv.lastMessage}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%', 
                          background: 'rgba(0, 212, 255, 0.8)',
                          marginRight: '0.5rem'
                        }}></span>
                        <span style={{ fontSize: '0.75rem', color: '#EE6100' }}>
                          Active now
                        </span>
                      </div>
                      
                      {/* Notification button for this conversation */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sendNotification(normalizedConvId, `Hello, this is a ${notificationChannel} notification from Postera Crescam Laude.`);
                        }}
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.25rem 0.5rem',
                          background: 'rgba(0, 212, 255, 0.2)',
                          color: '#EE6100',
                          border: '1px solid rgba(0, 212, 255, 0.3)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          width: '100%'
                        }}
                      >
                        Send {notificationChannel.toUpperCase()}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div style={{ 
                  padding: '2rem', 
                  textAlign: 'center', 
                  color: 'var(--text-muted)',
                  fontStyle: 'italic'
                }}>
                  {searchFilter ? 'No conversations match your search' : 'No active conversations'}
                </div>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {currentConversation ? (
              <>
                {/* Chat Header */}
                <div style={{ 
                  padding: '1rem', 
                  borderBottom: '1px solid rgba(240, 238, 255, 0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <h3 style={{ color: '#F4F1EA', fontWeight: 600, margin: 0 }}>
                      Chat with Guest: {currentConversation.replace('conversation-guest-', '').substring(0, 8)}
                    </h3>
                    <p style={{ color: '#A9C4BE', fontSize: '0.875rem', margin: 0 }}>
                      {currentMessages.length} messages • {connected ? 'Connected' : 'Disconnected'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {/* Notification button for current conversation */}
                    <button
                      onClick={() => sendNotification(currentConversation, `Hello, this is a ${notificationChannel} notification from Postera Crescam Laude.`)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'rgba(0, 212, 255, 0.2)',
                        color: '#EE6100',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        cursor: 'pointer'
                      }}
                    >
                      Send {notificationChannel.toUpperCase()}
                    </button>
                    <span style={{ 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '12px', 
                      fontSize: '0.75rem',
                      background: 'rgba(0, 212, 255, 0.2)',
                      color: '#EE6100'
                    }}>
                      Active
                    </span>
                  </div>
                </div>

                {/* Messages Container */}
                <div style={{ 
                  flex: 1, 
                  padding: '1rem', 
                  overflowY: 'auto',
                  background: 'rgba(14,10,20,0.3)'
                }}>
                  {currentMessages.length > 0 ? (
                    currentMessages.map((msg, index) => (
                      <div
                        key={`${msg._id || index}-${msg.timestamp || Date.now()}`}
                        style={{
                          marginBottom: '1rem',
                          display: 'flex',
                          justifyContent: msg.senderType === 'admin' ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '70%',
                            padding: '0.75rem 1rem',
                            borderRadius: '12px',
                            background: msg.senderType === 'admin' 
                              ? 'linear-gradient(135deg, rgba(255,51,102,0.15), rgba(255,0,102,0.1))' 
                              : 'linear-gradient(135deg, rgba(238,97,0,0.15), rgba(0,180,255,0.1))',
                            border: msg.senderType === 'admin' 
                              ? '1px solid rgba(255,51,102,0.2)' 
                              : '1px solid rgba(238,97,0,0.2)',
                            color: 'var(--text-primary)',
                            fontSize: '0.875rem',
                          }}
                        >
                          <div>{msg.message}</div>
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: 'var(--text-muted)', 
                            marginTop: '0.25rem',
                            textAlign: 'right'
                          }}>
                            {msg.createdAt || msg.timestamp 
                              ? new Date(msg.createdAt || msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      color: 'var(--text-muted)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💬</div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#F4F1EA' }}>
                        Ready to assist
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#A9C4BE' }}>
                        Waiting for customer message...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div style={{ 
                  padding: '1rem', 
                  borderTop: '1px solid rgba(240, 238, 255, 0.1)',
                  backgroundColor: 'rgba(14,10,20,0.6)'
                }}>
                  <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        background: 'rgba(14,10,20,0.8)',
                        border: '1px solid rgba(244,241,234,0.12)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || !currentConversation}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: 'linear-gradient(135deg, #EE6100, #00b4ff)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: newMessage.trim() && currentConversation ? 'pointer' : 'not-allowed',
                        opacity: newMessage.trim() && currentConversation ? 1 : 0.6,
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}
                    >
                      Send
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '2rem'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💬</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem', color: '#F4F1EA' }}>
                  Select a conversation
                </div>
                <div style={{ fontSize: '1rem', color: '#A9C4BE', maxWidth: '400px' }}>
                  Choose a conversation from the left panel to start chatting with customers
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;