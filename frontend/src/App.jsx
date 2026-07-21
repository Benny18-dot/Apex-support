import React, { useState, useEffect } from 'react';

function App() {
  // Authentication states
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  
  // Login form values
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  
  // Current active sub-pane: 'list' (dashboard), 'create' (submit form), 'detail' (ticket details)
  const [view, setView] = useState('list');
  
  // Data collections
  const [tickets, setTickets] = useState([]);
  const [currentTicket, setCurrentTicket] = useState(null);
  
  // Search parameters & filter selections
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Fields to log a new ticket
  const [newTicket, setNewTicket] = useState({
    customer_name: '',
    customer_email: '',
    subject: '',
    description: '',
    category: 'General Inquiry' // Initialized to default customer support option
  });
  
  // Inputs inside the ticket details view
  const [newNote, setNewNote] = useState('');
  const [detailStatus, setDetailStatus] = useState('');
  const [detailPriority, setDetailPriority] = useState('');
  const [detailAgent, setDetailAgent] = useState('');
  
  // App UI progress trackers
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // AI Copilot states
  const [copilotData, setCopilotData] = useState(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState(null);
  
  // Summary counts for stats cards
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    progress: 0,
    closed: 0
  });

  // Calculate statistics from the local collection
  const calculateDashboardStats = (list) => {
    const total = list.length;
    const open = list.filter(t => t.status === 'Open').length;
    const progress = list.filter(t => t.status === 'In Progress').length;
    const closed = list.filter(t => t.status === 'Closed').length;
    setStats({ total, open, progress, closed });
  };

  // Sign out user and wipe local variables
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setCurrentUser(null);
    setView('list');
    setTickets([]);
    setCurrentTicket(null);
  };

  // Build headers for authentication checks
  const getAuthHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Login handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      setError('Please fill in both fields.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || 'Authentication check failed.');
      }

      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      setToken(data.token);
      setCurrentUser(data.user);
      setError(null);
    } catch (err) {
      console.error('Sign-in error:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Fetch tickets matching filters & queries
  const fetchTicketsCatalog = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (statusFilter) queryParams.append('status', statusFilter);
      if (searchQuery) queryParams.append('search', searchQuery);

      const res = await fetch(`/api/tickets?${queryParams.toString()}`, {
        headers: getAuthHeaders()
      });

      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to retrieve ticket list.');
      }

      const data = await res.json();
      setTickets(data);

      // Refresh KPIs stats only on overall dashboard pulls
      if (!statusFilter && !searchQuery && currentUser?.role === 'Agent') {
        calculateDashboardStats(data);
      }
    } catch (err) {
      console.error('List retrieval failure:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch AI Copilot Suggestions
  const fetchCopilotData = async (ticketId) => {
    if (currentUser?.role !== 'Agent') return;
    try {
      setCopilotLoading(true);
      setCopilotError(null);
      setCopilotData(null);

      const res = await fetch(`/api/tickets/${ticketId}/copilot`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        throw new Error('AI Copilot request failed.');
      }

      const data = await res.json();
      setCopilotData(data);
    } catch (err) {
      console.error('Failed to load AI Copilot suggestions:', err);
      setCopilotError(err.message);
    } finally {
      setCopilotLoading(false);
    }
  };

  // Fetch ticket details
  const loadTicketDetails = async (ticketId) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/tickets/${ticketId}`, {
        headers: getAuthHeaders()
      });

      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to load details for ticket ${ticketId}.`);
      }

      const data = await res.json();
      setCurrentTicket(data);
      setDetailStatus(data.status);
      setDetailPriority(data.priority || 'Medium');
      setDetailAgent(data.assigned_agent || '');
      setView('detail');
      fetchCopilotData(ticketId); // Trigger AI Copilot analysis
    } catch (err) {
      console.error('Details retrieval failure:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger search requests as the user types
  useEffect(() => {
    if (!token) return;
    const fetchTimer = setTimeout(() => {
      fetchTicketsCatalog();
    }, 200);

    return () => clearTimeout(fetchTimer);
  }, [searchQuery, statusFilter, token]);

  // Dynamically update dashboard stats
  useEffect(() => {
    if (!token || currentUser?.role !== 'Agent') return;

    const loadGeneralStats = async () => {
      try {
        const res = await fetch('/api/tickets', { headers: getAuthHeaders() });
        if (res.ok) {
          const list = await res.json();
          calculateDashboardStats(list);
        }
      } catch (err) {
        console.error('Failed to update stats cards:', err);
      }
    };
    loadGeneralStats();
  }, [view, token]);


  // Submit a new ticket
  const handleTicketCreate = async (e) => {
    e.preventDefault();
    if (!newTicket.customer_name || !newTicket.customer_email || !newTicket.subject || !newTicket.description) {
      setError('Please specify all required fields.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(newTicket.customer_email)) {
      setError('Specify a valid email address.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newTicket)
      });

      if (!res.ok) {
        const details = await res.json();
        throw new Error(details.error || 'Failed to submit the support case.');
      }

      // Reset form variables
      setNewTicket({
        customer_name: '',
        customer_email: '',
        subject: '',
        description: '',
        category: 'General Inquiry'
      });

      setView('list');
      fetchTicketsCatalog();
    } catch (err) {
      console.error('Ticket submit failure:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Apply ticket adjustments (Note submission & state updates)
  const handleTicketUpdate = async (e) => {
    e.preventDefault();
    if (!currentTicket) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/tickets/${currentTicket.ticket_id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: detailStatus,
          notes: newNote,
          priority: currentUser.role === 'Agent' ? detailPriority : undefined,
          assigned_agent: currentUser.role === 'Agent' ? detailAgent : undefined
        })
      });

      if (!res.ok) {
        const details = await res.json();
        throw new Error(details.error || 'Failed to save case updates.');
      }

      setNewNote('');
      loadTicketDetails(currentTicket.ticket_id);
    } catch (err) {
      console.error('Update failure:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatFriendlyDate = (dateString) => {
    const config = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, config);
  };

  // Render Authentication screen
  if (!token || !currentUser) {
    return (
      <div className="auth-wrapper">
        <div className="login-card">
          <div className="login-header">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', marginBottom: '1.25rem', display: 'inline-block' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <h2 className="login-title">ApexSupport</h2>
            <p className="login-subtitle">Enterprise Customer Support Portal</p>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid #ef4444',
              color: '#f87171',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '1.5rem'
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          <form onSubmit={handleLoginSubmit}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Username</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter username"
                required
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="Enter password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={submitting}
            >
              {submitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Navigation Brand Header */}
      <header>
        <div 
          className="brand" 
          onClick={() => { setView('list'); setSearchQuery(''); setStatusFilter(''); }} 
          style={{ cursor: 'pointer' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', marginRight: '0.75rem' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <div>
            <h1 className="brand-name">ApexSupport</h1>
            <p className="brand-tagline">Customer Support Management Desk</p>
          </div>
        </div>

        <div className="user-profile-widget">
          <div className="user-profile-info">
            <div className="profile-username">{currentUser.username}</div>
            <div className="profile-role">{currentUser.role === 'Agent' ? 'Support Representative' : 'Customer Portal'}</div>
          </div>
          
          {currentUser.role === 'Customer' && view === 'list' && (
            <button className="btn btn-primary" onClick={() => { setView('create'); setError(null); }}>
              + Create Ticket
            </button>
          )}

          {view !== 'list' && (
            <button className="btn btn-secondary" onClick={() => { setView('list'); setError(null); }}>
              ← System Dashboard
            </button>
          )}

          <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '0.6rem 1rem' }}>
            Logout
          </button>
        </div>
      </header>

      {/* 1. TICKETS CATALOG LIST */}
      {view === 'list' && (
        <>
          {/* Summary KPIs (Support Agents only) */}
          {currentUser.role === 'Agent' && (
            <div className="stats-grid">
              <div className="stat-card total">
                <div className="stat-icon">📊</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.total}</span>
                  <span className="stat-label">Total Tickets</span>
                </div>
              </div>
              <div className="stat-card open">
                <div className="stat-icon">🟢</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.open}</span>
                  <span className="stat-label">Open Tickets</span>
                </div>
              </div>
              <div className="stat-card progress">
                <div className="stat-icon">🟡</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.progress}</span>
                  <span className="stat-label">In Progress</span>
                </div>
              </div>
              <div className="stat-card closed">
                <div className="stat-icon">⚪</div>
                <div className="stat-info">
                  <span className="stat-value">{stats.closed}</span>
                  <span className="stat-label">Closed</span>
                </div>
              </div>
            </div>
          )}

          {/* Filtering and search row */}
          <div className="controls-section">
            <div className="search-filter-group">
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder={currentUser.role === 'Agent' ? "Search tickets by customer name, ID, or subject..." : "Search my tickets..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select 
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          {/* Catalog Layout */}
          {loading && tickets.length === 0 ? (
            <div className="loading-wrapper">
              <div className="spinner"></div>
              <p>Loading ticket logs...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🎟️</span>
              <h3 className="empty-title">No support tickets found</h3>
              <p className="empty-description">
                {searchQuery || statusFilter 
                  ? "Adjust search keywords or choose a different status filter." 
                  : currentUser.role === 'Customer'
                    ? "You don't have any support tickets. Click 'Create Ticket' to log a case."
                    : "No support tickets recorded."}
              </p>
              {currentUser.role === 'Customer' && !searchQuery && !statusFilter && (
                <button className="btn btn-primary" onClick={() => setView('create')}>
                  Create Ticket
                </button>
              )}
            </div>
          ) : (
            <div className="tickets-list-wrapper">
              {/* Desktop view */}
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Customer</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(ticket => (
                    <tr key={ticket.ticket_id} onClick={() => loadTicketDetails(ticket.ticket_id)}>
                      <td style={{ fontWeight: '600', color: 'var(--primary)', fontFamily: 'monospace' }}>
                        {ticket.ticket_id}
                      </td>
                      <td>{ticket.customer_name}</td>
                      <td style={{ fontWeight: '500' }}>{ticket.subject}</td>
                      <td>
                        <span className={`status-badge ${
                          ticket.status === 'Open' ? 'open' : ticket.status === 'In Progress' ? 'in-progress' : 'closed'
                        }`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {formatFriendlyDate(ticket.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile layout */}
              <div className="tickets-grid">
                {tickets.map(ticket => (
                  <div 
                    className="ticket-mobile-card" 
                    key={ticket.ticket_id} 
                    onClick={() => loadTicketDetails(ticket.ticket_id)}
                  >
                    <div className="ticket-mobile-header">
                      <span className="ticket-id-tag">{ticket.ticket_id}</span>
                      <span className={`status-badge ${
                        ticket.status === 'Open' ? 'open' : ticket.status === 'In Progress' ? 'in-progress' : 'closed'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>
                    <h4 className="ticket-subject">{ticket.subject}</h4>
                    <div className="ticket-meta-row">
                      <span>{ticket.customer_name}</span>
                      <span>{formatFriendlyDate(ticket.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 2. SUBMIT TICKET FORM */}
      {view === 'create' && (
        <div className="form-container">
          <div className="form-header">
            <h2 className="form-title">Create Support Ticket</h2>
            <p className="form-description">Submit a new support ticket. It will be assigned to a specialist agent automatically.</p>
          </div>
          <form onSubmit={handleTicketCreate}>
            <div className="form-group">
              <label className="form-label" htmlFor="customer_name">Your Name</label>
              <input 
                type="text" 
                id="customer_name" 
                className="form-input" 
                placeholder="Enter your full name"
                required
                value={newTicket.customer_name}
                onChange={(e) => setNewTicket({ ...newTicket, customer_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="customer_email">Contact Email</label>
              <input 
                type="email" 
                id="customer_email" 
                className="form-input" 
                placeholder="Enter your email address"
                required
                value={newTicket.customer_email}
                onChange={(e) => setNewTicket({ ...newTicket, customer_email: e.target.value })}
              />
            </div>

            {/* Category routing selection */}
            <div className="form-group">
              <label className="form-label" htmlFor="ticket_category_select">Ticket Category</label>
              <select 
                id="ticket_category_select"
                className="filter-select"
                style={{ width: '100%' }}
                value={newTicket.category}
                onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
              >
                <option value="General Inquiry">General Inquiry</option>
                <option value="Technical Support">Technical Support</option>
                <option value="Billing">Billing</option>
                <option value="Bug Report">Bug Report</option>
                <option value="Feature Request">Feature Request</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="subject">Subject Title</label>
              <input 
                type="text" 
                id="subject" 
                className="form-input" 
                placeholder="Brief title summarizing your request"
                required
                value={newTicket.subject}
                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="description">Inquiry Details</label>
              <textarea 
                id="description" 
                className="form-textarea" 
                placeholder="Describe your issue or request in detail..."
                required
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
              />
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => { setView('list'); setError(null); }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Create Ticket'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. TICKET DETAIL VIEW */}
      {view === 'detail' && currentTicket && (
        <div className="detail-layout">
          {/* Main Info */}
          <div className="detail-main">
            <div className="detail-card">
              <div className="detail-header">
                <div className="detail-title-section">
                  <div className="detail-id-wrapper">
                    <span style={{ fontWeight: '700', color: 'var(--primary)', fontFamily: 'monospace', fontSize: '1.25rem' }}>
                      {currentTicket.ticket_id}
                    </span>
                    <span className={`status-badge ${
                      detailStatus === 'Open' ? 'open' : detailStatus === 'In Progress' ? 'in-progress' : 'closed'
                    }`}>
                      {detailStatus}
                    </span>
                    {currentTicket.category && (
                      <span className="category-tag">{currentTicket.category}</span>
                    )}
                    {detailPriority && (
                      <span className={`priority-badge ${detailPriority.toLowerCase()}`}>
                        {detailPriority}
                      </span>
                    )}
                  </div>
                  <h2 className="detail-title">{currentTicket.subject}</h2>
                </div>
              </div>

              {/* Customer info card */}
              <div className="customer-info-box">
                <div className="info-item">
                  <span className="info-label">Customer Name</span>
                  <span className="info-value">{currentTicket.customer_name}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Customer Email</span>
                  <span className="info-value" style={{ color: 'var(--primary)' }}>{currentTicket.customer_email}</span>
                </div>
                {currentUser.role === 'Agent' && (
                  <div className="info-item">
                    <span className="info-label">Assigned Representative</span>
                    <span className="info-value" style={{ color: '#f59e0b' }}>{detailAgent || currentTicket.assigned_agent}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="description-box">
                <h3 className="description-title">Ticket Description</h3>
                <div className="description-content">{currentTicket.description}</div>
              </div>
            </div>
          </div>

          {/* Action sidebar */}
          <div className="detail-sidebar">
            {/* AI Copilot card (Agents only) */}
            {currentUser.role === 'Agent' && (
              <div className="sidebar-card ai-copilot-card" style={{ border: '1px solid rgba(139, 92, 246, 0.3)', background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.7), rgba(88, 28, 135, 0.15))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a78bfa' }}>
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
                  </svg>
                  <h3 className="sidebar-title" style={{ margin: 0, color: '#c084fc' }}>AI Copilot Desk</h3>
                </div>

                {copilotLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 0' }}>
                    <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#c084fc' }}></div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Analyzing ticket tone & drafting response...</p>
                  </div>
                ) : copilotError ? (
                  <p style={{ fontSize: '0.8rem', color: '#f87171' }}>AI analysis failed. Please verify your Groq API key setup.</p>
                ) : copilotData ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Customer Tone:</span>
                      <span className={`status-badge ${
                        copilotData.sentiment === 'Frustrated' ? 'closed' : copilotData.sentiment === 'Positive' ? 'open' : 'in-progress'
                      }`} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                        {copilotData.sentiment}
                      </span>
                    </div>

                    <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.5rem 0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '0.25rem' }}>TL;DR SUMMARY</span>
                      <p style={{ fontSize: '0.8rem', margin: 0, lineHeight: '1.4' }}>{copilotData.summary}</p>
                    </div>

                    <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.5rem 0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '0.25rem' }}>SUGGESTED RESPONSE</span>
                      <p style={{ fontSize: '0.8rem', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.4', fontStyle: 'italic' }}>{copilotData.suggested_reply}</p>
                      
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ marginTop: '0.75rem', width: '100%', fontSize: '0.75rem', padding: '0.4rem', justifyContent: 'center' }}
                        onClick={() => setNewNote(copilotData.suggested_reply)}
                      >
                        📋 Copy to Reply Box
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No ticket active for AI analysis.</p>
                )}
              </div>
            )}

            {/* Control panel */}
            <div className="sidebar-card">
              <h3 className="sidebar-title">Manage Ticket</h3>
              <form onSubmit={handleTicketUpdate}>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Update Status</label>
                  <div className="status-options-grid">
                    <button 
                      type="button"
                      className={`status-option-btn ${detailStatus === 'Open' ? 'active open' : ''}`}
                      onClick={() => setDetailStatus('Open')}
                      disabled={currentUser.role === 'Customer'}
                    >
                      Open
                    </button>
                    <button 
                      type="button"
                      className={`status-option-btn ${detailStatus === 'In Progress' ? 'active in-progress' : ''}`}
                      onClick={() => setDetailStatus('In Progress')}
                      disabled={currentUser.role === 'Customer'}
                    >
                      In Progress
                    </button>
                    <button 
                      type="button"
                      className={`status-option-btn ${detailStatus === 'Closed' ? 'active closed' : ''}`}
                      onClick={() => setDetailStatus('Closed')}
                    >
                      Closed
                    </button>
                  </div>
                </div>

                {/* Priority and Agent controls for Support Representatives */}
                {currentUser.role === 'Agent' && (
                  <>
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                      <label className="form-label" htmlFor="priority_select">Adjust Priority</label>
                      <select 
                        id="priority_select"
                        className="filter-select"
                        style={{ width: '100%', padding: '0.6rem' }}
                        value={detailPriority}
                        onChange={(e) => setDetailPriority(e.target.value)}
                      >
                        <option value="Low">Low Priority</option>
                        <option value="Medium">Medium Priority</option>
                        <option value="High">High Priority</option>
                        <option value="Urgent">Urgent Priority</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                      <label className="form-label" htmlFor="agent_select">Reassign Representative</label>
                      <select 
                        id="agent_select"
                        className="filter-select"
                        style={{ width: '100%', padding: '0.6rem' }}
                        value={detailAgent}
                        onChange={(e) => setDetailAgent(e.target.value)}
                      >
                        <option value="agent">agent (General Desk)</option>
                        <option value="agent_tech">agent_tech (Technical Support)</option>
                        <option value="agent_billing">agent_billing (Billing Specialist)</option>
                        <option value="agent_general">agent_general (General Desk)</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" htmlFor="timeline_action_note">
                    {currentUser.role === 'Agent' ? 'Add Support Update Note' : 'Add Note / Response'}
                  </label>
                  <textarea 
                    id="timeline_action_note" 
                    className="form-textarea" 
                    placeholder="Log status changes, remarks, or comments..."
                    style={{ minHeight: '100px' }}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={submitting}
                >
                  {submitting ? 'Saving Updates...' : 'Save Updates'}
                </button>
              </form>
            </div>

            {/* Timeline updates history */}
            <div className="sidebar-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 className="sidebar-title">Action History ({currentTicket.notes ? currentTicket.notes.length : 0})</h3>
              
              <div className="notes-timeline">
                {currentTicket.notes && currentTicket.notes.length > 0 ? (
                  currentTicket.notes.map((note, index) => (
                    <div className="note-bubble" key={note.id || index}>
                      <div className="note-header">
                        <span className="note-author">Update Note</span>
                        <span>{formatFriendlyDate(note.created_at)}</span>
                      </div>
                      <div className="note-text">{note.note_text}</div>
                    </div>
                  ))
                ) : (
                  <div className="no-notes-placeholder">
                    No timeline notes recorded on this ticket yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
