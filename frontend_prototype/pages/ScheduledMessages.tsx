
import React, { useState } from 'react';
import { scheduledMessages, messageLogs } from '../constants';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Icon } from '../components/UI/Icon';
import { MessageStatus, ScheduledMessage } from '../types';
import { CreateScheduleModal } from '../components/Modals/CreateScheduleModal';
// FIX: Corrected import path casing to 'Cards' for consistency.
import { CreateCard } from '../components/Cards/CreateCard';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Button } from '../components/UI/Button';
import { ScheduleDetailModal } from '../components/Modals/ScheduleDetailModal';

export const ScheduledMessages: React.FC = () => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<ScheduledMessage | null>(null);
    const [activeTab, setActiveTab] = useState<'Active' | 'Completed'>('Active');

    const filteredMessages = scheduledMessages.filter(m => m.status === activeTab);

    return (
        <>
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Scheduled Messages</h2>
                        <p className="text-sm text-text-secondary-dark mt-1">Manage and monitor your automated messages.</p>
                    </div>
                    <Button
                        onClick={() => setIsCreateModalOpen(true)}
                        icon="add"
                    >
                        Create New Schedule
                    </Button>
                </div>

                <div className="mb-6 border-b border-border-dark">
                    <nav aria-label="Tabs" className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('Active')}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'Active' ? 'text-primary border-primary' : 'text-text-secondary-dark hover:text-text-primary-dark hover:border-border-dark border-transparent'}`}
                        >
                            Active
                        </button>
                        <button
                            onClick={() => setActiveTab('Completed')}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'Completed' ? 'text-primary border-primary' : 'text-text-secondary-dark hover:text-text-primary-dark hover:border-border-dark border-transparent'}`}
                        >
                            Completed
                        </button>
                    </nav>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
                    {filteredMessages.map(msg => (
                        <div 
                            key={msg.id} 
                            onClick={() => setSelectedMessage(msg)}
                            className="bg-surface-dark p-5 rounded-lg border border-border-dark transition-all hover:shadow-lg hover:border-primary/50 flex flex-col justify-between cursor-pointer"
                        >
                            <div>
                                <h3 className="font-semibold text-lg">{msg.name}</h3>
                                <p className="text-sm text-text-secondary-dark mt-1">{msg.targetType}: {msg.targetName}</p>
                            </div>
                            <div className="mt-4">
                                <span className="text-sm font-medium text-text-primary-dark flex items-center gap-2">
                                    <Icon name="schedule" className="text-base" />
                                    {msg.schedule}
                                </span>
                            </div>
                        </div>
                    ))}
                    {activeTab === 'Active' && (
                        <CreateCard 
                            label="Create New Schedule" 
                            icon="add_circle" 
                            onClick={() => setIsCreateModalOpen(true)} 
                        />
                    )}
                </div>

                <section>
                    <h3 className="text-xl font-semibold mb-4">Message Delivery Logs</h3>
                    <div className="bg-surface-dark border border-border-dark rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border-dark">
                                <thead className="bg-background-dark">
                                    <tr>
                                        <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-text-primary-dark">Time</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary-dark">Message</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary-dark">Target</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary-dark">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-dark">
                                    {messageLogs.map(log => (
                                        <tr key={log.id}>
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-text-secondary-dark">{log.timestamp}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-text-primary-dark">{log.message}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-text-secondary-dark">{log.target}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${log.status === MessageStatus.Delivered ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </div>
            <CreateScheduleModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
            <ScheduleDetailModal isOpen={!!selectedMessage} onClose={() => setSelectedMessage(null)} message={selectedMessage} />
        </>
    );
};