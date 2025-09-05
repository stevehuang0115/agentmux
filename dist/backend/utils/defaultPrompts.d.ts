import { TeamMember } from '../types/index.js';
export declare const DEFAULT_SYSTEM_PROMPTS: Record<TeamMember['role'], string>;
export declare function getDefaultPrompt(role: TeamMember['role']): string;
export declare function getDefaultTeamMemberName(role: TeamMember['role'], index?: number): string;
//# sourceMappingURL=defaultPrompts.d.ts.map