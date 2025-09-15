import React from 'react';
import { FormPopup, FormGroup, FormLabel, FormInput, FormTextarea, FormHelp, Dropdown } from '../UI';
import { ScheduledMessage, ScheduledMessageFormData, TEAM_OPTIONS } from './types';

interface MessageFormProps {
  isOpen: boolean;
  editingMessage: ScheduledMessage | null;
  formData: ScheduledMessageFormData;
  setFormData: React.Dispatch<React.SetStateAction<ScheduledMessageFormData>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const MessageForm: React.FC<MessageFormProps> = ({
  isOpen,
  editingMessage,
  formData,
  setFormData,
  onClose,
  onSubmit
}) => {
  return (
    <FormPopup
      isOpen={isOpen}
      onClose={onClose}
      title={editingMessage ? 'Edit Scheduled Message' : 'Create Scheduled Message'}
      onSubmit={onSubmit}
      submitText={editingMessage ? 'Update' : 'Create'}
      size="xxl"
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
          options={TEAM_OPTIONS}
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
          rows={8}
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
  );
};