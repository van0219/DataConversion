"""
Comprehensive End-to-End Testing Script for FSM Conversion Workbench

Tests the complete conversion workflow:
1. Account creation and authentication
2. Schema fetching
3. Setup data sync
4. File upload
5. Auto-mapping
6. Validation (with large dataset)
7. Error export
8. Load to FSM (optional)

Usage:
    python test_e2e_comprehensive.py
"""

import requests
import json
import time
import csv
import os
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:5173"

# Test account credentials
TEST_ACCOUNT = {
    "account_name": "E2E_Test_Account",
    "project_name": "E2E Testing",
    "tenant_id": "TAMICS10_AX1",
    "base_url": "https://mingle-ionapi.inforcloudsuite.com",
    "oauth_url": "https://mingle-sso.inforcloudsuite.com/TAMICS10_AX1/as/",
    "username": "your_saak_here",  # Replace with actual SAAK
    "password": "your_secret_here"  # Replace with actual secret
}

# Test results
test_results = []

def log_test(test_name, status, message="", duration=0):
    """Log test result"""
    result = {
        "test": test_name,
        "status": status,
        "message": message,
        "duration": f"{duration:.2f}s",
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    
    status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⏭️"
    print(f"{status_icon} {test_name}: {status} ({duration:.2f}s)")
    if message:
        print(f"   {message}")

def test_health_check():
    """Test 1: Health check"""
    start = time.time()
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            log_test("Health Check", "PASS", "Backend is healthy", time.time() - start)
            return True
        else:
            log_test("Health Check", "FAIL", f"Status code: {response.status_code}", time.time() - start)
            return False
    except Exception as e:
        log_test("Health Check", "FAIL", str(e), time.time() - start)
        return False

def test_create_account():
    """Test 2: Create test account"""
    start = time.time()
    try:
        response = requests.post(f"{BASE_URL}/api/accounts/create", json=TEST_ACCOUNT)
        if response.status_code == 200:
            account_data = response.json()
            log_test("Create Account", "PASS", f"Account ID: {account_data['id']}", time.time() - start)
            return account_data
        else:
            log_test("Create Account", "FAIL", f"Status: {response.status_code}, {response.text}", time.time() - start)
            return None
    except Exception as e:
        log_test("Create Account", "FAIL", str(e), time.time() - start)
        return None

def test_login(account_name):
    """Test 3: Login"""
    start = time.time()
    try:
        response = requests.post(f"{BASE_URL}/api/accounts/login", json={"account_name": account_name})
        if response.status_code == 200:
            token_data = response.json()
            log_test("Login", "PASS", "JWT token received", time.time() - start)
            return token_data["access_token"]
        else:
            log_test("Login", "FAIL", f"Status: {response.status_code}", time.time() - start)
            return None
    except Exception as e:
        log_test("Login", "FAIL", str(e), time.time() - start)
        return None

def test_fetch_schema(token, business_class="GLTransactionInterface"):
    """Test 4: Fetch schema"""
    start = time.time()
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{BASE_URL}/api/schema/fetch",
            json={"business_class": business_class},
            headers=headers
        )
        if response.status_code == 200:
            schema_data = response.json()
            field_count = len(schema_data.get("fields", []))
            log_test("Fetch Schema", "PASS", f"{field_count} fields fetched", time.time() - start)
            return schema_data
        else:
            log_test("Fetch Schema", "FAIL", f"Status: {response.status_code}", time.time() - start)
            return None
    except Exception as e:
        log_test("Fetch Schema", "FAIL", str(e), time.time() - start)
        return None

def test_sync_setup_data(token):
    """Test 5: Sync setup data"""
    start = time.time()
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(f"{BASE_URL}/api/snapshot/sync/all", headers=headers)
        if response.status_code == 200:
            sync_data = response.json()
            total_records = sync_data.get("total_records", 0)
            log_test("Sync Setup Data", "PASS", f"{total_records} records synced", time.time() - start)
            return sync_data
        else:
            log_test("Sync Setup Data", "FAIL", f"Status: {response.status_code}", time.time() - start)
            return None
    except Exception as e:
        log_test("Sync Setup Data", "FAIL", str(e), time.time() - start)
        return None

