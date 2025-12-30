import { TransformerEmbeddingService, MockEmbeddingService } from '../src/memory/EmbeddingService';

describe('EmbeddingService', () => {
  test('MockEmbeddingService returns deterministic embeddings', async () => {
    const service = new MockEmbeddingService({ dimensions: 8 });
    await service.initialize();
    
    const v1 = await service.embed('hello');
    const v2 = await service.embed('hello');
    
    expect(v1).toEqual(v2);
    expect(v1.length).toBe(8);
  });
  
  test('TransformerEmbeddingService uses provided pipeline loader', async () => {
    const fakeVector = [1, 0, 0, 0];
    const loader = jest.fn().mockResolvedValue(async () => ({
      data: Float32Array.from(fakeVector)
    }));
    
    // Pipeline loader returns a function; mimic transformers.js contract
    const pipelineLoader = async () => {
      return async (_task: string, _model: string) => loader();
    };
    
    const service = new TransformerEmbeddingService({ dimensions: 4 }, pipelineLoader as any);
    await service.initialize();
    
    const v = await service.embed('hi');
    expect(loader).toHaveBeenCalled();
    expect(v.length).toBe(4);
  });
});
