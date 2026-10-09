import { useState, useEffect, useRef, useCallback } from 'react';
import mqtt from 'mqtt';

const DEFAULT_BROKER_URL = 'wss://broker.hivemq.com:8084/mqtt';
const DEFAULT_TOPIC = 'izanagi/sensors/data';

/**
 * useMqttTelemetry
 * Consumes real-time MQTT telemetry stream from HiveMQ (wss://broker.hivemq.com:8084/mqtt).
 * Topic: izanagi/sensors/data
 * Payload schema: { "pulse_val": number, "force_n": number, "hub_online": boolean, "lat": string, "lng": string }
 * Auto-reconnects on drop and updates smoothly without blocking the UI thread.
 */
export function useMqttTelemetry(options = {}) {
  const brokerUrl = options.brokerUrl || DEFAULT_BROKER_URL;
  const topic = options.topic || DEFAULT_TOPIC;

  const [telemetry, setTelemetry] = useState({
    pulse_val: 74,
    force_n: 1840,
    hub_online: true,
    lat: '12.871773',
    lng: '77.576856'
  });

  const [connectionStatus, setConnectionStatus] = useState('CONNECTING'); // 'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'OFFLINE'
  const [packetCount, setPacketCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());
  const [history, setHistory] = useState([72, 74, 76, 75, 78, 80, 77, 75, 74, 76]);

  const clientRef = useRef(null);
  const pendingUpdateRef = useRef(null);

  const processPacket = useCallback((payload) => {
    try {
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      
      // Support both pulse_val and pulse_bpm (from ESP32 / Arduino payloads)
      const rawPulse = data.pulse_val ?? data.pulse_bpm ?? data.pulse ?? data.hr;
      const rawForce = data.force_n ?? data.force ?? data.bed_force ?? data.weight;
      const rawHub = data.hub_online ?? data.hubOnline ?? data.online;
      const rawLat = data.lat ?? data.latitude ?? '12.871773';
      const rawLng = data.lng ?? data.longitude ?? '77.576856';

      const newTelemetry = {
        pulse_val: typeof rawPulse === 'number' ? rawPulse : Number(rawPulse) || 72,
        force_n: typeof rawForce === 'number' ? rawForce : Number(rawForce) || 0,
        hub_online: rawHub !== undefined ? (typeof rawHub === 'boolean' ? rawHub : String(rawHub).toLowerCase() === 'true') : true,
        lat: String(rawLat),
        lng: String(rawLng)
      };

      console.log('[MQTT Stream] Ingested packet on', topic, '=>', newTelemetry);

      // Non-blocking state update using requestAnimationFrame to avoid UI stutter
      if (pendingUpdateRef.current) {
        cancelAnimationFrame(pendingUpdateRef.current);
      }

      pendingUpdateRef.current = requestAnimationFrame(() => {
        setTelemetry(newTelemetry);
        setPacketCount(prev => prev + 1);
        setLastUpdated(new Date().toLocaleTimeString());
        setHistory(prev => {
          const next = [...prev.slice(-19), newTelemetry.pulse_val];
          return next;
        });
      });
    } catch (err) {
      console.warn('[MQTT] Failed to parse payload:', err);
    }
  }, [topic]);

  useEffect(() => {
    let isSubscribed = true;

    try {
      const clientId = 'MacBook_Dashboard_' + Math.random().toString(16).substring(2, 8);
      const client = mqtt.connect(brokerUrl, {
        clientId,
        keepalive: 60,
        reconnectPeriod: 1000,
        clean: true,
      });

      clientRef.current = client;

      client.on('connect', () => {
        if (!isSubscribed) return;
        setConnectionStatus('CONNECTED');
        console.log('Connected to HiveMQ WSS!');
        client.subscribe(topic);
      });

      client.on('reconnect', () => {
        if (isSubscribed) setConnectionStatus('RECONNECTING');
      });

      client.on('offline', () => {
        if (isSubscribed) setConnectionStatus('OFFLINE');
      });

      client.on('error', (err) => {
        console.warn('[MQTT] Client error:', err?.message || err);
        if (isSubscribed) setConnectionStatus('RECONNECTING');
      });

      client.on('message', (incomingTopic, messageBuffer) => {
        if (!isSubscribed) return;
        if (incomingTopic === topic) {
          const text = messageBuffer.toString();
          processPacket(text);
        }
      });
    } catch (err) {
      console.error('[MQTT] Connection initialization failed:', err);
      setConnectionStatus('OFFLINE');
    }

    return () => {
      isSubscribed = false;
      if (pendingUpdateRef.current) {
        cancelAnimationFrame(pendingUpdateRef.current);
      }
      if (clientRef.current) {
        try {
          clientRef.current.end(true);
        } catch (_) {}
      }
    };
  }, [brokerUrl, topic, processPacket]);

  // Allows UI to simulate a packet locally or publish for end-to-end testing
  const injectSamplePacket = useCallback((override = {}) => {
    const sample = {
      pulse_val: Math.floor(68 + Math.random() * 24),
      force_n: Math.floor(1400 + Math.random() * 1200),
      hub_online: true,
      lat: '12.871773',
      lng: '77.576856',
      ...override
    };
    processPacket(sample);

    // Also attempt publish to topic if client is connected
    if (clientRef.current && clientRef.current.connected) {
      try {
        clientRef.current.publish(topic, JSON.stringify(sample), { qos: 0 });
      } catch (e) {
        console.warn('[MQTT] Publish error:', e);
      }
    }
  }, [topic, processPacket]);

  return {
    telemetry,
    connectionStatus,
    packetCount,
    lastUpdated,
    pulseHistory: history,
    brokerUrl,
    topic,
    injectSamplePacket
  };
}