def create_large_test_file(filename, num_records=10000):
    """Create a large test CSV file"""
    headers = ["Sequence", "PostingDate", "Account", "Amount", "Description", "Vendor"]
    
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        
        for i in range(1, num_records + 1):
            writer.writerow([
                i,
                "01/15/2024",
                "1000-100-000",
                f"{100 + (i % 1000)}.00",
                f"Test transaction {i}",
                f"VENDOR{(i % 100) + 1:03d}"
            ])
    
    return filename

def test_upload_file(token, filename, business_class="GLTransactionInterface"):
    """Test 6: Upload file"""
    start = time.time()
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        with open(filename, 'rb') as f:
            files = {'file': (os.path.basename(filename), f, 'text/csv')}
            data = {'business_class': business_class}
            
            response = requests.post(
                f"{BASE_URL}/api/upload/",
                files=files,
                data=data,
                headers=headers
            )
        
        if response.status_code == 200:
            upload_data = response.json()
            job_id = upload_data.get("job_id")
            log_test("Upload File", "PASS", f"Job ID: {job_id}", time.time() - start)
            return upload_data
        else:
            log_test("Upload File", "FAIL", f"Status: {response.status_code}, {response.text}", time.time() - start)
            return None
    except Exception as e:
        log_test("Upload File", "FAIL", str(e), time.time() - start)
        return None

def test_auto_mapping(token, job_id, business_class="GLTransactionInterface"):
    """Test 7: Auto-mapping"""
    start = time.time()
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{BASE_URL}/api/mapping/auto-map",
            json={"job_id": job_id, "business_class": business_class},
            headers=headers
        )
        
        if response.status_code == 200:
            mapping_data = response.json()
            mapped_count = len(mapping_data.get("mapping", {}))
            log_test("Auto-Mapping", "PASS", f"{mapped_count} fields mapped", time.time() - start)
            return mapping_data
        else:
            log_test("Auto-Mapping", "FAIL", f"Status: {response.status_code}", time.time() - start)
            return None
    except Exception as e:
        log_test("Auto-Mapping", "FAIL", str(e), time.time() - start)
        return None

def test_validation(token, job_id, mapping):
    """Test 8: Validation (streaming)"""
    start = time.time()
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{BASE_URL}/api/validation/start",
            json={"job_id": job_id, "mapping": mapping},
            headers=headers
        )
        
        if response.status_code == 200:
            # Poll for completion
            max_wait = 300  # 5 minutes
            poll_interval = 2
            elapsed = 0
            
            while elapsed < max_wait:
                progress_response = requests.get(
                    f"{BASE_URL}/api/validation/progress/{job_id}",
                    headers=headers
                )
                
                if progress_response.status_code == 200:
                    progress = progress_response.json()
                    status = progress.get("status")
                    
                    if status == "validated":
                        total = progress.get("total_records", 0)
                        valid = progress.get("valid_records", 0)
                        invalid = progress.get("invalid_records", 0)
                        log_test(
                            "Validation", 
                            "PASS", 
                            f"Total: {total}, Valid: {valid}, Invalid: {invalid}",
                            time.time() - start
                        )
                        return progress
                    elif status == "failed":
                        log_test("Validation", "FAIL", "Validation failed", time.time() - start)
                        return None
                
                time.sleep(poll_interval)
                elapsed += poll_interval
            
            log_test("Validation", "FAIL", "Timeout waiting for validation", time.time() - start)
            return None
        else:
            log_test("Validation", "FAIL", f"Status: {response.status_code}", time.time() - start)
            return None
    except Exception as e:
        log_test("Validation", "FAIL", str(e), time.time() - start)
        return None

