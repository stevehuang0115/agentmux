/**
 * Tests for the agent-to-agent coordination helpers (crewly#1340).
 *
 * @module services/slack/agent-coordination.test
 */

import { classifyAgentAddressing, normaliseTicketPrefixes, stripTicketIds, CoordinationDedupe } from './agent-coordination.js';

describe('classifyAgentAddressing', () => {
  const base = { localAgents: [] as string[], remoteAgents: [] as string[], others: [] as string[], addressesPeople: false };

  it('only agents on this machine → local-only', () => {
    expect(classifyAgentAddressing({ ...base, localAgents: ['max', 'sam'] })).toBe('local-only');
  });

  it('an agent on another machine → cross-machine', () => {
    expect(classifyAgentAddressing({ ...base, localAgents: ['max'], remoteAgents: ['rex'] })).toBe('cross-machine');
    expect(classifyAgentAddressing({ ...base, remoteAgents: ['rex'] })).toBe('cross-machine');
  });

  it('a person, a broadcast or a name nobody knows keeps the post as it was', () => {
    expect(classifyAgentAddressing({ ...base, localAgents: ['max'], others: ['Steve'] })).toBe('other');
    expect(classifyAgentAddressing({ ...base, localAgents: ['max'], addressesPeople: true })).toBe('other');
    expect(classifyAgentAddressing({ ...base, remoteAgents: ['rex'], others: ['U123'] })).toBe('other');
  });

  it('no agent addressed → other', () => {
    expect(classifyAgentAddressing(base)).toBe('other');
  });
});

describe('normaliseTicketPrefixes', () => {
  it('keeps two-to-ten character prefixes, upper case, unique, longest first', () => {
    expect(normaliseTicketPrefixes(['crew', 'CE', 'TKT', 'T', 'D', 'CREW', '', '9X', 'TOOLONGPREFIX'])).toEqual(['CREW', 'TKT', 'CE']);
  });
});

describe('stripTicketIds', () => {
  const P = ['CREW', 'CE', 'TKT'];

  it('takes ids out of the real posts from 2026-10-16', () => {
    expect(stripTicketIds('@Max CREW-718 step 1 of 2 done (Resend).', P)).toBe('@Max step 1 of 2 done (Resend).');
    expect(stripTicketIds('@Max CREW-718: Steve asked us to do it in his browser', P)).toBe('@Max Steve asked us to do it in his browser');
    expect(stripTicketIds('Steve, for the Resend tracking fix (CREW-718) I need two keys.', P)).toBe('Steve, for the Resend tracking fix I need two keys.');
    expect(stripTicketIds('I cancelled my upload link for CREW-718.', P)).toBe('I cancelled my upload link.');
    expect(stripTicketIds('@Sam @Max CREW-718 final evidence', P)).toBe('@Sam @Max final evidence');
  });

  it('handles several ids, request tickets and project tickets', () => {
    expect(stripTicketIds('Done (CE-16, CE-36) and TKT-566 closed', P)).toBe('Done and closed');
    expect(stripTicketIds('CREW-12 done', P)).toBe('done');
  });

  it('leaves look-alikes and unknown prefixes alone', () => {
    const text = 'UTF-8, GPT-6, ISO-27001 and ABC-12 stay';
    expect(stripTicketIds(text, P)).toBe(text);
  });

  it('leaves ids that are part of a path, branch or URL', () => {
    const text = 'see fix/CREW-12 and https://x.dev/blog/CREW-12-post';
    expect(stripTicketIds(text, P)).toBe(text);
  });

  it('keeps line breaks and bullets', () => {
    expect(stripTicketIds('Update:\n  • CREW-1 deployed\n  • tests green', P)).toBe('Update:\n  • deployed\n  • tests green');
  });

  it('never returns an empty post', () => {
    expect(stripTicketIds('CREW-718', P)).toBe('CREW-718');
  });

  it('is a no-op without prefixes', () => {
    expect(stripTicketIds('CREW-718 done', [])).toBe('CREW-718 done');
  });
});

describe('CoordinationDedupe', () => {
  const min = 60 * 1000;

  it('drops a near-identical repeat to the same recipients in the same room within the window', () => {
    const d = new CoordinationDedupe(15 * min, 0.85);
    expect(d.isRepeat('room', 'ella', ['sam'], '@Sam both checks were already done, all clear.', 0)).toBe(false);
    expect(d.isRepeat('room', 'ella', ['sam'], '@Sam Both checks were already done — all clear!', 2 * min)).toBe(true);
  });

  it('lets it through for another recipient, another room, another sender, or after the window', () => {
    const d = new CoordinationDedupe(15 * min, 0.85);
    d.isRepeat('room', 'ella', ['sam'], 'the preview is live', 0);
    expect(d.isRepeat('room', 'ella', ['max'], 'the preview is live', 1)).toBe(false);
    expect(d.isRepeat('other', 'ella', ['sam'], 'the preview is live', 1)).toBe(false);
    expect(d.isRepeat('room', 'max', ['sam'], 'the preview is live', 1)).toBe(false);
    expect(d.isRepeat('room', 'ella', ['sam'], 'the preview is live', 16 * min)).toBe(false);
  });

  it('compares the words, not the @-mentions', () => {
    const d = new CoordinationDedupe(15 * min, 0.85);
    d.isRepeat('room', 'ella', ['max', 'sam'], '@Sam 1.0.217 is live, both pages return 200', 0);
    expect(d.isRepeat('room', 'ella', ['sam', 'max'], '@Sam @Max 1.0.217 is live, both pages return 200', 1)).toBe(true);
  });

  it('a different message is not a repeat', () => {
    const d = new CoordinationDedupe(15 * min, 0.85);
    d.isRepeat('room', 'ella', ['sam'], 'step 1 of 2 done', 0);
    expect(d.isRepeat('room', 'ella', ['sam'], 'the Cloudflare half waits on Steve logging in', 1)).toBe(false);
  });
});
