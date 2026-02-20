import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, AuthUser } from '../middleware/auth';
import { canAddCard } from '../services/entitlements';
import { maybeSendLimitEmail } from '../services/emailService';

const router = Router();
router.use(requireAuth);

function getUser(req: Request): AuthUser {
  return req.user! as AuthUser;
}

function param(req: Request, name: string): string {
  return req.params[name] as string;
}

// GET /api/boards
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boards = await prisma.board.findMany({
      where: { userId: getUser(req).id },
      include: { _count: { select: { cards: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(boards);
  } catch (err) {
    next(err);
  }
});

// POST /api/boards
const createBoardSchema = z.object({
  title: z.string().min(1).max(200),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title } = createBoardSchema.parse(req.body);
    const board = await prisma.board.create({
      data: { title, userId: getUser(req).id },
      include: { cards: true, categories: true },
    });
    res.status(201).json(board);
  } catch (err) {
    next(err);
  }
});

// GET /api/boards/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = param(req, 'id');
    const board = await prisma.board.findFirst({
      where: { id: boardId, userId: getUser(req).id },
      include: {
        cards: { orderBy: { order: 'asc' } },
        categories: true,
      },
    });
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    res.json(board);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/boards/:id
const updateBoardSchema = z.object({
  title: z.string().min(1).max(200),
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = param(req, 'id');
    const { title } = updateBoardSchema.parse(req.body);
    const board = await prisma.board.updateMany({
      where: { id: boardId, userId: getUser(req).id },
      data: { title },
    });
    if (board.count === 0) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/boards/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = param(req, 'id');
    const board = await prisma.board.findFirst({
      where: { id: boardId, userId: getUser(req).id },
    });
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    await prisma.board.delete({ where: { id: boardId } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/boards/:id/cards
const createCardSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().default(''),
  category: z.string().default(''),
  priority: z.string().default('medium'),
  dueDate: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  columnId: z.string().default('todo'),
});

router.post('/:id/cards', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = param(req, 'id');
    const userId = getUser(req).id;
    const board = await prisma.board.findFirst({
      where: { id: boardId, userId },
    });
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }

    // Check account-wide card limit
    const check = await canAddCard(userId);
    if (!check.allowed) {
      await maybeSendLimitEmail(userId, check.tier);
      res.status(403).json({
        error: 'Card limit reached',
        code: 'CARD_LIMIT_EXCEEDED',
        limit: check.limit,
        currentCount: check.currentCount,
        tier: check.tier,
      });
      return;
    }

    const data = createCardSchema.parse(req.body);

    // Get max order for the column
    const maxOrderCard = await prisma.card.findFirst({
      where: { boardId, columnId: data.columnId },
      orderBy: { order: 'desc' },
    });
    const order = (maxOrderCard?.order ?? -1) + 1;

    const card = await prisma.card.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        tags: data.tags,
        columnId: data.columnId,
        boardId,
        order,
      },
    });

    // Auto-add category if new
    if (data.category) {
      await prisma.category.upsert({
        where: { boardId_name: { boardId, name: data.category } },
        update: {},
        create: {
          boardId,
          name: data.category,
          color: generateCategoryColor(data.category),
        },
      });
    }

    res.status(201).json(card);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/boards/:id/cards/:cardId
const updateCardSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  columnId: z.string().optional(),
  order: z.number().optional(),
});

router.patch('/:id/cards/:cardId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = param(req, 'id');
    const cardId = param(req, 'cardId');
    const board = await prisma.board.findFirst({
      where: { id: boardId, userId: getUser(req).id },
    });
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }

    const data = updateCardSchema.parse(req.body);
    const updateData: Record<string, unknown> = { ...data };
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }

    const card = await prisma.card.updateMany({
      where: { id: cardId, boardId },
      data: updateData,
    });
    if (card.count === 0) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    // Auto-add category if new
    if (data.category) {
      await prisma.category.upsert({
        where: { boardId_name: { boardId, name: data.category } },
        update: {},
        create: {
          boardId,
          name: data.category,
          color: generateCategoryColor(data.category),
        },
      });
    }

    const updated = await prisma.card.findUnique({ where: { id: cardId } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/boards/:id/cards/:cardId
router.delete('/:id/cards/:cardId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = param(req, 'id');
    const cardId = param(req, 'cardId');
    const board = await prisma.board.findFirst({
      where: { id: boardId, userId: getUser(req).id },
    });
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }

    const card = await prisma.card.deleteMany({
      where: { id: cardId, boardId },
    });
    if (card.count === 0) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/boards/:id/cards/reorder
const reorderSchema = z.object({
  cards: z.array(
    z.object({
      id: z.string(),
      columnId: z.string(),
      order: z.number(),
    })
  ),
});

router.post('/:id/cards/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const boardId = param(req, 'id');
    const board = await prisma.board.findFirst({
      where: { id: boardId, userId: getUser(req).id },
    });
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }

    const { cards } = reorderSchema.parse(req.body);

    await prisma.$transaction(
      cards.map((c) =>
        prisma.card.updateMany({
          where: { id: c.id, boardId },
          data: { columnId: c.columnId, order: c.order },
        })
      )
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/boards/import
const importSchema = z.object({
  boards: z.array(
    z.object({
      title: z.string(),
      cards: z.array(
        z.object({
          title: z.string(),
          description: z.string().default(''),
          category: z.string().default(''),
          priority: z.string().default('medium'),
          dueDate: z.string().nullable().default(null),
          tags: z.array(z.string()).default([]),
          columnId: z.string(),
          order: z.number(),
        })
      ),
      categories: z.array(z.string()).default([]),
      categoryColors: z
        .array(z.object({ category: z.string(), color: z.string() }))
        .default([]),
    })
  ),
});

router.post('/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { boards } = importSchema.parse(req.body);
    const userId = getUser(req).id;

    // Check if user already has boards
    const existingCount = await prisma.board.count({ where: { userId } });
    if (existingCount > 0) {
      res.status(409).json({ error: 'Import is only available for new accounts with no boards' });
      return;
    }

    for (const boardData of boards) {
      const board = await prisma.board.create({
        data: { title: boardData.title, userId },
      });

      // Create categories
      const colorMap: Record<string, string> = {};
      for (const cc of boardData.categoryColors) {
        colorMap[cc.category] = cc.color;
      }
      for (const catName of boardData.categories) {
        await prisma.category.create({
          data: {
            boardId: board.id,
            name: catName,
            color: colorMap[catName] || generateCategoryColor(catName),
          },
        });
      }

      // Create cards
      for (const cardData of boardData.cards) {
        await prisma.card.create({
          data: {
            boardId: board.id,
            title: cardData.title,
            description: cardData.description,
            category: cardData.category,
            priority: cardData.priority,
            dueDate: cardData.dueDate ? new Date(cardData.dueDate) : null,
            tags: cardData.tags,
            columnId: cardData.columnId,
            order: cardData.order,
          },
        });
      }
    }

    res.status(201).json({ ok: true, imported: boards.length });
  } catch (err) {
    next(err);
  }
});

// Helper: deterministic category color (matches client-side logic)
function generateCategoryColor(categoryName: string): string {
  const VIBRANT_HUES = [0, 25, 45, 120, 160, 195, 220, 260, 290, 320, 340];
  let hash = 0;
  const name = categoryName.toLowerCase().trim();
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);
  const hue = VIBRANT_HUES[hash % VIBRANT_HUES.length];
  const saturation = 70 + (hash % 20);
  const lightness = 55 + (hash % 15);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export default router;
