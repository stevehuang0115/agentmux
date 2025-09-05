import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
	Home,
	FolderOpen,
	Users,
	ClipboardList,
	Clock,
	UserCircle,
	Settings,
} from 'lucide-react';
import clsx from 'clsx';

const navigationItems = [
	{ name: 'Dashboard', href: '/', icon: Home },
	{ name: 'Projects', href: '/projects', icon: FolderOpen },
	{ name: 'Teams', href: '/teams', icon: Users },
	{ name: 'Assignments', href: '/assignments', icon: ClipboardList },
	{ name: 'Schedules', href: '/scheduled-checkins', icon: Clock },
];

export const Navigation: React.FC = () => {
	const location = useLocation();

	return (
		<div className="navigation">
			{/* Logo Section */}
			<div className="nav-header">
				<div className="nav-logo">
					<div className="logo-icon">
						<div className="triangle"></div>
					</div>
					<span className="logo-text">AgentMux</span>
				</div>
			</div>

			{/* Main Navigation */}
			<nav className="nav-menu">
				<div className="nav-section">
					{navigationItems.map((item) => {
						const isActive =
							location.pathname === item.href ||
							(item.href !== '/' && location.pathname.startsWith(item.href));

						return (
							<NavLink
								key={item.name}
								to={item.href}
								className={clsx('nav-item', isActive && 'nav-item--active')}
							>
								<item.icon className="nav-icon" />
								<span className="nav-label">{item.name}</span>
							</NavLink>
						);
					})}
				</div>
			</nav>

			{/* Bottom Section */}
			<div className="nav-footer">
				<div className="nav-user">
					<UserCircle className="user-avatar" />
					<div className="user-info">
						<div className="user-name">AgentMux</div>
						<div className="user-status">System</div>
					</div>
				</div>

				<button className="nav-settings">
					<Settings className="settings-icon" />
				</button>
			</div>
		</div>
	);
};
