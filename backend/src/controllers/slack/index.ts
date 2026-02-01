/**
 * Slack Controller Module
 *
 * Exports the Slack REST API router.
 *
 * @module controllers/slack
 */

import { Router } from 'express';
import slackController from './slack.controller.js';

/**
 * Creates the Slack router for API integration
 *
 * @returns Express Router with Slack endpoints
 */
export function createSlackRouter(): Router {
  return slackController;
}

export default slackController;
