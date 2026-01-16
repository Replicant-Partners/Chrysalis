/**
 * Universal Adapter Task API Routes
 * 
 * REST API endpoints for executing tasks with the Universal Adapter.
 * 
 * @module api/adapter-tasks/routes
 */

import { Router, Request, Response } from 'express';
import { createTaskExecutor, executeTask } from '../../adapters/universal/task-executor';
import type { Task, TaskResult } from '../../adapters/universal/task-executor';
import { createLogger } from '../../shared/logger';

const log = createLogger('adapter-tasks-api');
const router = Router();

/**
 * POST /api/adapter-tasks/execute
 * Execute a single task
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const task = req.body as Task;
    
    if (!task || !task.type) {
      return res.status(400).json({
        error: 'Invalid task',
        message: 'Task body must include a "type" field'
      });
    }
    
    log.info('Executing task via API', { type: task.type, name: task.name });
    
    const result = await executeTask(task);
    
    res.status(result.success ? 200 : 500).json(result);
    
  } catch (error) {
    log.error('Task execution failed', { error });
    res.status(500).json({
      error: 'Task execution failed',
      message: (error as Error).message
    });
  }
});

/**
 * POST /api/adapter-tasks/batch
 * Execute multiple tasks
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { tasks, stopOnError = false } = req.body;
    
    if (!Array.isArray(tasks)) {
      return res.status(400).json({
        error: 'Invalid batch request',
        message: 'Body must include "tasks" array'
      });
    }
    
    log.info('Executing batch tasks via API', { count: tasks.length });
    
    const batchTask: Task = {
      type: 'batch',
      name: 'API Batch Request',
      tasks,
      stopOnError
    };
    
    const result = await executeTask(batchTask);
    
    res.status(result.success ? 200 : 500).json(result);
    
  } catch (error) {
    log.error('Batch execution failed', { error });
    res.status(500).json({
      error: 'Batch execution failed',
      message: (error as Error).message
    });
  }
});

/**
 * POST /api/adapter-tasks/translate
 * Quick translation endpoint
 */
router.post('/translate', async (req: Request, res: Response) => {
  try {
    const { agent, sourceProtocol, targetProtocol, options } = req.body;
    
    if (!agent || !sourceProtocol || !targetProtocol) {
      return res.status(400).json({
        error: 'Invalid translation request',
        message: 'Body must include agent, sourceProtocol, and targetProtocol'
      });
    }
    
    const task: Task = {
      type: 'translate',
      name: 'API Translation',
      sourceProtocol,
      targetProtocol,
      agent,
      options
    };
    
    const result = await executeTask(task);
    
    res.status(result.success ? 200 : 500).json(result);
    
  } catch (error) {
    log.error('Translation failed', { error });
    res.status(500).json({
      error: 'Translation failed',
      message: (error as Error).message
    });
  }
});

/**
 * POST /api/adapter-tasks/morph
 * Quick morphing endpoint
 */
router.post('/morph', async (req: Request, res: Response) => {
  try {
    const { agent, sourceProtocol, targetProtocol, options } = req.body;
    
    if (!agent || !sourceProtocol || !targetProtocol) {
      return res.status(400).json({
        error: 'Invalid morphing request',
        message: 'Body must include agent, sourceProtocol, and targetProtocol'
      });
    }
    
    const task: Task = {
      type: 'morph',
      name: 'API Morphing',
      sourceProtocol,
      targetProtocol,
      agent,
      options
    };
    
    const result = await executeTask(task);
    
    res.status(result.success ? 200 : 500).json(result);
    
  } catch (error) {
    log.error('Morphing failed', { error });
    res.status(500).json({
      error: 'Morphing failed',
      message: (error as Error).message
    });
  }
});

/**
 * POST /api/adapter-tasks/validate
 * Quick validation endpoint
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { agent, protocol } = req.body;
    
    if (!agent || !protocol) {
      return res.status(400).json({
        error: 'Invalid validation request',
        message: 'Body must include agent and protocol'
      });
    }
    
    const task: Task = {
      type: 'validate',
      name: 'API Validation',
      protocol,
      agent
    };
    
    const result = await executeTask(task);
    
    res.status(result.success ? 200 : 500).json(result);
    
  } catch (error) {
    log.error('Validation failed', { error });
    res.status(500).json({
      error: 'Validation failed',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/adapter-tasks/protocols
 * List available protocols
 */
router.get('/protocols', (req: Request, res: Response) => {
  try {
    const executor = createTaskExecutor();
    const protocols = executor['adapter'].listProtocols();
    
    res.json({
      protocols,
      count: protocols.length
    });
    
  } catch (error) {
    log.error('Failed to list protocols', { error });
    res.status(500).json({
      error: 'Failed to list protocols',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/adapter-tasks/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'adapter-tasks-api',
    timestamp: new Date().toISOString()
  });
});

export default router;