# AgentMux Phase 1 Frontend QA Test Plan

## Executive Summary

This comprehensive test plan addresses critical gaps in Phase 1 feature testing based on the PRD-Lightweight specifications. Focus areas include Project CRUD, Team CRUD, Assignment workflows, and Activity polling.

## Critical Issues Identified

### 🚨 HIGH PRIORITY BUGS
1. **WebSocket Connection Issue**: Frontend stuck in permanent "Connecting..." state
2. **Session Loading Bug**: Sessions permanently stuck in "Loading sessions..." 
3. **Frontend-Backend Communication**: WebSocket data flow not working correctly

## Phase 1 Feature Test Matrix

### 1. Project CRUD Operations

#### Test Scenarios
- [x] **PC-001**: Create project with name and filesystem path
- [x] **PC-002**: Edit project name and path
- [x] **PC-003**: Delete project (archive functionality)
- [x] **PC-004**: Validate required fields (name, path)
- [x] **PC-005**: Handle invalid filesystem paths
- [x] **PC-006**: Project status updates (Active, Idle, Archived)

#### Test Cases

```typescript
// PC-001: Create Project Test
test('should create new project successfully', async () => {
  // Navigate to projects tab
  // Click "New Project" button
  // Fill required fields: name, path
  // Submit form
  // Verify project appears in project list
  // Verify project status is "unassigned"
});

// PC-002: Edit Project Test  
test('should edit existing project', async () => {
  // Select existing project
  // Click edit button
  // Modify name and path
  // Save changes
  // Verify updates are reflected
});

// PC-003: Delete Project Test
test('should archive project', async () => {
  // Select project
  // Click archive/delete
  // Confirm action
  // Verify project moves to archived state
});
```

### 2. Team CRUD Operations

#### Test Scenarios
- [x] **TC-001**: Create team with required Orchestrator role
- [x] **TC-002**: Add optional roles (PM, Dev, QA)
- [x] **TC-003**: Edit team composition
- [x] **TC-004**: Delete team (with cleanup)
- [x] **TC-005**: Validate at least one Orchestrator required
- [x] **TC-006**: Team status management (Active, Idle, Paused, Stopped)

### 3. Assignment Workflow

#### Test Scenarios
- [x] **AW-001**: Drag & drop team to project assignment
- [x] **AW-002**: Click assign workflow
- [x] **AW-003**: Prevent double assignment
- [x] **AW-004**: Assignment conflict handling
- [x] **AW-005**: Unassign team from project
- [x] **AW-006**: Visual assignment board updates

#### Critical Test Case
```typescript
test('CRITICAL: Complete assignment workflow', async () => {
  // Create project
  const project = await createTestProject('Test Project', '/tmp/test');
  
  // Create team with Orchestrator
  const team = await createTestTeam('Test Team', [
    { role: 'orchestrator', count: 1 },
    { role: 'dev', count: 1 }
  ]);
  
  // Assign team to project via drag & drop
  await page.dragAndDrop(`[data-testid="team-${team.id}"]`, `[data-testid="project-${project.id}"]`);
  
  // Verify assignment created
  await expect(page.locator('[data-testid="assignment-active"]')).toBeVisible();
  
  // Verify project status changed to "active"
  await expect(page.locator(`[data-testid="project-${project.id}-status"]`)).toHaveText('Active');
  
  // Verify team status changed to "active"
  await expect(page.locator(`[data-testid="team-${team.id}-status"]`)).toHaveText('Active');
});
```

### 4. Activity Polling Integration

#### Test Scenarios  
- [x] **AP-001**: Activity status updates every 30 seconds
- [x] **AP-002**: Working (green) status detection
- [x] **AP-003**: Idle (yellow) status detection  
- [x] **AP-004**: Stopped (red) status handling
- [x] **AP-005**: Manual "Check Now" functionality
- [x] **AP-006**: Activity timeline display (24 hours)

### 5. Dashboard Navigation

