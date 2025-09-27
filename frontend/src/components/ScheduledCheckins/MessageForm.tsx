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
            <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
              !formData.isRecurring
                ? 'border-primary bg-primary/10 text-text-primary-dark'
                : 'border-border-dark hover:border-primary/50 text-text-primary-dark'
            }`}>
              <input
                type="radio"
                name="scheduleType"
                className="mt-1 w-4 h-4 text-primary border-border-dark focus:ring-primary focus:ring-2"
                checked={!formData.isRecurring}
                onChange={() => setFormData({ ...formData, isRecurring: false })}
              />
              <div className="flex-1">
                <div className="font-medium text-sm">One-time</div>
                <div className="text-xs text-text-secondary-dark mt-1">Send a single message after a delay.</div>
              </div>
              {!formData.isRecurring && (
                <div className="ml-auto">
                  <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </label>
            <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
              formData.isRecurring
                ? 'border-primary bg-primary/10 text-text-primary-dark'
                : 'border-border-dark hover:border-primary/50 text-text-primary-dark'
            }`}>
              <input
                type="radio"
                name="scheduleType"
                className="mt-1 w-4 h-4 text-primary border-border-dark focus:ring-primary focus:ring-2"
                checked={formData.isRecurring}
                onChange={() => setFormData({ ...formData, isRecurring: true })}
              />
              <div className="flex-1">
                <div className="font-medium text-sm">Recurring</div>
                <div className="text-xs text-text-secondary-dark mt-1">Send a message on a recurring basis.</div>
              </div>
              {formData.isRecurring && (
                <div className="ml-auto">
                  <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </label>
          </div>
          <div className="grid gap-3">
            <label className="text-sm font-medium text-text-primary-dark">
              {formData.isRecurring ? 'Send Every' : 'Send After'}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={formData.delayAmount}
                onChange={(e) => setFormData({ ...formData, delayAmount: e.target.value })}
                required
                className="w-20 bg-surface-dark border border-border-dark rounded-lg px-3 py-2.5 text-sm text-text-primary-dark focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <Dropdown
                value={formData.delayUnit}
                onChange={(value) => setFormData({ ...formData, delayUnit: value as 'seconds' | 'minutes' | 'hours' })}
                options={[
                  { value: 'seconds', label: 'seconds' },
                  { value: 'minutes', label: 'minutes' },
                  { value: 'hours', label: 'hours' }
                ]}
                className="min-w-[120px]"
              />
            </div>
          </div>
        </div>
      </FormGroup>
    </FormPopup>
  );
};
