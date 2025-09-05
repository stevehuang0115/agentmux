import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Clock, Play, Pause, CheckCircle } from 'lucide-react';
import { FormPopup, FormGroup, FormLabel, FormInput, FormTextarea, FormHelp, Dropdown } from '../components/UI';

interface ScheduledMessage {
  id: string;
  name: string;
  targetTeam: string;
  targetProject?: string;
  message: string;
  delayAmount: number;
  delayUnit: 'seconds' | 'minutes' | 'hours';
  isRecurring: boolean;
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
}

interface ScheduledMessageFormData {
  name: string;
  targetTeam: string;
  targetProject: string;
  message: string;
  delayAmount: string;
  delayUnit: 'seconds' | 'minutes' | 'hours';
  isRecurring: boolean;
}

interface MessageDeliveryLog {
  id: string;
  scheduledMessageId: string;
  messageName: string;
  targetTeam: string;
  targetProject?: string;
  message: string;
  sentAt: string;
  success: boolean;
  error?: string;
}

export const ScheduledCheckins: React.FC = () => {
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<MessageDeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [formData, setFormData] = useState<ScheduledMessageFormData>({
    name: '',
    targetTeam: 'orchestrator',
    targetProject: '',
    message: '',
    delayAmount: '5',
    delayUnit: 'minutes',
    isRecurring: false
  });

  useEffect(() => {
    loadScheduledMessages();
    loadDeliveryLogs();
  }, []);

  const loadScheduledMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scheduled-messages');
      if (response.ok) {
        const result = await response.json();
        setScheduledMessages(result.data || []);
      }
    } catch (error) {
      console.error('Error loading scheduled messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveryLogs = async () => {
    try {
      const response = await fetch('/api/message-delivery-logs');
      if (response.ok) {
        const result = await response.json();
        setDeliveryLogs(result.data || []);
      }
    } catch (error) {
      console.error('Error loading delivery logs:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingMessage 
        ? `/api/scheduled-messages/${editingMessage.id}`
        : '/api/scheduled-messages';
      
      const method = editingMessage ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadScheduledMessages();
        await loadDeliveryLogs();
        handleCloseModal();
      } else {
        const error = await response.text();
        alert('Failed to save scheduled message: ' + error);
      }
    } catch (error) {
      console.error('Error saving scheduled message:', error);
      alert('Failed to save scheduled message: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/scheduled-messages/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadScheduledMessages();
      } else {
        const error = await response.text();
        alert('Failed to delete scheduled message: ' + error);
      }
    } catch (error) {
      console.error('Error deleting scheduled message:', error);
      alert('Failed to delete scheduled message: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/scheduled-messages/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        await loadScheduledMessages();
      } else {
        const error = await response.text();
        alert('Failed to toggle scheduled message: ' + error);
      }
    } catch (error) {
      console.error('Error toggling scheduled message:', error);
      alert('Failed to toggle scheduled message: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleRunNow = async (id: string, name: string) => {
    if (!window.confirm(`Run "${name}" now?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/scheduled-messages/${id}/run`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Scheduled message executed successfully!');
        await loadScheduledMessages();
        await loadDeliveryLogs();
      } else {
        const error = await response.text();
        alert('Failed to run scheduled message: ' + error);
      }
    } catch (error) {
      console.error('Error running scheduled message:', error);
      alert('Failed to run scheduled message: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleEdit = (message: ScheduledMessage) => {
    setEditingMessage(message);
    setFormData({
      name: message.name,
      targetTeam: message.targetTeam,
      targetProject: message.targetProject || '',
      message: message.message,
      delayAmount: message.delayAmount.toString(),
      delayUnit: message.delayUnit,
      isRecurring: message.isRecurring
    });
    setShowCreateModal(true);
  };

  const handleCreate = () => {
    setEditingMessage(null);
    setFormData({
      name: '',
      targetTeam: 'orchestrator',
      targetProject: '',
      message: '',
      delayAmount: '5',
      delayUnit: 'minutes',
      isRecurring: false
    });
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingMessage(null);
    setFormData({
      name: '',
      targetTeam: 'orchestrator',
      targetProject: '',
      message: '',
      delayAmount: '5',
      delayUnit: 'minutes',
      isRecurring: false
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'text-green-600' : 'text-gray-400';
  };

  // Filter messages based on active/completed status
  const activeMessages = scheduledMessages.filter(msg => msg.isActive);
  const completedMessages = scheduledMessages.filter(msg => !msg.isActive);

  if (loading) {
    return (
      <div className="page scheduled-checkins-page">
        <div className="loading-spinner"></div>
        <p>Loading scheduled check-ins...</p>
      </div>
    );
  }

  return (
    <div className="page scheduled-checkins-page">
      <div className="page-header">
        <div className="header-info">
          <h1 className="page-title">Scheduled Messages</h1>
          <p className="page-description">
            Create and manage scheduled messages for teams and projects
          </p>
        </div>
        
        <button 
          className="primary-button"
          onClick={handleCreate}
        >
          <Plus className="button-icon" />
          New Scheduled Message
        </button>
      </div>

      {/* Tabs */}
      <div className="scheduled-messages-tabs">
        <button 
          className={`tab ${activeTab === 'active' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Messages ({activeMessages.length})
        </button>
        <button 
          className={`tab ${activeTab === 'completed' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed Messages ({completedMessages.length})
        </button>
      </div>

      <div className="scheduled-messages-content">
        {activeTab === 'active' ? (
          activeMessages.length > 0 ? (
            <div className="scheduled-messages-grid">
              {activeMessages.map((message) => (
                <div key={message.id} className="scheduled-message-card">
                  <div className="message-header">
                    <div className="message-info">
                      <h3 className="message-name">{message.name}</h3>
                      <div className="message-status">
                        <div className="status-indicator active">
                          <CheckCircle className="status-icon" />
                          Active
                        </div>
                      </div>
                    </div>
                    
                    <div className="message-actions">
                      <button
                        className="action-btn toggle-btn"
                        onClick={() => handleToggleActive(message.id, message.isActive)}
                        title="Disable"
                      >
                        <Pause size={16} />
                      </button>
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEdit(message)}
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="action-btn run-btn"
                        onClick={() => handleRunNow(message.id, message.name)}
                        title="Run now"
                      >
                        <Play size={16} />
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(message.id, message.name)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="message-content">
                    <div className="message-target">
                      <strong>Target Team:</strong> {message.targetTeam}
                      {message.targetProject && (
                        <><br/><strong>Target Project:</strong> {message.targetProject}</>
                      )}
                    </div>
                    
                    <div className="message-text">
                      <strong>Message:</strong>
                      <div className="message-preview">{message.message}</div>
                    </div>
                    
                    <div className="message-schedule">
                      <strong>Schedule:</strong>
                      {message.isRecurring ? 'Recurring' : 'One-time'} - 
                      Every {message.delayAmount} {message.delayUnit}
                    </div>
                  </div>

                  <div className="message-meta">
                    {message.lastRun && (
                      <div className="meta-item">
                        <Clock size={14} />
                        <span>Last run: {formatDate(message.lastRun)}</span>
                      </div>
                    )}
                    {message.nextRun && (
                      <div className="meta-item">
                        <Clock size={14} />
                        <span>Next run: {formatDate(message.nextRun)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">⏰</div>
              <h3 className="empty-title">No active messages</h3>
              <p className="empty-description">
                Create your first scheduled message to send messages to teams and projects
              </p>
              <button 
                className="primary-button"
                onClick={handleCreate}
              >
                <Plus className="button-icon" />
                Create Scheduled Message
              </button>
            </div>
          )
        ) : (
          // Completed Messages Tab
          completedMessages.length > 0 ? (
            <div className="scheduled-messages-grid">
              {completedMessages.map((message) => (
                <div key={message.id} className="scheduled-message-card completed">
                  <div className="message-header">
                    <div className="message-info">
                      <h3 className="message-name">{message.name}</h3>
                      <div className="message-status">
                        <div className="status-indicator completed">
                          <CheckCircle className="status-icon" />
                          Completed
                        </div>
                        <div className="message-type">
                          {message.isRecurring ? 'Recurring (Deactivated)' : 'One-time (Executed)'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="message-actions">
                      <button
                        className="action-btn toggle-btn"
                        onClick={() => handleToggleActive(message.id, message.isActive)}
                        title="Re-activate"
                      >
                        <Play size={16} />
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(message.id, message.name)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="message-content">
                    <div className="message-target">
                      <strong>Target Team:</strong> {message.targetTeam}
                      {message.targetProject && (
                        <><br/><strong>Target Project:</strong> {message.targetProject}</>
                      )}
                    </div>
                    
                    <div className="message-text">
                      <strong>Message:</strong>
                      <div className="message-preview">{message.message}</div>
                    </div>
                    
                    <div className="message-schedule">
                      <strong>Original Schedule:</strong>
                      {message.isRecurring ? 'Recurring' : 'One-time'} - 
                      Every {message.delayAmount} {message.delayUnit}
                    </div>
                  </div>

                  <div className="message-meta">
                    {message.lastRun && (
                      <div className="meta-item">
                        <Clock size={14} />
                        <span>Last executed: {formatDate(message.lastRun)}</span>
                      </div>
                    )}
                    <div className="meta-item">
                      <span>Status: {message.isRecurring ? 'Recurring message was deactivated' : 'One-time message completed'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <h3 className="empty-title">No completed messages</h3>
              <p className="empty-description">
                Completed one-time messages and deactivated recurring messages will appear here
              </p>
            </div>
          )
        )}
      </div>

      {/* Delivery Logs Section */}
      <div className="delivery-logs-section">
        <div className="section-header">
          <h2>Message Delivery Logs</h2>
          <button 
            className="btn btn-secondary"
            onClick={async () => {
              if (confirm('Clear all delivery logs?')) {
                try {
                  const response = await fetch('/api/message-delivery-logs', { method: 'DELETE' });
                  if (response.ok) {
                    setDeliveryLogs([]);
                  }
                } catch (error) {
                  console.error('Error clearing logs:', error);
                }
              }
            }}
          >
            Clear Logs
          </button>
        </div>
        
        {deliveryLogs.length > 0 ? (
          <div className="delivery-logs-table">
            <div className="table-header">
              <div className="col-time">Time</div>
              <div className="col-message">Message</div>
              <div className="col-target">Target</div>
              <div className="col-status">Status</div>
            </div>
            {deliveryLogs.slice(0, 50).map((log) => (
              <div key={log.id} className={`table-row ${log.success ? 'success' : 'error'}`}>
                <div className="col-time">{formatDate(log.sentAt)}</div>
                <div className="col-message">
                  <div className="message-name">{log.messageName}</div>
                  <div className="message-content">{log.message.substring(0, 100)}...</div>
                </div>
                <div className="col-target">
                  <div className="target-team">{log.targetTeam}</div>
                  {log.targetProject && <div className="target-project">{log.targetProject}</div>}
                </div>
                <div className="col-status">
                  {log.success ? (
                    <span className="status-success">✓ Delivered</span>
                  ) : (
                    <span className="status-error" title={log.error}>✗ Failed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-logs">
            <p>No delivery logs yet</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <FormPopup
          isOpen={true}
          onClose={handleCloseModal}
          title={editingMessage ? 'Edit Scheduled Message' : 'Create Scheduled Message'}
          onSubmit={handleSubmit}
          submitText={editingMessage ? 'Update' : 'Create'}
          size="lg"
        >
          <FormGroup>
            <FormLabel htmlFor="name" required>Name</FormLabel>
            <FormInput
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Daily status check"
              required
            />
          </FormGroup>

          <FormGroup>
            <FormLabel htmlFor="targetTeam" required>Target Team</FormLabel>
            <Dropdown
              id="targetTeam"
              value={formData.targetTeam}
              onChange={(value) => setFormData({...formData, targetTeam: value})}
              required
              options={[
                { value: 'orchestrator', label: 'Orchestrator' },
                { value: 'frontend-team-pm', label: 'Frontend Team PM' },
                { value: 'frontend-team-dev', label: 'Frontend Team Dev' },
                { value: 'backend-team-pm', label: 'Backend Team PM' },
                { value: 'backend-team-dev', label: 'Backend Team Dev' },
                { value: 'backend-team-qa', label: 'Backend Team QA' }
              ]}
            />
          </FormGroup>

          <FormGroup>
            <FormLabel htmlFor="targetProject">Target Project (Optional)</FormLabel>
            <FormInput
              id="targetProject"
              value={formData.targetProject}
              onChange={(e) => setFormData({...formData, targetProject: e.target.value})}
              placeholder="Project ID or name"
            />
          </FormGroup>

          <FormGroup>
            <FormLabel htmlFor="message" required>Message</FormLabel>
            <FormTextarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              placeholder="Please provide a status update on the current tasks"
              rows={4}
              required
            />
            <FormHelp>
              This message will be sent to the target team's tmux session
            </FormHelp>
          </FormGroup>

          <FormGroup>
            <FormLabel>Schedule</FormLabel>
            <div className="schedule-controls">
              <div className="schedule-type">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={!formData.isRecurring}
                    onChange={() => setFormData({...formData, isRecurring: false})}
                  />
                  <span className="radio-label">
                    <strong>One-time</strong>
                    <small>Send message once after delay</small>
                  </span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={formData.isRecurring}
                    onChange={() => setFormData({...formData, isRecurring: true})}
                  />
                  <span className="radio-label">
                    <strong>Recurring</strong>
                    <small>Send message repeatedly at interval</small>
                  </span>
                </label>
              </div>
              <div className="delay-input">
                <label className="delay-label">
                  {formData.isRecurring ? 'Send every:' : 'Send after:'}
                </label>
                <div className="delay-controls">
                  <input
                    type="number"
                    min="1"
                    value={formData.delayAmount}
                    onChange={(e) => setFormData({...formData, delayAmount: e.target.value})}
                    required
                  />
                  <Dropdown
                    value={formData.delayUnit}
                    onChange={(value) => setFormData({...formData, delayUnit: value as 'seconds' | 'minutes' | 'hours'})}
                    options={[
                      { value: 'seconds', label: 'seconds' },
                      { value: 'minutes', label: 'minutes' },
                      { value: 'hours', label: 'hours' }
                    ]}
                  />
                </div>
              </div>
            </div>
          </FormGroup>
        </FormPopup>
      )}
    </div>
  );
};