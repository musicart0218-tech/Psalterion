import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma, isDbAvailable, memoryUsers, memoryCharacters } from '../config/prisma';

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'astra_super_secret_key';

// 📝 Account Registration Endpoint
authRouter.post('/register', async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, email, password, characterName, className, gender } = req.body;

    // Validate inputs
    if (!username || !email || !password || !characterName || !className) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const userClass = className.toUpperCase();
    const userGender = gender === 'F' ? 'F' : 'M';

    try {
      if (!isDbAvailable) {
        throw new Error('DATABASE_URL_NOT_SET');
      }

      // 1. Attempt using Prisma PostgreSQL backend
      const userExists = await prisma.user.findFirst({
        where: { OR: [{ username }, { email }] }
      });
      if (userExists) return res.status(400).json({ error: 'Username or Email already registered.' });

      const charExists = await prisma.character.findUnique({ where: { name: characterName } });
      if (charExists) return res.status(400).json({ error: 'Character identity name already claimed.' });

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Map WARRIOR/MAGE/ARCHER to database ClassType equivalents
      let dbClass: any = 'GUARDIAN';
      if (userClass === 'MAGE') dbClass = 'ARCANIST';
      if (userClass === 'ARCHER') dbClass = 'RANGER';

      const newUser = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          isGm: username.toLowerCase().includes('gm_') || username === 'admin',
          characters: {
            create: {
              name: characterName,
              class: dbClass,
              currentMap: 'asterhaven',
              positionX: 400.0,
              positionY: 300.0
            }
          }
        },
        include: { characters: true }
      });

      return res.status(201).json({ message: 'Account forged successfully!', userId: newUser.id });
    } catch (dbError: any) {
      if (dbError?.message !== 'DATABASE_URL_NOT_SET') {
        console.warn('⚠️ SQL Database unavailable, falling back to secure local-memory registry:', dbError);
      } else {
        console.log('ℹ️ Running in sandbox local-memory mode (DATABASE_URL not configured).');
      }
      
      const normalizedUsername = username.toLowerCase();
      if (memoryUsers.has(normalizedUsername)) {
        return res.status(400).json({ error: 'Username already registered.' });
      }

      // Check unique character names
      const characterNameExists = Array.from(memoryCharacters.values()).some(
        (c: any) => c.name.toLowerCase() === characterName.toLowerCase()
      );
      if (characterNameExists) {
        return res.status(400).json({ error: 'Character identity name already claimed.' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const memUser = {
        id: `mem_u_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        username,
        email,
        passwordHash,
        isGm: username.toLowerCase().includes('gm_') || username === 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const memChar = {
        id: `mem_c_${Date.now()}`,
        userId: memUser.id,
        name: characterName,
        class: userClass, // Keep Warrior / Mage / Archer
        gender: userGender,
        currentMap: 'asterhaven',
        positionX: 200.0,
        positionY: 200.0,
        level: 1,
        experience: 0,
        gold: 100,
        currentHp: userClass === 'WARRIOR' ? 140 : userClass === 'MAGE' ? 80 : 95,
        maxHp: userClass === 'WARRIOR' ? 140 : userClass === 'MAGE' ? 80 : 95,
        currentMana: userClass === 'MAGE' ? 100 : 50,
        maxMana: userClass === 'MAGE' ? 100 : 50
      };

      memoryUsers.set(normalizedUsername, memUser);
      memoryCharacters.set(memChar.id, memChar);

      return res.status(201).json({ message: 'Account forged successfully! (Local Session Created)', userId: memUser.id });
    }
  } catch (error) {
    console.error('Registration Exception:', error);
    return res.status(500).json({ error: 'Internal system fault during registration.' });
  }
});

// 🔑 Account Login Endpoint
authRouter.post('/login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
      if (!isDbAvailable) {
        throw new Error('DATABASE_URL_NOT_SET');
      }

      // 1. Attempt database lookup
      const user = await prisma.user.findUnique({
        where: { username },
        include: { characters: true }
      });

      if (!user) {
        // Fall through to in-memory lookup if user is not in database,
        // or throw to reach catch block if db is dead
        throw new Error('USER_NOT_FOUND_IN_DB');
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) return res.status(400).json({ error: 'Invalid credentials.' });

      // Generate token signature
      const token = jwt.sign({ userId: user.id, isGm: user.isGm }, JWT_SECRET, { expiresIn: '24h' });

      // Convert BigInt to Number for safe JSON serialization
      const primaryChar = user.characters[0];
      
      // Map database ClassType back to client PlayerClass types
      let clientClass: any = 'WARRIOR';
      if (primaryChar) {
        if (primaryChar.class === 'ARCANIST') clientClass = 'MAGE';
        if (primaryChar.class === 'RANGER') clientClass = 'ARCHER';
      }

      const character = primaryChar ? {
        id: primaryChar.id,
        name: primaryChar.name,
        class: clientClass,
        gender: 'M', // default database gender placeholder
        level: primaryChar.level,
        experience: Number(primaryChar.experience),
        gold: primaryChar.gold,
        hp: primaryChar.currentHp,
        maxHp: primaryChar.maxHp,
        mp: primaryChar.currentMana,
        maxMp: primaryChar.maxMana
      } : null;

      return res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          isGm: user.isGm,
          character
        }
      });
    } catch (dbError: any) {
      if (dbError && dbError.message !== 'DATABASE_URL_NOT_SET' && dbError.message !== 'USER_NOT_FOUND_IN_DB') {
        console.warn('⚠️ SQL Database unavailable, routing authentication query to local in-memory records.');
      }
      // 2. Local memory fallback lookup on db failure/user-not-found
      const normalizedUsername = username.toLowerCase();
      const memUser = memoryUsers.get(normalizedUsername);
      if (!memUser) {
        return res.status(400).json({ error: 'Invalid credentials.' });
      }

      const isMatch = await bcrypt.compare(password, memUser.passwordHash);
      if (!isMatch) return res.status(400).json({ error: 'Invalid credentials.' });

      const primaryChar = Array.from(memoryCharacters.values()).find((c: any) => c.userId === memUser.id);
      const token = jwt.sign({ userId: memUser.id, isGm: memUser.isGm }, JWT_SECRET, { expiresIn: '24h' });

      return res.json({
        token,
        user: {
          id: memUser.id,
          username: memUser.username,
          isGm: memUser.isGm,
          character: primaryChar ? {
            id: primaryChar.id,
            name: primaryChar.name,
            class: primaryChar.class,
            gender: primaryChar.gender,
            level: primaryChar.level,
            experience: primaryChar.experience,
            gold: primaryChar.gold,
            hp: primaryChar.currentHp,
            maxHp: primaryChar.maxHp,
            mp: primaryChar.currentMana,
            maxMp: primaryChar.maxMana
          } : null
        }
      });
    }
  } catch (error) {
    console.error('Login Exception:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});
