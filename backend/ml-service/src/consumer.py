import os
import json
import logging
from confluent_kafka import Consumer, KafkaError
import redis
import boto3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "my-kafka.blostemiq.svc.cluster.local:9092")
REDIS_URL = os.environ.get("REDIS_URL", "redis://blostemiq-dev-redis.t6n5iw.0001.use1.cache.amazonaws.com:6379")

# Init Redis
r = redis.from_url(REDIS_URL, decode_responses=True)

# Int DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
# For local fallback or actual AWS Table (already deployed by terraform)
events_table = dynamodb.Table('blostemiq-dev-partner-events')

def process_message(msg):
    try:
        val = json.loads(msg.value().decode('utf-8'))
        org_id = val.get("org_id")
        event_type = val.get("eventType")
        partner_id = val.get("partner_id")
        timestamp = val.get("timestamp")
        
        # 1. Update rolling metrics in Redis
        # e.g., count API calls per partner
        if event_type == "api_call":
            r.hincrby(f"partner_metrics:{partner_id}", "api_calls_7d", 1)
        
        # 2. Write to DynamoDB
        if org_id and timestamp:
            events_table.put_item(
                Item={
                    "org_id": org_id,
                    "timestamp": timestamp,
                    "event_type": event_type,
                    "payload": json.dumps(val)
                }
            )
            
        logger.info(f"Processed event {event_type} for org {org_id}")
    except Exception as e:
        logger.error(f"Error processing message: {e}")

def main():
    conf = {
        'bootstrap.servers': KAFKA_BROKERS,
        'group.id': 'ml-consumer-group',
        'auto.offset.reset': 'earliest'
    }

    consumer = Consumer(conf)
    consumer.subscribe(['partner.events'])
    
    logger.info(f"Started Kafka consumer on {KAFKA_BROKERS}")

    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    logger.error(msg.error())
                    break

            process_message(msg)

    except KeyboardInterrupt:
        pass
    finally:
        consumer.close()

if __name__ == '__main__':
    main()
