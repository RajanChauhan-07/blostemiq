import { Kafka, logLevel } from 'kafkajs';

export const kafka = new Kafka({
  clientId: 'partner-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  logLevel: logLevel.WARN,
  retry: {
    initialRetryTime: 300,
    retries: 5,
  },
});

// Singleton producer
let _producer: ReturnType<typeof kafka.producer> | null = null;

export async function getProducer() {
  if (!_producer) {
    _producer = kafka.producer();
    await _producer.connect();
  }
  return _producer;
}

// Topics
export const TOPICS = {
  PARTNER_EVENTS:  'partner.events',
  CHURN_ALERTS:    'churn.alerts',
  LEAD_SCORED:     'lead.scored',
  OUTREACH_SENT:   'outreach.sent',
  AUDIT_LOG:       'audit.log',
} as const;
