#!/usr/bin/env python3
"""
Load DynamoDB batches into LocalStack (or real AWS).
Run AFTER generate.py

Usage:
  python3 database/seeds/load_dynamo.py --endpoint http://localhost:4566   # LocalStack
  python3 database/seeds/load_dynamo.py                                     # Real AWS
"""

import json, sys, time, argparse
import boto3
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

def load_batch(client, table_name: str, batch_file: Path, dry_run: bool) -> int:
    data = json.loads(batch_file.read_text())
    items = data["events"]

    if dry_run:
        return len(items)

    request_items = {
        table_name: [
            {"PutRequest": {"Item": item}}
            for item in items
        ]
    }

    # Retry unprocessed items (DDB throttle handling)
    retries = 0
    while request_items and retries < 5:
        resp = client.batch_write_item(RequestItems=request_items)
        request_items = resp.get("UnprocessedItems", {})
        if request_items:
            time.sleep(2 ** retries * 0.1)
            retries += 1

    return len(items)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--endpoint", default=None, help="Custom DynamoDB endpoint (e.g. LocalStack)")
    parser.add_argument("--region",   default="us-east-1")
    parser.add_argument("--env",      default="dev")
    parser.add_argument("--dry-run",  action="store_true")
    parser.add_argument("--workers",  type=int, default=4)
    args = parser.parse_args()

    table_name = f"blostemiq-{args.env}-partner-events"

    kwargs = {"region_name": args.region}
    if args.endpoint:
        kwargs["endpoint_url"] = args.endpoint
        kwargs["aws_access_key_id"] = "test"
        kwargs["aws_secret_access_key"] = "test"

    client = boto3.client("dynamodb", **kwargs)

    batch_dir = Path("database/seeds/dynamo_events")
    if not batch_dir.exists():
        print("❌ Run generate.py first!")
        sys.exit(1)

    batches = sorted(batch_dir.glob("batch_*.json"))
    print(f"📦 Loading {len(batches)} batches → {table_name}")
    if args.dry_run:
        print("🔍 DRY RUN — not writing to DynamoDB")

    total_items = 0
    failed = 0

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(load_batch, client, table_name, b, args.dry_run): b
            for b in batches
        }
        for i, future in enumerate(as_completed(futures)):
            try:
                count = future.result()
                total_items += count
                if (i + 1) % 50 == 0 or (i + 1) == len(batches):
                    print(f"  [{i+1}/{len(batches)}] {total_items:,} items loaded...")
            except Exception as e:
                failed += 1
                print(f"  ❌ Batch failed: {e}")

    print(f"\n✅ Done! {total_items:,} events loaded into {table_name}")
    if failed:
        print(f"⚠️  {failed} batches failed — re-run to retry")

if __name__ == "__main__":
    main()
