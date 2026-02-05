/**
 * AgentDetailModal Component
 *
 * Modal dialog for viewing agent details including role and skills.
 *
 * @module components/TeamDetail/AgentDetailModal
 */

import React, { useState, useEffect } from 'react';
import { X, User, Briefcase, Wrench, Check, AlertCircle, CheckCircle2 } from 'lucide-react';
import { TeamMember } from '../../types';
import { rolesService } from '../../services/roles.service';
import { skillsService, type McpServerStatus } from '../../services/skills.service';
import { RoleWithPrompt, ROLE_CATEGORY_DISPLAY_NAMES } from '../../types/role.types';
import { useSkills } from '../../hooks/useSkills';
import type { Skill } from '../../types/skill.types';

interface AgentDetailModalProps {
  /** The team member to display details for */
  member: TeamMember;
  /** Called when the modal should close */
  onClose: () => void;
  /** Optional project path for checking project-level MCP settings */
  projectPath?: string;
}

/**
 * Skill with MCP status information
 */
interface SkillWithMcpStatus {
  id: string;
  name: string;
  skillType?: string;
  requiredMcpServers?: string[];
  mcpStatus?: McpServerStatus[];
}

/**
 * Modal for displaying agent details (role, skills, etc.)
 *
 * @param props - Component props
 * @returns AgentDetailModal component
 */
