import { createExperienceTransport } from '../src/sync/ExperienceTransport';

describe('ExperienceTransport', () => {
  test('HTTPS transport routes via delivery hook when provided', async () => {
    const received: any[] = [];
    const transport = createExperienceTransport(
      'inst-1',
      { type: 'https', https: { endpoint: 'https://example.com/sync' } },
      async payload => {
        received.push(payload);
      }
    );
    
    await transport.sendEvents('inst-1', [{ event_id: 'e1', timestamp: '', source_instance: 'inst-1', event_type: 'memory', priority: 1, data: {}, context: { trigger: '', environment: {} } }]);
    expect(received.length).toBe(1);
    expect(received[0].kind).toBe('events');
  });
  
  test('WebSocket transport uses factory and delivery hook', async () => {
    const sent: any[] = [];
    const fakeClient = { send: (data: string) => { sent.push(data); }, readyState: 1, OPEN: 1 };
    const transport = createExperienceTransport(
      'inst-2',
      { type: 'websocket', websocket: { url: 'ws://localhost' } },
      async payload => {
        sent.push(payload);
      }
    );
    
    // Inject factory via global WebSocket
    (global as any).WebSocket = jest.fn().mockReturnValue(fakeClient);
    
    await transport.sendBatch('inst-2', {
      batch_id: 'b1',
      instance_id: 'inst-2',
      timestamp_start: '',
      timestamp_end: '',
      event_count: 0,
      events: { memories: [], skills: [], knowledge: [], interactions: [], stats: {} }
    });
    
    expect(sent.length).toBe(1);
  });
});
