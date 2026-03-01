---
inclusion: auto
name: workspace-learning
description: Knowledge management, steering file creation, documentation standards, learning capture, content structure, update workflows, quality validation. Use when creating steering files, updating documentation, or establishing standards.
---

# Workspace Learning Management for Kiro

## Purpose

This steering file establishes meta-rules for managing knowledge, learnings, and documentation within the workspace. It ensures that new insights, successful patterns, and lessons learned are systematically captured and made available for future sessions.

## Core Principles

### 1. Continuous Learning Capture

**Rule**: Always update steering files when new learnings emerge from user interactions, implementations, or problem-solving sessions.

**When to Update**:

- Successful implementation of new features or integrations
- Discovery of working solutions to previously unsolved problems
- Identification of best practices through trial and error
- User feedback that reveals better approaches
- Performance optimizations or configuration improvements
- Error patterns and their proven solutions

### 2. Knowledge Organization Strategy

**Rule**: Organize learnings into appropriate steering files based on topic relevance and scope.

**Decision Matrix**:

- **Create New Steering File** when:
  - Learning covers a completely new domain or technology
  - Topic is substantial enough to warrant dedicated guidance
  - Content would be >50% of an existing file if added
  - Learning establishes new workflows or methodologies

- **Update Existing Steering File** when:
  - Learning enhances or refines existing guidance
  - New information fits within current file scope
  - Adding practical examples or proven patterns
  - Correcting or improving existing instructions

- **Create Section in Existing File** when:
  - Learning is related but distinct from current content
  - Adding implementation details to theoretical guidance
  - Documenting variations or alternatives to existing approaches

### 3. Steering File Naming Conventions

**Rule**: Use clear, descriptive names that indicate scope and purpose.

**Naming Patterns**:

- `[Technology]_[Purpose].md` - e.g., `FSM_MCP_Server_Usage.md`
- `[Domain]_[Methodology].md` - e.g., `FSM_Data_Conversion_Methodology.md`
- `[System]_[Component]_Reference.md` - e.g., `FSM_Business_Classes_Reference.md`
- `[Workspace]_[Process]_Management.md` - e.g., `Workspace_Learning_Management.md`

### 4. Content Structure Standards

**Rule**: Maintain consistent structure across steering files for easy navigation and reference.

**Required Sections**:

- **Purpose/Overview** - What this guidance covers
- **Key Concepts** - Important definitions and principles
- **Implementation Details** - How to apply the guidance
- **Best Practices** - Proven approaches and patterns
- **Common Issues** - Known problems and solutions
- **Examples** - Concrete illustrations of concepts

**Optional Sections**:

- **Performance Metrics** - Measurable outcomes
- **Configuration Details** - Technical setup information
- **Troubleshooting** - Diagnostic and resolution steps
- **Future Enhancements** - Planned improvements

## AI Assistant Guidelines for Learning Capture

### When to Capture Learnings

**Automatic Triggers** - Capture learnings immediately when:

1. **Successful Problem Resolution**
   - Document the problem, solution approach, and final resolution
   - Include any failed attempts and why they didn't work
   - Note any configuration changes or code modifications

2. **New Tool or Integration Implementation**
   - Document setup process and configuration requirements
   - Record any compatibility issues and solutions
   - Capture performance characteristics and limitations

3. **User Workflow Optimization**
   - Document improved processes or shortcuts discovered
   - Record user feedback and how it led to improvements
   - Note any changes in user experience or efficiency

4. **Error Pattern Identification**
   - Document recurring errors and their root causes
   - Record proven solutions and prevention strategies
   - Include diagnostic steps and troubleshooting procedures

**Manual Triggers** - Proactively review and update steering files when:

- Completing major project phases or milestones
- Receiving user feedback about documentation gaps
- Discovering outdated or incorrect information
- Learning about new features or capabilities
- Identifying opportunities for process improvement

### Decision Framework for AI Assistants

**Step 1: Identify Learning Type**

Ask yourself:

- What new knowledge was gained?
- How does this relate to existing steering files?
- Who would benefit from this information?
- What problems does this solve or prevent?