export const AgentDetailModal: React.FC<AgentDetailModalProps> = ({ member, onClose, projectPath }) => {
  const [roleDetails, setRoleDetails] = useState<RoleWithPrompt | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [skillsWithStatus, setSkillsWithStatus] = useState<SkillWithMcpStatus[]>([]);
  const [loadingMcpStatus, setLoadingMcpStatus] = useState(false);
  const { skills: allSkills } = useSkills();

  useEffect(() => {
    const fetchRoleDetails = async () => {
      if (member.role) {
        try {
          const role = await rolesService.getRole(member.role);
          setRoleDetails(role);
        } catch (error) {
          console.error('Failed to fetch role details:', error);
        } finally {
          setLoadingRole(false);
        }
      } else {
        setLoadingRole(false);
      }
    };

    fetchRoleDetails();
  }, [member.role]);

  /**
   * Fetch MCP status for all skills when role details are loaded
   */
  useEffect(() => {
    const fetchMcpStatus = async () => {
      if (!roleDetails && !member.skillOverrides?.length) return;

      // Filter out excluded role skills
      const roleSkills = (roleDetails?.assignedSkills || [])
        .filter(skillId => !member.excludedRoleSkills?.includes(skillId));
      const allSkillIds = [
        ...roleSkills,
        ...(member.skillOverrides || [])
      ];

      if (allSkillIds.length === 0) return;

      setLoadingMcpStatus(true);
      try {
        // Fetch full skill details to get MCP requirements
        const skillDetailsPromises = allSkillIds.map(async (skillId) => {
          try {
            const skill = await skillsService.getById(skillId);
            // Use type assertion with partial matching since API may return partial data
            const skillData = skill as Partial<Skill>;
            return {
              id: skillId,
              name: skillData.name || skillId,
              skillType: skillData.skillType,
              requiredMcpServers: skillData.runtime?.requiredMcpServers || []
            };
          } catch {
            // Skill not found, use basic info
            const basicSkill = allSkills.find(s => s.id === skillId);
            return {
              id: skillId,
              name: basicSkill?.name || skillId,
              skillType: basicSkill?.skillType,
              requiredMcpServers: []
            };
          }
        });

        const skillDetails = await Promise.all(skillDetailsPromises);

        // Collect all required MCP packages
        const requiredPackages = skillDetails
          .flatMap(s => s.requiredMcpServers || [])
          .filter((pkg, idx, arr) => arr.indexOf(pkg) === idx); // unique

        // Check MCP status if there are required packages
        // Pass projectPath to also check project-level MCP settings
        let mcpStatuses: McpServerStatus[] = [];
        if (requiredPackages.length > 0) {
          const statusResponse = await skillsService.checkMcpStatus(requiredPackages, projectPath);
          mcpStatuses = statusResponse.statuses;
        }

        // Combine skill details with MCP status
        const skillsWithMcp: SkillWithMcpStatus[] = skillDetails.map(skill => ({
          ...skill,
          mcpStatus: skill.requiredMcpServers?.map(pkg =>
            mcpStatuses.find(s => s.packageName === pkg) || {
              packageName: pkg,
              isInstalled: false
            }
          )
        }));

        setSkillsWithStatus(skillsWithMcp);
      } catch (error) {
        console.error('Failed to fetch MCP status:', error);
      } finally {
        setLoadingMcpStatus(false);
      }
    };

    if (!loadingRole) {
      fetchMcpStatus();
    }
  }, [roleDetails, member.skillOverrides, loadingRole, allSkills, projectPath]);

  /**
   * Get skill info by ID
   */
  const getSkillInfo = (skillId: string): SkillWithMcpStatus | undefined => {
    return skillsWithStatus.find(s => s.id === skillId);
  };

  /**
   * Get all skills for this agent (from role + overrides, minus excluded)
   */
  const getAllSkillIds = (): string[] => {
    const roleSkills = (roleDetails?.assignedSkills || [])
      .filter(skillId => !member.excludedRoleSkills?.includes(skillId));
    const overrideSkills = member.skillOverrides || [];
    return [...new Set([...roleSkills, ...overrideSkills])];
  };

  /**
   * Check if skill has all required MCP servers installed
   */
  const isSkillReady = (skill: SkillWithMcpStatus): boolean => {
    if (!skill.mcpStatus || skill.mcpStatus.length === 0) return true;
    return skill.mcpStatus.every(status => status.isInstalled);
  };

  /**
   * Handle overlay click to close
   */
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  /**
   * Render a skill badge with MCP status
   */
  const renderSkillBadge = (skillId: string, variant: 'role' | 'additional') => {
    const skillInfo = getSkillInfo(skillId);
    const name = skillInfo?.name || skillId;
    const isMcp = skillInfo?.skillType === 'mcp';
    const ready = skillInfo ? isSkillReady(skillInfo) : true;

    const baseClasses = 'inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-md';
    const variantClasses = variant === 'role'
      ? 'bg-primary/10 text-primary'
      : 'bg-emerald-500/10 text-emerald-400';

    return (
      <div key={skillId} className="relative group">
        <span className={`${baseClasses} ${variantClasses}`}>
          <Check className="w-3 h-3" />
          {name}
          {isMcp && (
            ready ? (
              <span title="MCP server installed">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </span>
            ) : (
              <span title="MCP server not installed">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              </span>
            )
          )}
        </span>
        {/* Tooltip for MCP status */}
        {isMcp && skillInfo?.mcpStatus && skillInfo.mcpStatus.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10">
            <div className="bg-surface-dark border border-border-dark rounded-lg p-2 shadow-lg text-xs whitespace-nowrap">
              <div className="font-medium mb-1">MCP Requirements:</div>
              {skillInfo.mcpStatus.map((status, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  {status.isInstalled ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                  )}
                  <span className={status.isInstalled ? 'text-emerald-400' : 'text-amber-400'}>
                    {status.packageName}
                  </span>
                  {status.isInstalled && (
                    <span className="text-text-secondary-dark">
                      {status.configuredName && `(as "${status.configuredName}")`}
                      {status.source && ` [${status.source}]`}
                    </span>
                  )}
                </div>
              ))}
              {!skillInfo.mcpStatus.every(s => s.isInstalled) && (
                <div className="mt-1 pt-1 border-t border-border-dark text-text-secondary-dark">
                  Run: claude mcp add {skillInfo.mcpStatus.find(s => !s.isInstalled)?.packageName}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-surface-dark border border-border-dark rounded-xl shadow-lg w-full max-w-lg m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-dark">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-background-dark border border-border-dark flex items-center justify-center overflow-hidden">
              {member.avatar ? (
                member.avatar.startsWith('http') || member.avatar.startsWith('data:') ? (
                  <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg">{member.avatar}</span>
                )
              ) : (
                <User className="w-6 h-6 text-text-secondary-dark" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary-dark">{member.name}</h2>
              <p className="text-sm text-text-secondary-dark">Agent Details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-background-dark flex items-center justify-center text-text-secondary-dark hover:text-text-primary-dark"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Role Section */}
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-text-secondary-dark uppercase tracking-wide mb-3">
              <Briefcase className="w-4 h-4" />
              Role
            </div>
            {loadingRole ? (
              <div className="animate-pulse">
                <div className="h-6 bg-background-dark rounded w-32 mb-2"></div>
                <div className="h-4 bg-background-dark rounded w-full"></div>
              </div>
            ) : roleDetails ? (
              <div className="bg-background-dark/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-text-primary-dark">{roleDetails.displayName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {ROLE_CATEGORY_DISPLAY_NAMES[roleDetails.category] || roleDetails.category}
                  </span>
                </div>
                <p className="text-sm text-text-secondary-dark">{roleDetails.description}</p>
              </div>
            ) : (
              <p className="text-sm text-text-secondary-dark italic">No role assigned</p>
            )}
          </div>

          {/* Skills Section */}
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-text-secondary-dark uppercase tracking-wide mb-3">
              <Wrench className="w-4 h-4" />
              Skills
              {loadingMcpStatus && (
                <span className="text-xs text-text-secondary-dark font-normal">(checking MCP status...)</span>
              )}
            </div>
            {loadingRole ? (
              <div className="animate-pulse flex flex-wrap gap-2">
                <div className="h-7 bg-background-dark rounded-md w-24"></div>
                <div className="h-7 bg-background-dark rounded-md w-32"></div>
                <div className="h-7 bg-background-dark rounded-md w-28"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Skills from Role (excluding member-specific exclusions) */}
                {roleDetails?.assignedSkills && roleDetails.assignedSkills.length > 0 && (
                  <div>
                    <p className="text-xs text-text-secondary-dark mb-2">From Role</p>
                    <div className="flex flex-wrap gap-2">
                      {roleDetails.assignedSkills
                        .filter(skillId => !member.excludedRoleSkills?.includes(skillId))
                        .map(skillId =>
                          renderSkillBadge(skillId, 'role')
                        )}
                    </div>
                  </div>
                )}

                {/* Additional Skills (Overrides) */}
                {member.skillOverrides && member.skillOverrides.length > 0 && (
                  <div>
                    <p className="text-xs text-text-secondary-dark mb-2">Additional Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {member.skillOverrides.map(skillId =>
                        renderSkillBadge(skillId, 'additional')
                      )}
                    </div>
                  </div>
                )}

                {/* No skills */}
                {getAllSkillIds().length === 0 && (
                  <p className="text-sm text-text-secondary-dark italic">No skills assigned</p>
                )}
              </div>
            )}
          </div>

          {/* Runtime Section */}
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-text-secondary-dark uppercase tracking-wide mb-3">
              Runtime
            </div>
            <div className="bg-background-dark/50 rounded-lg px-4 py-2">
              <span className="text-sm text-text-primary-dark">
                {member.runtimeType === 'claude-code' ? 'Claude CLI' :
                 member.runtimeType === 'gemini-cli' ? 'Gemini CLI' :
                 member.runtimeType === 'codex-cli' ? 'Codex CLI' :
                 member.runtimeType || 'Claude CLI'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-dark bg-background-dark rounded-b-xl">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentDetailModal;
