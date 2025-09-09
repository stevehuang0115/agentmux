#!/usr/bin/env node

/**
 * Migration script to clean up legacy 'status' fields from teams.json
 * and update them to use the new agentStatus/workingStatus fields
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const agentmuxHome = path.join(os.homedir(), '.agentmux');
const teamsFile = path.join(agentmuxHome, 'teams.json');

async function migrateTeamsFile() {
  console.log('🔄 Starting legacy status field migration...');
  
  if (!fs.existsSync(teamsFile)) {
    console.log('📝 No teams.json file found - nothing to migrate');
    return;
  }
  
  try {
    // Read current data
    const content = fs.readFileSync(teamsFile, 'utf-8');
    const data = JSON.parse(content);
    
    let migrated = false;
    
    // Handle both old array format and new object format
    const teams = data.teams || (Array.isArray(data) ? data : []);
    
    for (const team of teams) {
      if (team.members) {
        for (const member of team.members) {
          // Check if legacy 'status' field exists
          if (member.hasOwnProperty('status')) {
            console.log(`🔧 Migrating member "${member.name}" from team "${team.name}"`);
            
            // Migrate legacy status to agentStatus if agentStatus doesn't exist
            if (!member.agentStatus) {
              switch (member.status) {
                case 'active':
                  member.agentStatus = 'active';
                  break;
                case 'idle':
                case 'inactive':
                  member.agentStatus = 'inactive';
                  break;
                case 'activating':
                  member.agentStatus = 'activating';
                  break;
                default:
                  member.agentStatus = 'inactive';
              }
            }
            
            // Ensure workingStatus exists
            if (!member.workingStatus) {
              member.workingStatus = 'idle';
            }
            
            // Remove legacy field
            delete member.status;
            
            // Update timestamp
            member.updatedAt = new Date().toISOString();
            migrated = true;
          }
          
          // Ensure required fields exist
          if (!member.agentStatus) {
            member.agentStatus = 'inactive';
            migrated = true;
          }
          
          if (!member.workingStatus) {
            member.workingStatus = 'idle';
            migrated = true;
          }
        }
        
        if (migrated) {
          team.updatedAt = new Date().toISOString();
        }
      }
    }
    
    // Handle orchestrator if it exists
    if (data.orchestrator && data.orchestrator.hasOwnProperty('status')) {
      console.log('🔧 Migrating orchestrator status field');
      
      if (!data.orchestrator.agentStatus) {
        data.orchestrator.agentStatus = data.orchestrator.status;
      }
      
      if (!data.orchestrator.workingStatus) {
        data.orchestrator.workingStatus = 'idle';
      }
      
      delete data.orchestrator.status;
      data.orchestrator.updatedAt = new Date().toISOString();
      migrated = true;
    }
    
    if (migrated) {
      // Create backup
      const backupFile = teamsFile + '.backup.' + Date.now();
      fs.copyFileSync(teamsFile, backupFile);
      console.log(`📋 Created backup: ${backupFile}`);
      
      // Save migrated data
      const newData = data.teams ? data : { teams, orchestrator: data.orchestrator };
      fs.writeFileSync(teamsFile, JSON.stringify(newData, null, 2));
      
      console.log('✅ Migration completed successfully!');
      console.log(`📝 Updated ${teams.length} teams`);
    } else {
      console.log('✨ No legacy status fields found - already up to date!');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration
migrateTeamsFile().catch(console.error);

export { migrateTeamsFile };