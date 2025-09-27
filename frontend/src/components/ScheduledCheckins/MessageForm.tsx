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
        <div className="grid gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <label className="flex items-start gap-3 p-3 rounded-lg border border-border-dark cursor-pointer hover:border-primary/50">
              <input
                type="radio"
                name="scheduleType"
                className="mt-0.5"
                checked={!formData.isRecurring}
                onChange={() => setFormData({ ...formData, isRecurring: false })}
              />
              <span>
                <div className="font-medium">One-time</div>
                <div className="text-xs text-text-secondary-dark">Send message once after delay</div>
              </span>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg border border-border-dark cursor-pointer hover:border-primary/50">
              <input
                type="radio"
                name="scheduleType"
                className="mt-0.5"
                checked={formData.isRecurring}
                onChange={() => setFormData({ ...formData, isRecurring: true })}
              />
              <span>
                <div className="font-medium">Recurring</div>
                <div className="text-xs text-text-secondary-dark">Send message repeatedly at interval</div>
              </span>
            </label>
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-text-secondary-dark">
              {formData.isRecurring ? 'Send every:' : 'Send after:'}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={formData.delayAmount}
                onChange={(e) => setFormData({ ...formData, delayAmount: e.target.value })}
                required
                className="w-28 bg-surface-dark border border-border-dark rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <Dropdown
                value={formData.delayUnit}
                onChange={(value) => setFormData({ ...formData, delayUnit: value as 'seconds' | 'minutes' | 'hours' })}
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