def test_export_errors(token, job_id):
    """Test 9: Export errors"""
    start = time.time()
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{BASE_URL}/api/validation/export-errors/{job_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            # Save to file
            export_filename = f"errors_export_{job_id}.csv"
            with open(export_filename, 'wb') as f:
                f.write(response.content)
            
            # Count rows
            with open(export_filename, 'r') as f:
                row_count = sum(1 for line in f) - 1  # Exclude header
            
            log_test("Export Errors", "PASS", f"{row_count} error rows exported", time.time() - start)
            return export_filename
        else:
            log_test("Export Errors", "FAIL", f"Status: {response.status_code}", time.time() - start)
            return None
    except Exception as e:
        log_test("Export Errors", "FAIL", str(e), time.time() - start)
        return None

def test_performance_metrics(num_records, validation_time):
    """Test 10: Performance metrics"""
    start = time.time()
    try:
        records_per_second = num_records / validation_time if validation_time > 0 else 0
        
        # Performance targets
        target_rps = 500  # 500 records/second minimum
        
        if records_per_second >= target_rps:
            log_test(
                "Performance Metrics",
                "PASS",
                f"{records_per_second:.0f} records/second (target: {target_rps})",
                time.time() - start
            )
            return True
        else:
            log_test(
                "Performance Metrics",
                "FAIL",
                f"{records_per_second:.0f} records/second (below target: {target_rps})",
                time.time() - start
            )
            return False
    except Exception as e:
        log_test("Performance Metrics", "FAIL", str(e), time.time() - start)
        return False

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in test_results if r["status"] == "PASS")
    failed = sum(1 for r in test_results if r["status"] == "FAIL")
    skipped = sum(1 for r in test_results if r["status"] == "SKIP")
    total = len(test_results)
    
    print(f"\nTotal Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"⏭️  Skipped: {skipped}")
    print(f"\nSuccess Rate: {(passed/total*100):.1f}%")
    
    if failed > 0:
        print("\nFailed Tests:")
        for result in test_results:
            if result["status"] == "FAIL":
                print(f"  - {result['test']}: {result['message']}")
    
    # Save results to JSON
    with open('test_results_e2e.json', 'w') as f:
        json.dump(test_results, f, indent=2)
    
    print(f"\nDetailed results saved to: test_results_e2e.json")

def main():
    """Run all tests"""
    print("="*80)
    print("FSM CONVERSION WORKBENCH - COMPREHENSIVE E2E TESTING")
    print("="*80)
    print()
    
    # Test 1: Health check
    if not test_health_check():
        print("\n❌ Backend is not running. Please start the backend server.")
        return
    
    # Test 2: Create account
    account = test_create_account()
    if not account:
        print("\n❌ Failed to create test account. Stopping tests.")
        return
    
    # Test 3: Login
    token = test_login(TEST_ACCOUNT["account_name"])
    if not token:
        print("\n❌ Failed to login. Stopping tests.")
        return
    
    # Test 4: Fetch schema
    schema = test_fetch_schema(token)
    if not schema:
        print("\n⚠️  Schema fetch failed. Continuing with tests...")
    
    # Test 5: Sync setup data
    sync_result = test_sync_setup_data(token)
    if not sync_result:
        print("\n⚠️  Setup data sync failed. Continuing with tests...")
    
    # Create large test file
    print("\n📝 Creating large test file (10,000 records)...")
    test_file = create_large_test_file("test_large_file.csv", 10000)
    print(f"✅ Test file created: {test_file}")
    
    # Test 6: Upload file
    upload_result = test_upload_file(token, test_file)
    if not upload_result:
        print("\n❌ File upload failed. Stopping tests.")
        return
    
    job_id = upload_result.get("job_id")
    
    # Test 7: Auto-mapping
    mapping_result = test_auto_mapping(token, job_id)
    if not mapping_result:
        print("\n❌ Auto-mapping failed. Stopping tests.")
        return
    
    # Test 8: Validation
    validation_start = time.time()
    validation_result = test_validation(token, job_id, mapping_result.get("mapping"))
    validation_duration = time.time() - validation_start
    
    if not validation_result:
        print("\n❌ Validation failed. Stopping tests.")
        return
    
    # Test 9: Export errors
    if validation_result.get("invalid_records", 0) > 0:
        test_export_errors(token, job_id)
    else:
        log_test("Export Errors", "SKIP", "No errors to export", 0)
    
    # Test 10: Performance metrics
    test_performance_metrics(10000, validation_duration)
    
    # Print summary
    print_summary()
    
    # Cleanup
    print("\n🧹 Cleaning up test files...")
    try:
        if os.path.exists(test_file):
            os.remove(test_file)
            print(f"✅ Removed: {test_file}")
    except Exception as e:
        print(f"⚠️  Failed to remove test file: {e}")

if __name__ == "__main__":
    main()
