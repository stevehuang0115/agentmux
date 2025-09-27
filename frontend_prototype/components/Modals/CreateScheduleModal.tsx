
import React, { useState } from 'react';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Icon } from '../UI/Icon';
import { teams, teamMembers } from '../../constants';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Button } from '../UI/Button';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Input } from '../UI/Input';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Select } from '../UI/Select';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Textarea } from '../UI/Textarea';

interface CreateScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CreateScheduleModal: React.FC<CreateScheduleModalProps> = ({ isOpen, onClose }) => {
    const [scheduleType, setScheduleType] = useState('one-time');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-surface-dark border border-border-dark rounded-xl shadow-lg w-full max-w-2xl m-4" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-xl font-semibold text-text-primary-dark">Create New Scheduled Message</h3>
                            <p className="text-sm text-text-secondary-dark mt-1">Configure and schedule a new automated message.</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8 -mt-1 -mr-1">
                          <Icon name="close" />
                        </Button>
                    </div>
                    <form action="#" className="space-y-6 mt-6 max-h-[60vh] overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-text-primary-dark mb-2" htmlFor="message-name">Name</label>
                                <Input id="message-name" name="message-name" placeholder="e.g., 'Daily Standup Reminder'" type="text"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-primary-dark mb-2" htmlFor="target-member">Target Team Member</label>
                                <Select id="target-member" name="target-member">
                                    <option>Select a target</option>
                                    <optgroup label="Teams">
                                        {teams.map(team => <option key={`team-${team.id}`}>{team.name} Team</option>)}
                                    </optgroup>
                                    <optgroup label="Members">
                                        {teamMembers.map(member => <option key={`member-${member.id}`}>{member.name}</option>)}
                                    </optgroup>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-primary-dark mb-2" htmlFor="message-content">Message</label>
                            <Textarea id="message-content" name="message-content" placeholder="Enter your message content here..." rows={4}></Textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-primary-dark mb-2">Schedule</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="relative">
                                    <input 
                                        className="peer sr-only" 
                                        id="modal-one-time" 
                                        name="modal-schedule-type" 
                                        type="radio" 
                                        value="one-time"
                                        checked={scheduleType === 'one-time'}
                                        onChange={() => setScheduleType('one-time')}
                                    />
                                    <label className="block p-4 rounded-lg border border-border-dark bg-background-dark cursor-pointer peer-checked:border-primary peer-checked:ring-1 peer-checked:ring-primary" htmlFor="modal-one-time">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold">One-time</span>
                                            {scheduleType === 'one-time' && <Icon name="check_circle" className="text-primary" />}
                                        </div>
                                        <p className="text-sm text-text-secondary-dark mt-1">Send a single message after a delay.</p>
                                    </label>
                                </div>
                                <div className="relative">
                                    <input 
                                        className="peer sr-only" 
                                        id="modal-recurring" 
                                        name="modal-schedule-type" 
                                        type="radio" 
                                        value="recurring"
                                        checked={scheduleType === 'recurring'}
                                        onChange={() => setScheduleType('recurring')}
                                    />
                                    <label className="block p-4 rounded-lg border border-border-dark bg-background-dark cursor-pointer peer-checked:border-primary peer-checked:ring-1 peer-checked:ring-primary" htmlFor="modal-recurring">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold">Recurring</span>
                                            {scheduleType === 'recurring' && <Icon name="check_circle" className="text-primary" />}
                                        </div>
                                        <p className="text-sm text-text-secondary-dark mt-1">Send a message on a recurring basis.</p>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {scheduleType === 'one-time' && (
                                <div>
                                    <label className="block text-sm font-medium text-text-primary-dark mb-2" htmlFor="one-time-delay">Send After</label>
                                    <div className="flex gap-4">
                                        <div className="flex-grow">
                                            <Input id="one-time-delay" name="one-time-delay-value" type="number" defaultValue="10"/>
                                        </div>
                                        <div className="flex-shrink-0">
                                            <Select name="one-time-delay-unit" defaultValue="hours">
                                                <option>minutes</option>
                                                <option>hours</option>
                                                <option>days</option>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {scheduleType === 'recurring' && (
                                <div>
                                    <label className="block text-sm font-medium text-text-primary-dark mb-2" htmlFor="recurring-delay">Send Every</label>
                                    <div className="flex gap-4">
                                        <div className="flex-grow">
                                            <Input id="recurring-delay" name="recurring-delay-value" type="number" defaultValue="24"/>
                                        </div>
                                        <div className="flex-shrink-0">
                                            <Select name="recurring-delay-unit" defaultValue="hours">
                                                <option>minutes</option>
                                                <option>hours</option>
                                                <option>days</option>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
                 <div className="bg-background-dark px-6 py-4 rounded-b-xl border-t border-border-dark flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                    <Button type="submit" icon="add">
                        Create Schedule
                    </Button>
                </div>
            </div>
        </div>
    );
};