**Step 2: Determine Update Strategy**

```text
Is this a completely new domain/technology?
├─ Yes → Create new steering file
└─ No → Does existing file cover this topic?
    ├─ Yes → Update existing file
    └─ No → Evaluate if new section or new file is needed
```

**Step 3: Structure the Update**

Include these elements:

- **Context** - What situation led to this learning
- **Problem** - What challenge was being addressed
- **Solution** - What approach worked and why
- **Implementation** - Specific steps or configuration
- **Results** - Measurable outcomes or improvements
- **Lessons** - Key insights for future reference

**Step 4: Cross-Reference Updates**

Ensure consistency across related steering files:

- Update references in related files
- Add cross-links where appropriate
- Ensure terminology consistency
- Update any conflicting guidance

## Quality Standards for AI-Generated Content

### Content Quality Requirements

- **Accuracy** - Information must be tested and verified
- **Completeness** - Include all necessary context and details
- **Clarity** - Use clear, unambiguous language
- **Actionability** - Provide specific, implementable guidance
- **Currency** - Keep information up-to-date and relevant

### Documentation Standards

- Use consistent markdown formatting with proper blank lines
- Include code examples with proper syntax highlighting
- Use clear headings and section organization
- Provide examples and illustrations where helpful
- Include proper front matter (inclusion rules, name, description)

### Validation Process

Before finalizing updates:

- Verify technical accuracy through testing
- Ensure examples work as documented
- Check for consistency with existing guidance
- Review for clarity and completeness
- Test any provided commands or configurations

## Practical Implementation Examples

### Example 1: New MCP Server Implementation

**Trigger**: Successfully implemented FSM MCP server with authentication and data loading

**Action**: Created `FSM_MCP_Server_Usage.md` with complete tool documentation

**Cross-Updates**: Updated `FSM_Data_Conversion_Methodology.md` with practical implementation section

### Example 2: Configuration Issue Resolution

**Trigger**: Resolved MCP server path configuration problems

**Action**: Updated existing steering file with proven configuration patterns

**Documentation**: Added troubleshooting section with specific error messages and solutions

### Example 3: User Workflow Optimization

**Trigger**: Discovered more efficient file conversion process

**Action**: Updated methodology with streamlined workflow

**Validation**: Tested new process and documented performance improvements

## Maintenance and Continuous Improvement

### Regular Review Schedule

**Monthly Reviews** - Check all steering files for:

- Outdated information or broken links
- Missing coverage of recent learnings
- Opportunities for consolidation or reorganization
- User feedback incorporation

**Quarterly Reviews** - Comprehensive assessment of:

- Overall steering file organization
- Gaps in coverage or documentation
- Effectiveness of current guidance
- Need for new steering files or major updates

### Continuous Monitoring Activities

- Track which guidance is most frequently referenced
- Monitor for recurring questions that indicate documentation gaps
- Collect user feedback on documentation effectiveness
- Identify patterns in problem resolution that should be documented

## Success Metrics

### Learning Capture Effectiveness

- Reduction in repeated questions or issues
- Faster problem resolution times
- Improved user onboarding experience
- Decreased dependency on external documentation

### Documentation Quality Indicators

- User feedback on documentation usefulness
- Frequency of steering file references during problem-solving
- Success rate of following documented procedures
- Time saved through documented best practices

## Meta-Learning Principle

**Core Rule**: This steering file itself should be updated whenever new insights about learning management, documentation strategies, or knowledge capture processes are discovered.

**Self-Improvement Cycle**:

1. Apply these principles in practice
2. Observe what works and what doesn't
3. Refine the principles based on experience
4. Update this steering file with improvements
5. Repeat the cycle for continuous improvement

This ensures that not only do we capture domain-specific learnings, but we also continuously improve our ability to capture and organize knowledge effectively.

## Authors

Van Anthony Silleza - Infor FSM Technical Consultant - Knowledge management insights and continuous improvement methodology

Kiro AI Assistant - Framework Development - Learning capture framework, documentation standards, and meta-process design

Collaborative development - January 2026
