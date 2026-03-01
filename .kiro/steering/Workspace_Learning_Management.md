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

### Critical: Pydantic Schema Validation - CHECK SCHEMAS FIRST

**RULE**: When backend returns data but frontend receives `undefined` for specific fields, check Pydantic response schemas IMMEDIATELY.

**Problem Pattern**:
- Backend service returns field in dictionary: `{"filename": "file.csv"}`
- Frontend receives `undefined` for that field
- Backend logs show no errors
- API endpoint returns 200 OK

**Root Cause**: Pydantic `response_model` filters out fields not defined in the schema class.

**Immediate Action**:
1. ✅ **Check the router's response_model** - Look at the endpoint decorator
2. ✅ **Check the Pydantic schema class** - Verify all fields are defined
3. ✅ **Add missing fields to schema** - Update the BaseModel class
4. ✅ **Restart backend** - Uvicorn should auto-reload

**Example**: Export filename issue (March 2026)
- Backend service returned `{"filename": job.filename}` in `get_progress()`
- Router had `response_model=ValidationProgress`
- `ValidationProgress` schema was missing `filename: str` field
- Pydantic filtered out the field, frontend received `undefined`
- Solution: Added `filename: str` to `ValidationProgress` class

**Code Pattern**:
```python
# Backend service (service.py)
def get_progress(...) -> Dict:
    return {
        "job_id": job_id,
        "filename": job.filename  # Added this field
    }

# Router (router.py)
@router.get("/{job_id}/progress", response_model=ValidationProgress)
def get_progress(...):
    return ValidationService.get_progress(...)

# Schema (schemas.py) - MUST MATCH SERVICE RETURN
class ValidationProgress(BaseModel):
    job_id: int
    filename: str  # MUST ADD THIS!
```

**Troubleshooting Checklist**:
1. ✅ Check backend service returns the field (add logging)
2. ✅ Check router has `response_model` parameter
3. ✅ Check Pydantic schema class has ALL fields
4. ✅ Check field types match (str, int, Optional[str], etc.)
5. ✅ Restart backend after schema changes

**DO NOT**:
- ❌ Assume backend isn't returning the data
- ❌ Debug frontend first (if backend returns 200 OK)
- ❌ Add complex header parsing workarounds
- ❌ Waste time with Content-Disposition headers

**DO**:
- ✅ Check Pydantic schemas FIRST when fields are undefined
- ✅ Verify schema matches service return dictionary
- ✅ Use simple solutions (add field to schema)

### Critical: Code Changes Not Applying - IMMEDIATE ACTION

**RULE**: When code changes don't apply after editing files, do a COMPLETE CLEAN RESTART immediately. Don't waste time with incremental troubleshooting.

**BUT FIRST**: Check if the issue is in BOTH frontend AND backend!

**Troubleshooting Checklist**:
1. ✅ **Check BOTH frontend and backend code** - Don't assume the issue is only in one place
2. ✅ **Trace the complete flow** - From UI button → API call → Backend endpoint
3. ✅ **Check for hardcoded values** - Frontend might override backend responses
4. ✅ **Then do clean restart** if code changes aren't applying

**Example**: Export filename issue
- Backend was setting correct filename in Content-Disposition header
- Frontend was IGNORING it and using hardcoded `validation_errors_${jobId}.csv`
- Wasted hours troubleshooting backend when frontend was the problem

**Immediate Action Sequence**:
```powershell
# 1. Stop ALL processes
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Clear ALL Python cache
Get-ChildItem -Path backend/app -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force

# 3. Start fresh
cd backend
python -m uvicorn app.main:app --reload
```

**DO NOT**:
- ❌ Try restarting just once and hope it works
- ❌ Check if files are correct (waste of time)
- ❌ Add debug logging to verify (adds more complexity)
- ❌ Try multiple small restarts
- ❌ Assume --reload flag will catch changes

**DO**:
- ✅ Kill ALL Python processes immediately
- ✅ Clear ALL __pycache__ directories
- ✅ Do ONE complete clean restart
- ✅ Test immediately after restart

**Why**: Python bytecode caching and multiple process instances cause code changes to not apply. A complete clean restart solves 99% of these issues immediately.

### User Communication Best Practices

**Rule**: When instructing users to test the application, always refer to the frontend URL, not backend API ports.

**Correct Communication**:
- ✅ "Open http://localhost:5173 in your browser to test"
- ✅ "Refresh the frontend and try the workflow"
- ✅ "Go to the app and upload your file"

**Incorrect Communication**:
- ❌ "The server is ready at http://localhost:8000" (backend API, not user-facing)
- ❌ "Check port 8000" (confusing for users)
- ❌ Mentioning backend ports when asking users to test features

**Rationale**: Users interact with the frontend application, not the backend API directly. Mentioning backend ports causes confusion about which URL to use.

**Application URLs**:
- Frontend (user-facing): http://localhost:5173
- Backend API (internal): http://localhost:8000
- API Documentation: http://localhost:8000/docs

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
