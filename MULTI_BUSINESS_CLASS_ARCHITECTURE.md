# Multi-Business-Class Architecture for FSM DataBridge

## Problem Statement

Different FSM business classes have different staging table structures and behaviors:

- **GLTransactionInterface**: Single staging table
- **PayablesInvoice**: Header + Lines tables
- **Complex AP/AR**: Header + Lines + Distributions tables

Steps 1-3 (Upload, Mapping, Validation) are universal, but Step 4 (Load) and future Step 5 (Post-Validation) need business class-specific handling.

## Solution: Strategy Pattern + Configuration-Driven Architecture

### 1. Business Class Configuration Table

**Table**: `business_class_configs`

Stores business class-specific metadata:

```python
{
    "business_class": "GLTransactionInterface",
    "load_type": "single_table",
    "related_tables": None,
    "load_sequence": None,
    "supports_interface": True,
    "interface_operation": "InterfaceTransactions_InterfaceTransactionsForm_FormOperation",
    "interface_result_table": "GLTransactionInterfaceResult",
    "rollback_operation": "DeleteAllTransactionsForRunGroup_DeleteAllTransactionsForRunGroupForm_FormOperation",
    "supports_rungroup": True,
    "post_validation_checks": ["balance_check"]
}
```

```python
{
    "business_class": "PayablesInvoice",
    "load_type": "header_lines",
    "related_tables": {
        "header": "PayablesInvoice",
        "lines": "PayablesInvoiceLine"
    },
    "load_sequence": ["header", "lines"],
    "supports_interface": False,
    "rollback_operation": "DeleteInvoice_DeleteInvoiceForm_FormOperation",
    "supports_rungroup": False,
    "post_validation_checks": ["line_total_match", "vendor_exists"]
}
```

### 2. Load Strategy Pattern

**Base Strategy**: `BaseLoadStrategy` (abstract class)

Defines interface for all load strategies:
- `load_records()` - Load data to FSM
- `rollback()` - Rollback on failure
- `interface()` - Post/interface transactions
- `verify_load()` - Verify load results

**Concrete Strategies**:

1. **SingleTableLoadStrategy** - For GLTransactionInterface
   - Single batch API call
   - RunGroup-based rollback
   - Interface operation support
   - Current implementation

2. **HeaderLinesLoadStrategy** - For PayablesInvoice, etc.
   - Load header first, get header ID
   - Load lines with header foreign key
   - Rollback both tables on failure
   - No interface operation

3. **HeaderLinesDistributionsLoadStrategy** - For complex AP/AR
   - Load header → lines → distributions in sequence
   - Maintain foreign key relationships
   - Cascade rollback on failure
   - Complex validation checks

### 3. Load Service Refactoring

**Current**: `LoadService.load_to_fsm()` has GLTransactionInterface logic hardcoded

**Proposed**: Strategy resolver pattern

```python
class LoadService:
    @staticmethod
    async def load_to_fsm(
        db: Session,
        account_id: int,
        job_id: int,
        business_class: str,
        mapping: Dict,
        trigger_interface: bool = False,
        interface_params: Optional[Dict] = None
    ) -> Dict:
        # Get business class configuration
        config = db.query(BusinessClassConfig).filter(
            BusinessClassConfig.business_class == business_class
        ).first()
        
        if not config:
            raise ValueError(f"No configuration found for {business_class}")
        
        # Resolve load strategy
        strategy = LoadStrategyFactory.create_strategy(
            load_type=config.load_type,
            business_class=business_class,
            config=config.to_dict()
        )
        
        # Execute load using strategy
        result = await strategy.load_records(
            db=db,
            fsm_client=fsm_client,
            records=records,
            mapping=mapping,
            run_group=run_group,
            load_mode=load_mode
        )
        
        # Interface if requested and supported
        if trigger_interface and strategy.supports_interface():
            interface_result = await strategy.interface(
                fsm_client=fsm_client,
                run_group=run_group,
                params=interface_params
            )
            result['interface_result'] = interface_result
        
        return result
```

### 4. Strategy Factory

```python
class LoadStrategyFactory:
    """Factory for creating load strategies"""
    
    STRATEGIES = {
        "single_table": SingleTableLoadStrategy,
        "header_lines": HeaderLinesLoadStrategy,
        "header_lines_distributions": HeaderLinesDistributionsLoadStrategy
    }
    
    @staticmethod
    def create_strategy(
        load_type: str,
        business_class: str,
        config: Dict
    ) -> BaseLoadStrategy:
        strategy_class = LoadStrategyFactory.STRATEGIES.get(load_type)
        
        if not strategy_class:
            raise ValueError(f"Unknown load type: {load_type}")
        
        return strategy_class(business_class, config)
```

### 5. Frontend Adaptations

**Step 4 (Load)**: Dynamic UI based on business class config

```typescript
// Fetch business class config
const config = await api.get(`/business-class/${businessClass}/config`);

// Show/hide interface option based on config
{config.supports_interface && (
  <label>
    <input type="checkbox" checked={triggerInterface} />
    Interface Transactions
  </label>
)}

// Show/hide RunGroup info
{config.supports_rungroup && (
  <div>RunGroup: {loadResult.run_group}</div>
)}

// Show appropriate post-load actions
{config.supports_interface && (
  <button onClick={handleInterface}>Interface Transactions</button>
)}
{config.supports_rungroup && (
  <button onClick={handleDelete}>Delete RunGroup</button>
)}
```

