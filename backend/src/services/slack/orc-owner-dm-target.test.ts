import { orcOwnerDmTarget } from './orc-owner-dm-target.js';
import { ORCHESTRATOR_SESSION_NAME } from '../../constants.js';

describe('orcOwnerDmTarget (#1142)', () => {
  it('maps a slack-<D>-<ts> conversation id to the DM and its thread', () => {
    expect(orcOwnerDmTarget(ORCHESTRATOR_SESSION_NAME, { channelId: 'slack-D0AC7NF5N7L-1791305812-849389:737ad8eb' })).toEqual({
      slackChannelId: 'D0AC7NF5N7L',
      threadTs: '1791305812.849389',
    });
  });

  it('takes a bare DM id, and a thread key of the same DM wins', () => {
    expect(orcOwnerDmTarget(ORCHESTRATOR_SESSION_NAME, { channelId: 'D0AC7NF5N7L' })).toEqual({ slackChannelId: 'D0AC7NF5N7L' });
    expect(orcOwnerDmTarget(ORCHESTRATOR_SESSION_NAME, { channelId: 'D0AC7NF5N7L', threadId: 'D0AC7NF5N7L:1791305812.849389' })).toEqual({ slackChannelId: 'D0AC7NF5N7L', threadTs: '1791305812.849389' });
  });

  it('is only for the orchestrator and only for a DM', () => {
    expect(orcOwnerDmTarget('some-worker', { channelId: 'D0AC7NF5N7L' })).toBeNull();
    expect(orcOwnerDmTarget(ORCHESTRATOR_SESSION_NAME, { channelId: 'C0C46TTBNNP' })).toBeNull();
    expect(orcOwnerDmTarget(ORCHESTRATOR_SESSION_NAME, { channelId: 'slack-C0C46TTBNNP-1.2' })).toBeNull();
  });
});
