/**
 * Skill Controllers Index
 *
 * Exports the skill router for REST API endpoints.
 *
 * @module controllers/skill/index
 */

import { Router } from 'express';
import skillController from './skill.controller.js';

/**
 * Creates the skill router
 *
 * @returns Express router for skill endpoints
 */
export function createSkillRouter(): Router {
  return skillController;
}

export default skillController;