#### Test Scenarios
- [x] **DN-001**: Projects Tab functionality
- [x] **DN-002**: Teams Tab functionality  
- [x] **DN-003**: Assignment Board Tab
- [x] **DN-004**: Tab switching preserves state
- [x] **DN-005**: URL routing works correctly

## Cross-Browser Compatibility Tests

### Browser Matrix
- **Chrome 120+** (Primary)
- **Firefox 115+** (Secondary)  
- **Safari 16+** (Secondary)
- **Edge 120+** (Tertiary)

### Viewport Testing
- **Desktop**: 1920x1080, 1366x768
- **Tablet**: 768x1024, 1024x768
- **Mobile**: 375x667, 414x896

### Critical Compatibility Tests
```typescript
// Cross-browser Phase 1 workflow test
['chromium', 'firefox', 'webkit'].forEach(browserName => {
  test(`Phase 1 workflow works in ${browserName}`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Run complete Phase 1 user journey
    await completePhase1Workflow(page);
  });
});
```

## Performance Requirements

### Phase 1 Performance Targets
- **UI Responsiveness**: < 500ms for all interactions
- **Resource Usage**: < 100MB RAM, < 5% CPU when idle  
- **Polling Performance**: 30-second intervals without degradation
- **Setup Time**: < 60 seconds from start to working dashboard

## Security Testing

### Input Validation Tests
- Project name XSS prevention
- File path traversal prevention
- Team name injection prevention
- Activity polling data sanitization

## Test Implementation Priority

### Sprint 1 (Critical Path)
1. Fix WebSocket connection stuck state bug
2. Fix session loading permanent state bug
3. Implement Project CRUD tests
4. Implement Team CRUD tests

### Sprint 2 (Core Features)
1. Complete Assignment workflow tests
2. Activity polling integration tests
3. Dashboard navigation tests
4. Basic cross-browser testing

### Sprint 3 (Quality & Polish)  
1. Performance testing
2. Security testing
3. Accessibility testing
4. Edge case coverage

## Test Automation Strategy

### Framework Stack
- **E2E**: Playwright (primary), Puppeteer (legacy)
- **Unit**: Jest + React Testing Library
- **Integration**: Supertest + Jest
- **Cross-browser**: Playwright browser matrix

### CI/CD Integration
- All Phase 1 tests must pass before merge
- Cross-browser tests run on staging deployment
- Performance benchmarks tracked over time

## Success Criteria

### Definition of Done - Phase 1
- [ ] All Project CRUD operations work flawlessly
- [ ] All Team CRUD operations work flawlessly  
- [ ] Assignment workflow completes successfully
- [ ] Activity polling shows accurate status
- [ ] Cross-browser compatibility verified
- [ ] No critical or high severity bugs
- [ ] Performance targets met
- [ ] 95% test coverage on critical paths

### Quality Gates
1. **Functional**: All Phase 1 user journeys complete successfully
2. **Performance**: Response times under 500ms
3. **Compatibility**: Works in Chrome, Firefox, Safari
4. **Reliability**: Zero critical bugs, < 2 high severity bugs
5. **User Experience**: Clear status indicators, no stuck states

## Risk Mitigation

### High-Risk Areas
1. **WebSocket Connection**: Implement connection retry logic with clear status
2. **Tmux Integration**: Mock tmux for consistent testing
3. **File System Operations**: Sandbox file operations in tests
4. **Real-time Updates**: Test polling behavior under load

## Monitoring & Reporting

### Key Metrics
- Test execution time
- Test pass/fail rates  
- Cross-browser compatibility score
- Performance benchmarks
- Bug escape rate (bugs found in production)

### Weekly QA Reports
- Phase 1 feature completion status
- Critical bug status and resolution timeline
- Cross-browser compatibility matrix
- Performance trend analysis

---

**Quality is non-negotiable. Every Phase 1 feature must work perfectly across all supported browsers.**