### 6. Post-Validation (Future Enhancement)

**Step 5**: Business class-specific post-validation checks

```python
class PostValidationService:
    @staticmethod
    async def run_post_validation(
        db: Session,
        job_id: int,
        business_class: str
    ) -> Dict:
        # Get business class config
        config = db.query(BusinessClassConfig).filter(
            BusinessClassConfig.business_class == business_class
        ).first()
        
        if not config or not config.post_validation_checks:
            return {"checks_run": 0, "passed": True}
        
        # Run configured checks
        results = []
        for check_name in config.post_validation_checks:
            checker = PostValidationCheckerFactory.create_checker(check_name)
            result = await checker.run(db, job_id)
            results.append(result)
        
        return {
            "checks_run": len(results),
            "passed": all(r['passed'] for r in results),
            "results": results
        }
```

**Post-Validation Checkers**:
- `BalanceChecker` - Verify debits = credits (GL)
- `LineTotalMatcher` - Verify header total = sum of lines (AP/AR)
- `VendorExistsChecker` - Verify vendor references (AP)
- `DuplicateChecker` - Check for duplicate invoices (AP)
- `CrossReferenceChecker` - Verify cross-module references

## Benefits

### 1. No Code Overlap
- Each business class has its own strategy implementation
- Shared logic in base class
- No if/else chains for business class detection

### 2. Easy Extensibility
- Add new business class: Create config + strategy (if needed)
- Reuse existing strategies for similar patterns
- No changes to core workflow (Steps 1-3)

### 3. Configuration-Driven
- Business class behaviors stored in database
- No code changes for new business classes
- UI adapts automatically based on config

### 4. Testable
- Each strategy can be unit tested independently
- Mock FSM client for testing
- Test different business class scenarios in isolation

### 5. Maintainable
- Clear separation of concerns
- Strategy pattern is well-understood
- Easy to debug business class-specific issues

## Implementation Plan

### Phase 1: Foundation (Current Sprint)
1. ✅ Create `business_class_configs` table
2. ✅ Create base strategy and single table strategy
3. ✅ Seed GLTransactionInterface configuration
4. ✅ Create strategy factory
5. ✅ Document architecture

### Phase 2: Refactor Load Service (Next Sprint)
1. Refactor `LoadService.load_to_fsm()` to use strategies
2. Update frontend to fetch business class config
3. Make UI dynamic based on config
4. Test with GLTransactionInterface (no behavior change)

### Phase 3: Add PayablesInvoice Support (Future)
1. Create `HeaderLinesLoadStrategy`
2. Add PayablesInvoice configuration
3. Test header/lines load workflow
4. Add PayablesInvoice-specific validation rules

### Phase 4: Post-Validation Framework (Future)
1. Create post-validation checker framework
2. Implement balance checker for GL
3. Implement line total matcher for AP/AR
4. Add Step 5 to UI workflow

## Migration Strategy

### Backward Compatibility

Current GLTransactionInterface code continues to work:
1. Seed `business_class_configs` with GLTransactionInterface
2. `SingleTableLoadStrategy` wraps existing logic
3. No breaking changes to API or UI
4. Gradual migration to strategy pattern

### Testing Strategy

1. **Unit Tests**: Test each strategy independently
2. **Integration Tests**: Test strategy factory and service integration
3. **E2E Tests**: Test complete workflow for each business class
4. **Regression Tests**: Ensure GLTransactionInterface still works

## Configuration Examples

### GLTransactionInterface (Current)
```sql
INSERT INTO business_class_configs (
    business_class, load_type, supports_interface, 
    interface_operation, interface_result_table, 
    rollback_operation, supports_rungroup, 
    post_validation_checks
) VALUES (
    'GLTransactionInterface', 'single_table', true,
    'InterfaceTransactions_InterfaceTransactionsForm_FormOperation',
    'GLTransactionInterfaceResult',
    'DeleteAllTransactionsForRunGroup_DeleteAllTransactionsForRunGroupForm_FormOperation',
    true,
    '["balance_check"]'
);
```

### PayablesInvoice (Future)
```sql
INSERT INTO business_class_configs (
    business_class, load_type, related_tables, 
    load_sequence, supports_interface, 
    rollback_operation, supports_rungroup,
    post_validation_checks
) VALUES (
    'PayablesInvoice', 'header_lines',
    '{"header": "PayablesInvoice", "lines": "PayablesInvoiceLine"}',
    '["header", "lines"]',
    false,
    'DeleteInvoice_DeleteInvoiceForm_FormOperation',
    false,
    '["line_total_match", "vendor_exists", "duplicate_check"]'
);
```

## Conclusion

This architecture provides:
- ✅ No code overlap between business classes
- ✅ Easy extensibility for new business classes
- ✅ Configuration-driven behavior
- ✅ Backward compatible with current implementation
- ✅ Clear separation of concerns
- ✅ Testable and maintainable

The strategy pattern + configuration approach ensures that adding new business classes (PayablesInvoice, Item, etc.) requires minimal code changes and no modifications to the core workflow (Steps 1-3).
