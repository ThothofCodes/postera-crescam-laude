// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, publicApi } from '../utils/api';
import { useAuthStore } from '../store/authStore';

const HelpDesk = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('faq');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'general',
    priority: 'MEDIUM',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submittedTicket, setSubmittedTicket] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [troubleshootingGuides, setTroubleshootingGuides] = useState([]);
  const [knowledgeBase, setKnowledgeBase] = useState([]);

  // Fetch help desk data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch FAQs using public API
        const faqResponse = await publicApi.get('/help/faq');
        if (faqResponse.data.success) {
          setFaqs(faqResponse.data.data);
          setFilteredArticles(faqResponse.data.data);
        }
        
        // Fetch troubleshooting guides using public API
        const troubleshootResponse = await publicApi.get('/help/troubleshooting');
        if (troubleshootResponse.data.success) {
          setTroubleshootingGuides(troubleshootResponse.data.data);
        }
        
        // Fetch knowledge base using public API
        const kbResponse = await publicApi.get('/help/knowledge-base');
        if (kbResponse.data.success) {
          setKnowledgeBase(kbResponse.data.data);
        }
        
        // Fetch user tickets if authenticated
        const user = useAuthStore.getState().user;
        if (user) {
          try {
            const ticketsResponse = await api.get('/help/tickets');
            if (ticketsResponse.data.success) {
              setTickets(ticketsResponse.data.data);
            }
          } catch (error) {
            // User might not be authenticated, which is fine
            console.log('User not authenticated for tickets');
          }
        }
      } catch (error) {
        console.error('Error fetching help desk data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Search FAQs when query changes
  useEffect(() => {
    const searchFAQs = async () => {
      if (searchQuery.trim() === '') {
        setFilteredArticles(faqs);
      } else {
        try {
          // Call the API search endpoint
          const response = await publicApi.get(`/help/faq/search?q=${encodeURIComponent(searchQuery)}`);
          if (response.data.success) {
            setFilteredArticles(response.data.data);
          } else {
            // Fallback to local search if API fails
            const filtered = faqs.filter(item =>
              item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.answer.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredArticles(filtered);
          }
        } catch (error) {
          // Fallback to local search if API fails
          const filtered = faqs.filter(item =>
            item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.answer.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setFilteredArticles(filtered);
        }
      }
    };

    // Debounce the search to avoid excessive API calls
    const timeoutId = setTimeout(searchFAQs, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, faqs]);

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await publicApi.post('/tickets', {
        title: newTicket.subject,
        description: newTicket.description,
        category: newTicket.category,
        priority: newTicket.priority?.toUpperCase() || 'MEDIUM',
        departmentSlug: 'general',
      });
      if (response.data.success) {
        // Add the new ticket to the local list so it appears immediately
        const newEntry = {
          id: response.data.ticketId || Date.now(),
          subject: newTicket.subject,
          category: newTicket.category,
          priority: newTicket.priority,
          description: newTicket.description,
          status: 'open',
          createdAt: new Date().toISOString(),
          ticketId: response.data.ticketId,
        };
        setTickets((prev) => [newEntry, ...prev]);
        setSubmittedTicket(response.data);
        setNewTicket({ subject: '', category: 'general', priority: 'MEDIUM', description: '' });
        setShowTicketForm(false);
      } else {
        alert(response.data.message || 'Failed to submit ticket. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting ticket:', error);
      alert('Failed to submit ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFAQ = () => (
    <div className="help-content">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search for help..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>
      
      <div className="faq-categories">
        <div className="category-buttons">
          <button 
            className={`category-btn ${activeTab === 'faq' ? 'active' : ''}`}
            onClick={() => setActiveTab('faq')}
          >
            All FAQs
          </button>
          <button 
            className={`category-btn ${activeTab === 'troubleshooting' ? 'active' : ''}`}
            onClick={() => setActiveTab('troubleshooting')}
          >
            Troubleshooting
          </button>
          <button 
            className={`category-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
            onClick={() => setActiveTab('knowledge')}
          >
            Knowledge Base
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading help resources...</div>
      ) : activeTab === 'faq' && (
        <div className="faq-section">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list">
            {filteredArticles.map((item) => (
              <div key={item.id} className="faq-item">
                <div className="faq-question">
                  <h3>{item.question}</h3>
                </div>
                <div className="faq-answer">
                  <p>{item.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'troubleshooting' && (
        <div className="troubleshooting-section">
          <h2>Troubleshooting Guides</h2>
          <div className="guides-list">
            {troubleshootingGuides.map((guide) => (
              <div key={guide.id} className="guide-item">
                <h3>{guide.title}</h3>
                <ol className="steps-list">
                  {guide.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'knowledge' && (
        <div className="knowledge-section">
          <h2>Knowledge Base</h2>
          <div className="articles-list">
            {knowledgeBase.map((article) => (
              <div key={article.id} className="article-item">
                <h3>{article.title}</h3>
                <p>{article.content}</p>
                <div className="tags">
                  {article.tags.map((tag, index) => (
                    <span key={index} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderTickets = () => (
    <div className="tickets-content">
      <div className="ticket-actions">
        <button 
          className="btn-primary"
          onClick={() => setShowTicketForm(!showTicketForm)}
        >
          {showTicketForm ? 'Cancel' : 'Create New Ticket'}
        </button>
      </div>

      {showTicketForm && (
        <div className="ticket-form">
          <h3>Create Support Ticket</h3>
          <form onSubmit={handleTicketSubmit}>
            <div className="form-group">
              <label htmlFor="subject">Subject *</label>
              <input
                type="text"
                id="subject"
                value={newTicket.subject}
                onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                required
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={newTicket.category}
                  onChange={(e) => setNewTicket({...newTicket, category: e.target.value})}
                >
                  <option value="general">General Inquiry</option>
                  <option value="billing">Billing</option>
                  <option value="technical">Technical Issue</option>
                  <option value="account">Account</option>
                  <option value="orders">Orders</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="priority">Priority</label>
                <select
                  id="priority"
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({...newTicket, priority: e.target.value})}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Urgent</option>
                </select>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description"
                rows="5"
                value={newTicket.description}
                onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                required
              ></textarea>
            </div>
            
            <button 
              type="submit" 
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </form>
        </div>
      )}

      <div className="tickets-list">
        <h3>Your Support Tickets</h3>
        {tickets.length === 0 ? (
          <div className="no-tickets">
            <p>You haven't submitted any support tickets yet.</p>
            <p>Need help? Create a new ticket to get assistance from our support team.</p>
          </div>
        ) : (
          <div className="ticket-items">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="ticket-item">
                <div className="ticket-header">
                  <h4>{ticket.subject}</h4>
                  <span className={`status-badge ${ticket.status}`}>
                    {ticket.status}
                  </span>
                </div>
                <div className="ticket-details">
                  <p><strong>Category:</strong> {ticket.category}</p>
                  <p><strong>Priority:</strong> {ticket.priority}</p>
                  <p><strong>Description:</strong> {ticket.description.substring(0, 100)}...</p>
                  <p><strong>Created:</strong> {new Date(ticket.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const openChatHandler = () => {
    // Use the exposed function to open the chat widget directly
    if (window.openChatWidget && typeof window.openChatWidget === 'function') {
      window.openChatWidget();
    } else {
      // Fallback to the custom event
      const event = new CustomEvent('openChatWidget');
      window.dispatchEvent(event);

      // And try to find and click the chat widget button
      setTimeout(() => {
        const chatSelectors = [
          '.chat-widget-button', 
          '.chat-open-btn', 
          '.chat-toggle', 
          'button[aria-label*="chat" i]',
          'button[title*="chat" i]',
          '#chat-widget-btn'
        ];
        
        let chatButton = null;
        for (const selector of chatSelectors) {
          chatButton = document.querySelector(selector);
          if (chatButton) break;
        }
        
        if (chatButton) {
          chatButton.click();
        }
      }, 300);
    }
  };

  const renderContact = () => (
    <div className="contact-content">
      <div className="contact-options">
        <div className="contact-option">
          <h3>Live Chat</h3>
          <p>Chat with our support team in real-time for personalized assistance</p>
          <button 
            className="btn-primary"
            onClick={() => {
              // Navigate to the chat page when clicking the live chat button
              navigate('/chat');
            }}
          >
            Start Chat
          </button>
        </div>
        
        <div className="contact-option">
          <h3>Email Support</h3>
          <p>Send us an email and we'll respond within 24 hours</p>
          <a href="mailto:support@posteracrescamlaude.co.ke" className="btn-secondary">
            support@posteracrescamlaude.co.ke
          </a>
        </div>
        
        <div className="contact-option">
          <h3>Phone Support</h3>
          <p>Call our support team directly</p>
          <a href="tel:+254712345678" className="btn-secondary">
            +254 712 345 678
          </a>
        </div>
      </div>
      
      <div className="support-hours">
        <h3>Support Hours</h3>
        <p><strong>Monday - Friday:</strong> 8:00 AM - 8:00 PM EAT</p>
        <p><strong>Saturday:</strong> 9:00 AM - 5:00 PM EAT</p>
        <p><strong>Sunday:</strong> 10:00 AM - 4:00 PM EAT</p>
      </div>
      
      {/* Additional guidance for users */}
      <div style={{
        marginTop: '2rem',
        padding: '1.25rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-white)',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <h4 style={{
          margin: '0 0 0.75rem 0',
          color: 'var(--text-bright)',
          fontFamily: "'Poppins', sans-serif"
        }}>
          Need Immediate Assistance?
        </h4>
        <p style={{
          margin: '0 0 1rem 0',
          color: 'var(--text-secondary)',
          fontFamily: "'Inter', sans-serif"
        }}>
          If you can't find what you're looking for in our help resources, our friendly support agents are standing by to assist you.
        </p>
        <button 
          className="btn-primary"
          onClick={() => {
            // Navigate to the chat page when clicking the live chat button
            navigate('/chat');
          }}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem'
          }}
        >
          Chat with Support Now
        </button>
      </div>
    </div>
  );

  // ── Success overlay ──────────────────────────────────────────────
  const SuccessOverlay = () => {
    if (!submittedTicket) return null;
    const ticketId = submittedTicket.ticketId || submittedTicket._id || '—';
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(8,25,22,0.92)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'pcl-fade-in 0.3s ease',
      }}>
        <div style={{
          background: 'linear-gradient(160deg, #0F2620, #0B1F1B)',
          border: '1px solid rgba(43,182,163,0.3)',
          borderRadius: 16, padding: '3rem 2.5rem', maxWidth: 440, width: '90%',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(43,182,163,0.08)',
          animation: 'pcl-slide-up 0.4s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {/* Top glow line */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: 'linear-gradient(90deg, transparent, #39FF88, #2BB6A3, #39FF88, transparent)', opacity: 0.8 }} />
          {/* Animated checkmark circle */}
          <div style={{
            width: 88, height: 88, borderRadius: '50%', margin: '0 auto 1.5rem',
            background: 'rgba(57,255,136,0.08)', border: '3px solid #39FF88',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pcl-pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) 0.1s both',
          }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M10 20L17 27L30 13" stroke="#39FF88" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ strokeDasharray: 50, strokeDashoffset: 50, animation: 'pcl-draw 0.6s ease 0.4s forwards' }} />
            </svg>
          </div>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: 22, fontWeight: 700, color: '#39FF88',
            fontFamily: "'Rajdhani',sans-serif", letterSpacing: '0.06em' }}>
            Ticket Submitted!
          </h2>
          <p style={{ margin: '0 0 1.25rem', fontSize: 14, color: '#A9C4BE', lineHeight: 1.6 }}>
            Our support team will review your request and get back to you soon.
          </p>
          {/* Ticket ID card */}
          <div style={{
            background: 'rgba(43,182,163,0.06)', border: '1px solid rgba(43,182,163,0.2)',
            borderRadius: 10, padding: '1rem', marginBottom: '1.5rem',
          }}>
            <div style={{ fontSize: 9, color: '#6A8A82', letterSpacing: '0.15em',
              textTransform: 'uppercase', fontFamily: "'Share Tech Mono',monospace", marginBottom: 4 }}>
              Your Reference Number
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#EE6100',
              fontFamily: "'Share Tech Mono',monospace", letterSpacing: '0.08em' }}>
              {ticketId}
            </div>
          </div>
          <p style={{ margin: '0 0 1.5rem', fontSize: 12, color: '#6A8A82',
            fontFamily: "'Share Tech Mono',monospace" }}>
            Save this number to track your ticket status
          </p>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => { setSubmittedTicket(null); setActiveTab('tickets'); }}
              style={{ padding: '0.65rem 1.5rem', background: 'transparent', color: '#2BB6A3',
                border: '1px solid rgba(43,182,163,0.3)', borderRadius: 6, cursor: 'pointer',
                fontWeight: 600, fontSize: 13, transition: 'all 0.2s', fontFamily: "'Poppins',sans-serif" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(43,182,163,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >View My Tickets</button>
            <button onClick={() => setSubmittedTicket(null)}
              style={{ padding: '0.65rem 1.5rem', background: '#EE6100', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                fontWeight: 700, fontSize: 13, transition: 'all 0.2s', fontFamily: "'Poppins',sans-serif" }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(238,97,0,0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            >Done</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      padding: '2rem',
      background: 'var(--bg-void)',
      minHeight: '100vh',
      color: 'var(--text-primary)',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: 'var(--bg-panel)',
        borderRadius: '12px',
        padding: '2rem',
        border: '1px solid rgba(244,241,234,0.1)',
        boxShadow: '0 8px 32px #000000b3'
      }}>
        <h1 style={{
          fontSize: '2rem',
          margin: 0,
          color: 'var(--text-bright)',
          fontWeight: 700,
          marginBottom: '2rem',
          textAlign: 'center',
          fontFamily: "'Poppins', sans-serif"
        }}>
          Help Center
        </h1>

        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <button
            onClick={() => setActiveTab('faq')}
            style={{
              padding: '0.75rem 1.5rem',
              background: activeTab === 'faq' ? 'var(--grad-btn-red)' : 'transparent',
              color: activeTab === 'faq' ? 'white' : 'var(--text-secondary)',
              border: '1px solid var(--border-white)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: activeTab === 'faq' ? 'bold' : 'normal',
              transition: 'all 0.2s ease',
              fontFamily: "'Inter', sans-serif"
            }}
          >
            Self-Help
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            style={{
              padding: '0.75rem 1.5rem',
              background: activeTab === 'tickets' ? 'var(--grad-btn-red)' : 'transparent',
              color: activeTab === 'tickets' ? 'white' : 'var(--text-secondary)',
              border: '1px solid var(--border-white)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: activeTab === 'tickets' ? 'bold' : 'normal',
              transition: 'all 0.2s ease',
              fontFamily: "'Inter', sans-serif"
            }}
          >
            Support Tickets
          </button>
          <button
            onClick={() => setActiveTab('contact')}
            style={{
              padding: '0.75rem 1.5rem',
              background: activeTab === 'contact' ? 'var(--grad-btn-red)' : 'transparent',
              color: activeTab === 'contact' ? 'white' : 'var(--text-secondary)',
              border: '1px solid var(--border-white)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: activeTab === 'contact' ? 'bold' : 'normal',
              transition: 'all 0.2s ease',
              fontFamily: "'Inter', sans-serif"
            }}
          >
            Contact Us
          </button>
        </div>

        <div className="help-container">
          {activeTab === 'faq' && renderFAQ()}
          {activeTab === 'tickets' && renderTickets()}
          {activeTab === 'contact' && renderContact()}
        </div>
      </div>

      <SuccessOverlay />

      <style>{`
        @keyframes pcl-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pcl-slide-up { from { opacity: 0; transform: translateY(24px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes pcl-pop { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
        @keyframes pcl-draw { to { stroke-dashoffset: 0; } }
        .help-content {
          display: flex;
          flex-direction: column;
        }

        .loading {
          text-align: center;
          padding: 2rem;
          color: var(--text-muted);
        }

        .search-bar {
          margin-bottom: 1.5rem;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid rgba(244,241,234,0.1);
          border-radius: 8px;
          font-size: 1rem;
          background: var(--bg-card);
          color: var(--text-primary);
        }

        .faq-categories {
          margin-bottom: 1.5rem;
        }

        .category-buttons {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .category-btn {
          padding: 0.5rem 1rem;
          border: 1px solid rgba(244,241,234,0.1);
          background: var(--bg-card);
          color: var(--text-secondary);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: "'Inter', sans-serif";
        }

        .category-btn.active {
          background: var(--grad-btn-red);
          color: white;
          border-color: #EE61004d;
        }

        .faq-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .faq-item {
          border: 1px solid rgba(244,241,234,0.1);
          border-radius: 8px;
          padding: 1rem;
          background: var(--bg-card);
        }

        .faq-question h3 {
          margin: 0 0 0.5rem 0;
          color: var(--text-bright);
        }

        .faq-answer p {
          margin: 0;
          color: var(--text-secondary);
        }

        .guides-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .guide-item {
          border: 1px solid rgba(244,241,234,0.1);
          border-radius: 8px;
          padding: 1rem;
          background: var(--bg-card);
        }

        .guide-item h3 {
          margin: 0 0 1rem 0;
          color: var(--text-bright);
        }

        .steps-list {
          padding-left: 1.5rem;
          margin: 0;
        }

        .steps-list li {
          margin-bottom: 0.5rem;
          color: var(--text-secondary);
        }

        .articles-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .article-item {
          border: 1px solid rgba(244,241,234,0.1);
          border-radius: 8px;
          padding: 1rem;
          background: var(--bg-card);
        }

        .article-item h3 {
          margin: 0 0 0.5rem 0;
          color: var(--text-bright);
        }

        .article-item p {
          margin: 0 0 0.5rem 0;
          color: var(--text-secondary);
        }

        .tags {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .tag {
          background: #EE610026;
          color: var(--text-secondary);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.8rem;
          border: 1px solid #EE61004d;
        }

        .tickets-content {
          display: flex;
          flex-direction: column;
        }

        .ticket-actions {
          margin-bottom: 1.5rem;
          text-align: right;
        }

        .btn-primary {
          padding: 0.65rem 1.5rem;
          background: var(--grad-btn-red);
          color: #fff;
          letter-spacing: .02em;
          box-shadow: var(--shadow-red);
          transition: var(--transition);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-family: "'Inter', sans-serif";
        }

        .btn-primary:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
          box-shadow: 0 6px 24px #EE610066;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ticket-form {
          background: var(--bg-card);
          border: 1px solid rgba(244,241,234,0.1);
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .ticket-form h3 {
          margin-top: 0;
          color: var(--text-bright);
          margin-bottom: 1rem;
          font-family: "'Poppins', sans-serif";
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: bold;
          color: var(--text-bright);
          font-family: "'Inter', sans-serif";
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.65rem 0.9rem;
          border: 1px solid rgba(244,241,234,0.12);
          border-radius: 8px;
          background: #08191699;
          color: var(--text-primary);
          font-size: 14px;
          font-family: "'Inter', sans-serif";
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          background: #0F2620cc;
          border-color: #EE610080;
          box-shadow: 0 0 0 3px #EE61001a;
          outline: none;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .tickets-list h3 {
          color: var(--text-bright);
          margin-bottom: 1rem;
          font-family: "'Poppins', sans-serif";
        }

        .no-tickets {
          text-align: center;
          padding: 2rem;
          color: var(--text-secondary);
        }

        .ticket-items {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .ticket-item {
          border: 1px solid rgba(244,241,234,0.1);
          border-radius: 8px;
          padding: 1rem;
          background: var(--bg-card);
        }

        .ticket-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .ticket-header h4 {
          margin: 0;
          color: var(--text-primary);
          font-family: "'Inter', sans-serif";
        }

        .status-badge {
          letter-spacing: .04em;
          border: 1px solid;
          border-radius: 20px;
          padding: 3px 10px;
          font-family: "'Inter', sans-serif";
          font-size: 11px;
          font-weight: 600;
        }

        .status-badge.open {
          border-color: #2BB6A3;
          color: var(--text-blue);
          background: #2BB6A31a;
        }

        .status-badge.closed {
          border-color: #27ae60;
          color: #27ae60;
          background: #27ae601a;
        }

        .status-badge.pending {
          border-color: #f39c12;
          color: #f39c12;
          background: #f39c121a;
        }

        .contact-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .contact-option {
          border: 1px solid rgba(244,241,234,0.1);
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
          background: var(--bg-card);
        }

        .contact-option h3 {
          margin: 0 0 0.5rem 0;
          color: var(--text-bright);
          font-family: "'Poppins', sans-serif";
        }

        .contact-option p {
          margin: 0 0 1rem 0;
          color: var(--text-secondary);
        }

        .btn-secondary {
          display: inline-block;
          padding: 0.65rem 1.5rem;
          color: var(--white-soft);
          transition: var(--transition);
          background: transparent;
          border: 1px solid rgba(244,241,234,0.25);
          border-radius: 8px;
          text-decoration: none;
          cursor: pointer;
          font-weight: 600;
          font-family: "'Inter', sans-serif";
        }

        .btn-secondary:hover {
          color: #fff;
          background: rgba(244,241,234,0.08);
          border-color: rgba(244,241,234,0.5);
        }

        .support-hours {
          border: 1px solid rgba(244,241,234,0.1);
          border-radius: 8px;
          padding: 1.5rem;
          background: var(--bg-card);
        }

        .support-hours h3 {
          margin: 0 0 1rem 0;
          color: var(--text-bright);
          font-family: "'Poppins', sans-serif";
        }

        .support-hours p {
          margin: 0.5rem 0;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
};

export default HelpDesk;