import { Request, Response } from 'express';
export { secureLogin as login, sessionLogout as logout } from './auth.login';

export const verifyToken = async (req: Request, res: Response): Promise<Response> =>
  res.json({ success: true, message: 'Sesion valida', data: { usuario: (req as any).user } });